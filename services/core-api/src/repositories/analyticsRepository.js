const db = require('../config/db');

class AnalyticsRepository {
  /**
   * Get demand and supply analytics aggregated by area and blood group
   */
  async getDemandAndSupplyAnalytics() {
    // 1. Requests by area and blood group
    const requestsQuery = `
      SELECT 
        COALESCE(city, 'Unknown') AS area,
        blood_group,
        COUNT(*)::int AS total_requests,
        COUNT(*) FILTER (WHERE status = 'FULFILLED')::int AS fulfilled_requests,
        COUNT(*) FILTER (WHERE status IN ('OPEN', 'PARTIALLY_FULFILLED'))::int AS active_requests
      FROM blood_requests
      GROUP BY city, blood_group
      ORDER BY area, blood_group
    `;
    const requestsRes = await db.query(requestsQuery);

    // 2. Supply by area and blood group
    const supplyQuery = `
      SELECT 
        COALESCE(city, 'Unknown') AS area,
        blood_group,
        COUNT(*)::int AS total_donors,
        COUNT(*) FILTER (
          WHERE available = true 
            AND (last_donated_at IS NULL OR last_donated_at <= CURRENT_DATE - INTERVAL '90 days')
        )::int AS eligible_donors
      FROM donor_profiles
      GROUP BY city, blood_group
      ORDER BY area, blood_group
    `;
    const supplyRes = await db.query(supplyQuery);

    // 3. Time to first accept (minutes) by blood group
    const timeQuery = `
      SELECT 
        r.blood_group,
        ROUND(COALESCE(AVG(EXTRACT(EPOCH FROM (m.responded_at - r.created_at)) / 60), 0)::numeric, 1) AS avg_time_to_accept_mins
      FROM blood_requests r
      JOIN (
        SELECT request_id, MIN(responded_at) AS responded_at
        FROM request_matches
        WHERE status = 'ACCEPTED' AND responded_at IS NOT NULL
        GROUP BY request_id
      ) m ON m.request_id = r.id
      GROUP BY r.blood_group
    `;
    const timeRes = await db.query(timeQuery);

    // 4. Overall metrics
    const overallQuery = `
      SELECT
        COUNT(*)::int AS total_requests,
        COUNT(*) FILTER (WHERE status = 'FULFILLED')::int AS fulfilled_requests,
        ROUND((COUNT(*) FILTER (WHERE status = 'FULFILLED')::numeric / NULLIF(COUNT(*), 0) * 100), 1) AS fulfillment_rate_pct
      FROM blood_requests
    `;
    const overallRes = await db.query(overallQuery);

    // Map supply and time
    const supplyMap = new Map();
    for (const row of supplyRes.rows) {
      supplyMap.set(`${row.area}_${row.blood_group}`, row);
    }

    const timeMap = new Map();
    for (const row of timeRes.rows) {
      timeMap.set(row.blood_group, parseFloat(row.avg_time_to_accept_mins));
    }

    // Merge request and supply data
    const breakdown = [];
    const areaBloodKeys = new Set();

    for (const r of requestsRes.rows) {
      const key = `${r.area}_${r.blood_group}`;
      areaBloodKeys.add(key);
      const s = supplyMap.get(key) || { total_donors: 0, eligible_donors: 0 };
      const active = r.active_requests || 0;
      const eligible = s.eligible_donors || 0;
      const ratio = active > 0 ? Number((eligible / active).toFixed(2)) : (eligible > 0 ? 5.0 : 1.0);
      const shortageRisk = (active > 0 && eligible === 0) || (active > 1 && ratio < 1.0);

      const total = r.total_requests || 0;
      const fulfilled = r.fulfilled_requests || 0;
      const fulfillmentRate = total > 0 ? Number(((fulfilled / total) * 100).toFixed(1)) : 0;

      breakdown.push({
        area: r.area,
        bloodGroup: r.blood_group,
        totalRequests: total,
        fulfilledRequests: fulfilled,
        activeRequests: active,
        fulfillmentRatePct: fulfillmentRate,
        totalDonors: s.total_donors,
        eligibleDonors: eligible,
        supplyDemandRatio: ratio,
        shortageRisk,
        avgTimeToAcceptMins: timeMap.get(r.blood_group) || 0,
      });
    }

    // Include supply areas that don't have requests yet
    for (const s of supplyRes.rows) {
      const key = `${s.area}_${s.blood_group}`;
      if (!areaBloodKeys.has(key)) {
        breakdown.push({
          area: s.area,
          bloodGroup: s.blood_group,
          totalRequests: 0,
          fulfilledRequests: 0,
          activeRequests: 0,
          fulfillmentRatePct: 100,
          totalDonors: s.total_donors,
          eligibleDonors: s.eligible_donors,
          supplyDemandRatio: s.eligible_donors > 0 ? 5.0 : 1.0,
          shortageRisk: false,
          avgTimeToAcceptMins: timeMap.get(s.blood_group) || 0,
        });
      }
    }

    const overall = overallRes.rows[0] || { total_requests: 0, fulfilled_requests: 0, fulfillment_rate_pct: 0 };

    return {
      totalRequests: overall.total_requests || 0,
      fulfilledRequests: overall.fulfilled_requests || 0,
      fulfillmentRatePct: parseFloat(overall.fulfillment_rate_pct) || 0,
      breakdown,
    };
  }

