import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Trophy, Award, Flame, MapPin, Loader2, Users } from 'lucide-react';

export default function Leaderboard() {
  const { data: leaderboard = [], isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const res = await api.get('/leaderboard');
      return res.data.data;
    },
  });

  return (
    <div style={{ maxWidth: 850, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#ffffff', textAlign: 'center', padding: '36px 20px' }}>
        <div style={{ display: 'inline-flex', padding: 12, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', marginBottom: 12 }}>
          <Trophy size={36} color="#fbbf24" />
        </div>
        <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#ffffff', margin: '0 0 8px' }}>
          Community LifeSaver Leaderboard
        </h1>
        <p style={{ maxWidth: 580, margin: '0 auto', fontSize: '0.95rem', opacity: 0.85 }}>
          Celebrating our heroic voluntary donors across Bangladesh. Opt-in via your Donor Stats portal to be featured!
        </p>
      </div>

      {/* Leaderboard Table / Cards */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Loader2 className="animate-spin" size={36} color="var(--primary)" />
          </div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>Failed to load leaderboard data.</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={40} color="var(--border)" style={{ margin: '0 auto 12px' }} />
            <h3>No donors on the leaderboard yet</h3>
            <p style={{ marginTop: 4 }}>Be the first donor to opt in and save lives!</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px', width: 60, textAlign: 'center' }}>Rank</th>
                  <th style={{ padding: '12px 16px' }}>Donor</th>
                  <th style={{ padding: '12px 16px' }}>Blood Group</th>
                  <th style={{ padding: '12px 16px' }}>Location</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Streak</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Donations</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((donor) => {
                  const isTop1 = donor.rank === 1;
                  const isTop2 = donor.rank === 2;
                  const isTop3 = donor.rank === 3;

                  let rankBadge = (
                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>#{donor.rank}</span>
                  );
                  if (isTop1) rankBadge = <span style={{ fontSize: '1.4rem' }}>🥇</span>;
                  if (isTop2) rankBadge = <span style={{ fontSize: '1.4rem' }}>🥈</span>;
                  if (isTop3) rankBadge = <span style={{ fontSize: '1.4rem' }}>🥉</span>;

                  return (
                    <tr
                      key={donor.rank}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isTop1 ? '#fefce8' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>{rankBadge}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-main)' }}>
                          {donor.displayName}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Award size={13} color="#ea580c" />
                          <span>{donor.badgesCount} badges earned</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span className="badge badge-critical" style={{ fontSize: '0.78rem' }}>
                          {donor.bloodGroup || 'Volunteer'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <MapPin size={14} />
                          <span>{donor.city}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                          <Flame size={15} color="#ea580c" />
                          <span>{donor.currentStreak}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>
                          {donor.donatedCount}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 4 }}>units</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
