import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Calendar, MapPin, Users, Building2, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function BloodDrives() {
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [coords, setCoords] = useState({ latitude: 23.8103, longitude: 90.4125 });

  const { data: drives = [], isLoading } = useQuery({
    queryKey: ['nearbyDrives', coords.latitude, coords.longitude],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        latitude: coords.latitude,
        longitude: coords.longitude,
        radiusKm: 30,
      });
      const res = await api.getNearbyDrives(searchParams.toString());
      return res?.data || [];
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: (driveId) => api.rsvpDrive(driveId),
    onSuccess: () => {
      showToast('RSVP confirmed! See you at the blood drive.', 'success');
      queryClient.invalidateQueries(['nearbyDrives']);
    },
    onError: (err) => {
      showToast(err.message || 'Failed to RSVP', 'error');
    },
  });

  const cancelRsvpMutation = useMutation({
    mutationFn: (driveId) => api.cancelDriveRsvp(driveId),
    onSuccess: () => {
      showToast('RSVP cancelled.', 'info');
      queryClient.invalidateQueries(['nearbyDrives']);
    },
    onError: (err) => {
      showToast(err.message || 'Failed to cancel RSVP', 'error');
    },
  });

  return (
    <div className="container" style={{ maxWidth: 950, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
          <Calendar color="#e53935" size={28} />
          <span>Community Blood Drives</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
          Participate in mobile blood collection camps, earn volunteer credits, and help restock emergency hospital banks.
        </p>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <p>Loading upcoming blood drives...</p>
        </div>
      ) : drives.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, background: 'var(--card-bg)' }}>
          <AlertCircle size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3>No Blood Drives Found Nearby</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: 450, margin: '8px auto 0' }}>
            There are currently no active public blood collection drives scheduled in this area. Check back soon!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {drives.map((drive) => {
            const isFull = drive.rsvp_count >= drive.capacity;
            const percentFilled = Math.min(100, Math.round((drive.rsvp_count / drive.capacity) * 100));

            return (
              <div key={drive.id} className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e53935', background: '#ffebee', padding: '2px 8px', borderRadius: 6 }}>
                        {drive.status}
                      </span>
                      {drive.is_verified && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#2e7d32', fontWeight: 600 }}>
                          <ShieldCheck size={14} /> Verified Organization
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 700 }}>
                      {drive.title}
                    </h3>
                    <p style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      Organized by: <strong>{drive.org_name}</strong>
                    </p>
                  </div>

                  {/* Action RSVP Button */}
                  <div>
                    {isAuthenticated ? (
                      <button
                        onClick={() => rsvpMutation.mutate(drive.id)}
                        disabled={isFull || rsvpMutation.isPending}
                        className={`btn ${isFull ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <CheckCircle2 size={16} />
                        <span>{isFull ? 'Capacity Full' : 'RSVP to Donate'}</span>
                      </button>
                    ) : (
                      <a href="/login" className="btn btn-secondary">
                        Login to RSVP
                      </a>
                    )}
                  </div>
                </div>

                {drive.description && (
                  <p style={{ margin: '10px 0 16px 0', fontSize: '0.92rem', lineHeight: 1.5 }}>
                    {drive.description}
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 12, padding: 14, background: 'var(--bg)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                    <MapPin size={16} color="var(--primary)" />
                    <div>
                      <strong>{drive.venue_name}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{drive.address} ({drive.distance_km} km away)</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                    <Calendar size={16} color="var(--primary)" />
                    <div>
                      <strong>{new Date(drive.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {new Date(drive.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(drive.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                      <span>RSVP Capacity:</span>
                      <strong>{drive.rsvp_count} / {drive.capacity} donors</strong>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${percentFilled}%`,
                          background: isFull ? '#d32f2f' : '#2e7d32',
                          borderRadius: 3,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
