const analyticsRepository = require('../repositories/analyticsRepository');

class AnalyticsService {
  async getOverview() {
    return await analyticsRepository.getDemandAndSupplyAnalytics();
  }

  async getHeatmapGrid(resolution = 0.05) {
    const res = parseFloat(resolution) || 0.05;
    return await analyticsRepository.getGeoHeatmapGrid(res);
  }

  async getShortageForecast() {
    return await analyticsRepository.getShortageForecast();
  }

  /**
   * Get recruit nudges for a donor based on their blood group and area shortage
   */
  async getRecruitNudges(donorBloodGroup, donorCity) {
    const forecasts = await analyticsRepository.getShortageForecast();
    const overview = await analyticsRepository.getDemandAndSupplyAnalytics();

    const nudges = [];

    // Filter relevant shortage risks for this donor
    const matchingForecasts = forecasts.filter(
      (f) =>
        f.shortageRisk &&
        (f.bloodGroup === donorBloodGroup || !donorBloodGroup) &&
        (!donorCity || f.city.toLowerCase() === donorCity.toLowerCase())
    );

    for (const f of matchingForecasts) {
      nudges.push({
        id: `nudge-${f.city.toLowerCase()}-${f.bloodGroup.replace('+', 'pos').replace('-', 'neg')}`,
        bloodGroup: f.bloodGroup,
        city: f.city,
        riskLevel: f.riskLevel,
        title: `Donors Urgently Needed in ${f.city}`,
        message: `High demand for ${f.bloodGroup} blood in ${f.city}. We forecast ${f.forecastedDemandNextWeek} donations needed with only ${f.currentEligibleDonors} active donors ready.`,
        forecastedDemand: f.forecastedDemandNextWeek,
        eligibleDonors: f.currentEligibleDonors,
      });
    }

    // Also check active breakdown from overview if forecast didn't pick it up yet
    if (nudges.length === 0 && overview.breakdown) {
      const activeShortages = overview.breakdown.filter(
        (b) =>
          b.shortageRisk &&
          (b.bloodGroup === donorBloodGroup || !donorBloodGroup) &&
          (!donorCity || b.area.toLowerCase() === donorCity.toLowerCase())
      );

      for (const b of activeShortages) {
        nudges.push({
          id: `nudge-active-${b.area.toLowerCase()}-${b.bloodGroup.replace('+', 'pos').replace('-', 'neg')}`,
          bloodGroup: b.bloodGroup,
          city: b.area,
          riskLevel: 'HIGH',
          title: `Donors Needed: Critical ${b.bloodGroup} Demand`,
          message: `There are ${b.activeRequests} pending requests for ${b.bloodGroup} in ${b.area} with scarce donor availability. Your donation can save lives today!`,
          forecastedDemand: b.activeRequests,
          eligibleDonors: b.eligibleDonors,
        });
      }
    }

    return nudges;
  }

  /**
   * Export anonymous aggregated analytics as CSV
   */
  async exportCsv() {
    const overview = await analyticsRepository.getDemandAndSupplyAnalytics();
    const forecast = await analyticsRepository.getShortageForecast();

    const forecastMap = new Map();
    for (const f of forecast) {
      forecastMap.set(`${f.city}_${f.bloodGroup}`, f);
    }

    // Build CSV Rows
    const headers = [
      'Area',
      'Blood Group',
      'Total Requests',
      'Fulfilled Requests',
      'Active Requests',
      'Fulfillment Rate (%)',
      'Avg Time to Accept (Mins)',
      'Total Donors',
      'Eligible Donors',
      'Supply Demand Ratio',
      'Shortage Risk Level',
      'Forecasted Demand Next Week',
    ];

    const escapeCsv = (str) => {
      const val = str === null || str === undefined ? '' : String(str);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const lines = [headers.map(escapeCsv).join(',')];

    for (const b of overview.breakdown) {
      const fc = forecastMap.get(`${b.area}_${b.bloodGroup}`) || {
        riskLevel: b.shortageRisk ? 'HIGH' : 'LOW',
        forecastedDemandNextWeek: b.activeRequests || 0,
      };

      lines.push(
        [
          b.area,
          b.bloodGroup,
          b.totalRequests,
          b.fulfilledRequests,
          b.activeRequests,
          `${b.fulfillmentRatePct}%`,
          b.avgTimeToAcceptMins,
          b.totalDonors,
          b.eligibleDonors,
          b.supplyDemandRatio,
          fc.riskLevel,
          fc.forecastedDemandNextWeek,
        ]
          .map(escapeCsv)
          .join(',')
      );
    }

    return lines.join('\n');
  }
}

module.exports = new AnalyticsService();
