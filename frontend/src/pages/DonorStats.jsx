import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  Award,
  Flame,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Eye,
  EyeOff,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

export default function DonorStats() {
  const queryClient = useQueryClient();
  const [downloadingId, setDownloadingId] = useState(null);

  // Fetch stats & badges
  const { data: statsData, isLoading, error } = useQuery({
    queryKey: ['donor-stats'],
    queryFn: async () => {
      const res = await api.get('/donors/me/stats');
      return res.data.data;
    },
  });

  // Toggle leaderboard opt-in
  const optInMutation = useMutation({
    mutationFn: async (showOnLeaderboard) => {
      const res = await api.put('/donors/me/leaderboard-opt-in', { showOnLeaderboard });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['donor-stats']);
    },
  });

  async function handleDownloadCertificate(donationId, certNo) {
    try {
      setDownloadingId(donationId);
      const res = await api.get(`/donations/${donationId}/certificate`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `RoktoBondhu-Certificate-${certNo || donationId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download certificate. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <Loader2 className="animate-spin" size={36} color="var(--primary)" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <ShieldAlert size={40} color="#e53935" style={{ margin: '0 auto 12px' }} />
        <h3>Failed to load donor stats</h3>
        <p className="text-muted">{error.response?.data?.error?.message || error.message}</p>
      </div>
    );
  }

  const {
    donatedCount = 0,
    currentStreak = 0,
    longestStreak = 0,
    nextEligibleAt,
    daysUntilEligible = 0,
    isEligibleNow = true,
    showOnLeaderboard = false,
    badges = [],
    recentDonations = [],
  } = statsData || {};

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Hero Stats Header */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)', color: '#ffffff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.85 }}>
              Donor Achievement Portal
            </span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 4, color: '#ffffff' }}>
              My Donation Impact & Badges
            </h1>
            <p style={{ marginTop: 6, fontSize: '0.95rem', opacity: 0.9 }}>
              Thank you for being a reliable lifesaver. Your voluntary donations save real lives.
            </p>
          </div>

          {/* Countdown Card */}
          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              padding: '16px 20px',
              borderRadius: 'var(--radius)',
              textAlign: 'center',
              minWidth: 180,
            }}
          >
            {isEligibleNow ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#86efac' }}>
                  <CheckCircle size={20} />
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>Eligible to Donate</span>
                </div>
                <p style={{ fontSize: '0.8rem', marginTop: 4, opacity: 0.9 }}>
                  Ready for new requests!
                </p>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#fde047' }}>
                  <Clock size={20} />
                  <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>
                    {daysUntilEligible} Days
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', marginTop: 4, opacity: 0.9 }}>
                  Eligible on: {nextEligibleAt}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Numerical Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: '#fee2e2', padding: 12, borderRadius: 12, color: '#dc2626' }}>
            <Award size={28} />
          </div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>{donatedCount}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Lives Impacted</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: '#ffedd5', padding: 12, borderRadius: 12, color: '#ea580c' }}>
            <Flame size={28} />
          </div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>{currentStreak}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Current Streak (Max: {longestStreak})</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: '#ecfdf5', padding: 12, borderRadius: 12, color: '#059669' }}>
            <Calendar size={28} />
          </div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {badges.filter((b) => b.isEarned).length} / {badges.length}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Badges Unlocked</div>
          </div>
        </div>
      </div>

      {/* Badges Showcase Grid */}
      <div className="card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Award size={22} color="var(--primary)" />
          <span>Earned Badges & Honors</span>
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {badges.map((badge) => (
            <div
              key={badge.code}
              style={{
                border: badge.isEarned ? '2px solid #b91c1c' : '1px dashed var(--border)',
                background: badge.isEarned ? '#fff7ed' : '#f9fafb',
                padding: '16px',
                borderRadius: 'var(--radius)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                opacity: badge.isEarned ? 1 : 0.6,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '2rem' }}>{badge.icon}</span>
                <div>
                  <h4 style={{ fontWeight: 700, fontSize: '0.98rem', margin: 0 }}>{badge.name}</h4>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: badge.isEarned ? '#b91c1c' : '#6b7280',
                      textTransform: 'uppercase',
                    }}
                  >
                    {badge.isEarned ? '★ UNLOCKED' : '🔒 LOCKED'}
                  </span>
                </div>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                {badge.description}
              </p>
              {badge.earnedAt && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                  Earned on: {new Date(badge.earnedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard Opt-in Preference Card */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Public Leaderboard Visibility</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Inspire others by appearing on the community leaderboard. Only your first name, initial, and city will be shown.
          </p>
        </div>
        <button
          onClick={() => optInMutation.mutate(!showOnLeaderboard)}
          disabled={optInMutation.isPending}
          className={`btn ${showOnLeaderboard ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {showOnLeaderboard ? (
            <>
              <Eye size={18} />
              <span>Visible on Leaderboard</span>
            </>
          ) : (
            <>
              <EyeOff size={18} />
              <span>Opted Out (Hidden)</span>
            </>
          )}
        </button>
      </div>

      {/* Donation History & Certificate Downloads */}
      <div className="card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>
          Donation Certificates & History
        </h2>

        {recentDonations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
            <Award size={36} color="var(--border)" style={{ margin: '0 auto 8px' }} />
            <p>No confirmed donations yet. Accept match alerts in your feed to earn certificates!</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 12px' }}>Date</th>
                  <th style={{ padding: '10px 12px' }}>Hospital & City</th>
                  <th style={{ padding: '10px 12px' }}>Urgency</th>
                  <th style={{ padding: '10px 12px' }}>Certificate No</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentDonations.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>
                      {new Date(item.donated_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <strong>{item.hospital_name || 'Hospital'}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {item.city || 'Dhaka'}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className={`badge badge-${(item.urgency || 'NORMAL').toLowerCase()}`}>
                        {item.urgency || 'NORMAL'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                      {item.certificate_no || 'Pending'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDownloadCertificate(item.id, item.certificate_no)}
                        disabled={downloadingId === item.id}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        {downloadingId === item.id ? (
                          <Loader2 className="animate-spin" size={14} />
                        ) : (
                          <Download size={14} />
                        )}
                        <span>Certificate PDF</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