  /**
   * Spatial grid aggregation for heatmap
   * Uses ST_SnapToGrid for clustering coordinates into rectangular cells
   */
  async getGeoHeatmapGrid(gridResolution = 0.05) {
    const query = `
      WITH request_cells AS (
        SELECT 
          ROUND(ST_Y(ST_SnapToGrid(location::geometry, $1))::numeric, 4) AS lat,
          ROUND(ST_X(ST_SnapToGrid(location::geometry, $1))::numeric, 4) AS lng,
          COALESCE(city, 'Unknown') AS city,
          COUNT(*)::int AS request_count,
          COUNT(*) FILTER (WHERE status IN ('OPEN', 'PARTIALLY_FULFILLED'))::int AS active_request_count,
          array_agg(DISTINCT blood_group) AS blood_groups
        FROM blood_requests
        GROUP BY 1, 2, 3
      ),
      donor_cells AS (
        SELECT 
          ROUND(ST_Y(ST_SnapToGrid(location::geometry, $1))::numeric, 4) AS lat,
          ROUND(ST_X(ST_SnapToGrid(location::geometry, $1))::numeric, 4) AS lng,
          COUNT(*)::int AS donor_count,
          COUNT(*) FILTER (
            WHERE available = true 
              AND (last_donated_at IS NULL OR last_donated_at <= CURRENT_DATE - INTERVAL '90 days')
          )::int AS eligible_donor_count
        FROM donor_profiles
        GROUP BY 1, 2
      )
      SELECT 
        COALESCE(r.lat, d.lat) AS lat,
        COALESCE(r.lng, d.lng) AS lng,
        COALESCE(r.city, 'Area') AS city,
        COALESCE(r.request_count, 0)::int AS request_count,
        COALESCE(r.active_request_count, 0)::int AS active_request_count,
        COALESCE(d.donor_count, 0)::int AS donor_count,
        COALESCE(d.eligible_donor_count, 0)::int AS eligible_donor_count,
        COALESCE(r.blood_groups, '{}') AS blood_groups
      FROM request_cells r
      FULL OUTER JOIN donor_cells d ON r.lat = d.lat AND r.lng = d.lng
      ORDER BY request_count DESC, donor_count DESC
    `;

    const res = await db.query(query, [gridResolution]);

    return res.rows.map((row) => {
      const active = row.active_request_count || 0;
      const eligible = row.eligible_donor_count || 0;
      const ratio = active > 0 ? Number((eligible / active).toFixed(2)) : (eligible > 0 ? 5.0 : 1.0);
      const shortageRisk = (active > 0 && eligible === 0) || (active > 0 && ratio < 1.0);

      // Intensity score (0.1 to 1.0)
      const baseWeight = Math.min(row.request_count * 0.2 + (shortageRisk ? 0.4 : 0.1), 1.0);

      return {
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        city: row.city,
        requestCount: row.request_count,
        activeRequests: active,
        donorCount: row.donor_count,
        eligibleDonors: eligible,
        bloodGroups: row.blood_groups || [],
        supplyDemandRatio: ratio,
        shortageRisk,
        intensity: Number(baseWeight.toFixed(2)),
      };
    });
  }

  /**
   * Weekly demand moving average and shortage forecast
   */
  async getShortageForecast() {
    // 1. Group demand into 4 weekly buckets per blood group and city
    const weeklyDemandQuery = `
      SELECT 
        blood_group,
        COALESCE(city, 'Dhaka') AS city,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS week_0,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days')::int AS week_1,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '21 days' AND created_at < NOW() - INTERVAL '14 days')::int AS week_2,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '28 days' AND created_at < NOW() - INTERVAL '21 days')::int AS week_3,
        COUNT(*)::int AS total_28d
      FROM blood_requests
      GROUP BY blood_group, city
    `;
    const weeklyRes = await db.query(weeklyDemandQuery);

    // 2. Current eligible supply
    const supplyQuery = `
      SELECT 
        blood_group,
        COALESCE(city, 'Dhaka') AS city,
        COUNT(*) FILTER (
          WHERE available = true 
            AND (last_donated_at IS NULL OR last_donated_at <= CURRENT_DATE - INTERVAL '90 days')
        )::int AS eligible_donors
      FROM donor_profiles
      GROUP BY blood_group, city
    `;
    const supplyRes = await db.query(supplyQuery);
    const supplyMap = new Map();
    for (const s of supplyRes.rows) {
      supplyMap.set(`${s.city}_${s.blood_group}`, s.eligible_donors);
    }

    // Default blood groups
    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const forecast = [];

    for (const row of weeklyRes.rows) {
      const key = `${row.city}_${row.blood_group}`;
      const eligible = supplyMap.get(key) || 0;
      
      const w0 = row.week_0 || 0;
      const w1 = row.week_1 || 0;
      const w2 = row.week_2 || 0;
      const w3 = row.week_3 || 0;

      // 4-week simple moving average
      const movingAvg = Number(((w0 + w1 + w2 + w3) / 4).toFixed(1));
      const forecastedDemand = Math.max(Math.ceil(movingAvg), w0 > 0 ? 1 : 0);

      // Shortage risk determination
      let riskLevel = 'LOW';
      if (forecastedDemand > 0 && eligible === 0) {
        riskLevel = 'HIGH';
      } else if (forecastedDemand > eligible) {
        riskLevel = 'HIGH';
      } else if (forecastedDemand * 1.5 >= eligible && forecastedDemand > 0) {
        riskLevel = 'MODERATE';
      }

      forecast.push({
        bloodGroup: row.blood_group,
        city: row.city,
        weeklyHistory: [w3, w2, w1, w0], // from oldest to latest
        movingAvgWeeklyDemand: movingAvg,
        forecastedDemandNextWeek: forecastedDemand,
        currentEligibleDonors: eligible,
        riskLevel,
        shortageRisk: riskLevel !== 'LOW',
      });
    }

    // If some blood groups have no requests in the period, add baseline entries
    if (forecast.length === 0) {
      for (const bg of bloodGroups) {
        forecast.push({
          bloodGroup: bg,
          city: 'Dhaka',
          weeklyHistory: [0, 0, 0, 0],
          movingAvgWeeklyDemand: 0,
          forecastedDemandNextWeek: 0,
          currentEligibleDonors: supplyMap.get(`Dhaka_${bg}`) || 0,
          riskLevel: 'LOW',
          shortageRisk: false,
        });
      }
    }

    return forecast;
  }
}

module.exports = new AnalyticsRepository();
