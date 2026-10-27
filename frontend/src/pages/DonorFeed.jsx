import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import {
  Heart,
  Droplet,
  MapPin,
  Clock,
  Phone,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Radio,
} from 'lucide-react';

export default function DonorFeed() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('notified'); // 'notified' | 'accepted' | 'all' | 'nearby'
  const [actionFeedback, setActionFeedback] = useState({ type: '', message: '' });

  // SSE live updates replacing polling
  const { isConnected: isLive, pollingInterval } = useLiveUpdates({ fallbackInterval: 15000 });

  // Query donor matches
  const {
    data: matches = [],
    isLoading: matchesLoading,
    error: matchesError,
  } = useQuery({
    queryKey: ['myMatches'],
    queryFn: async () => {
      const res = await api.getMyMatches();
      return res.data?.matches || res.data || [];
    },
    refetchInterval: pollingInterval, // Dynamic: disabled when SSE live, fallback when disconnected
  });

  // Query nearby open requests
  const { data: nearbyRequests = [], isLoading: nearbyLoading } = useQuery({
    queryKey: ['nearbyRequests'],
    queryFn: async () => {
      const res = await api.getNearbyRequests();
      return res.data?.requests || res.data || [];
    },
    enabled: activeTab === 'nearby',
  });

  // Accept Mutation
  const acceptMutation = useMutation({
    mutationFn: (matchId) => api.acceptMatch(matchId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['myMatches'] });
      setActionFeedback({
        type: 'success',
        message: 'Thank you! You have accepted the request. Requester contact details are now revealed below.',
      });
      setTimeout(() => setActionFeedback({ type: '', message: '' }), 6000);
    },
    onError: (err) => {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Could not accept request. It may have already been filled or expired.',
      });
    },
  });

  // Decline Mutation
  const declineMutation = useMutation({
    mutationFn: (matchId) => api.declineMatch(matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myMatches'] });
      setActionFeedback({
        type: 'info',
        message: 'Invitation declined. We will notify the next wave of eligible donors.',
      });
      setTimeout(() => setActionFeedback({ type: '', message: '' }), 4000);
    },
    onError: (err) => {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Could not decline request.',
      });
    },
  });

  const filteredMatches = matches.filter((m) => {
    if (activeTab === 'notified') return m.match_status === 'NOTIFIED';
    if (activeTab === 'accepted') return m.match_status === 'ACCEPTED';
    return true;
  });

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Heart color="var(--primary)" fill="var(--primary)" size={28} />
          <span>Donor Emergency Feed</span>
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Review blood requests you have been notified for, or browse active nearby emergencies.
        </p>
      </div>

      {actionFeedback.message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 20,
            background:
              actionFeedback.type === 'success'
                ? 'var(--success-light)'
                : actionFeedback.type === 'error'
                ? 'var(--danger-light)'
                : 'var(--info-light)',
            color:
              actionFeedback.type === 'success'
                ? 'var(--success)'
                : actionFeedback.type === 'error'
                ? 'var(--danger)'
                : 'var(--info)',
            fontSize: '0.92rem',
            fontWeight: 600,
          }}
        >
          {actionFeedback.message}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab('notified')}
          className={`btn btn-sm ${activeTab === 'notified' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <span>Pending Invitations</span>
          <span style={{ background: 'rgba(255,255,255,0.3)', padding: '1px 6px', borderRadius: 999, fontSize: '0.75rem' }}>
            {matches.filter((m) => m.match_status === 'NOTIFIED').length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('accepted')}
          className={`btn btn-sm ${activeTab === 'accepted' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <span>Accepted</span>
          <span style={{ background: 'rgba(255,255,255,0.3)', padding: '1px 6px', borderRadius: 999, fontSize: '0.75rem' }}>
            {matches.filter((m) => m.match_status === 'ACCEPTED').length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <span>All History</span>
        </button>
        <button
          onClick={() => setActiveTab('nearby')}
          className={`btn btn-sm ${activeTab === 'nearby' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Radio size={14} />
          <span>Nearby Emergencies</span>
        </button>
      </div>

      {/* Feed Content */}
      {activeTab === 'nearby' ? (
        <div>
          {nearbyLoading ? (
            <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading nearby requests...</p>
          ) : nearbyRequests.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: 'var(--text-muted)' }}>No open requests found matching your blood group in your area right now.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {nearbyRequests.map((req) => (
                <div key={req.id} className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="badge badge-blood">{req.blood_group}</span>
                      <span className={`badge badge-${req.urgency ? req.urgency.toLowerCase() : 'normal'}`} style={{ marginLeft: 8 }}>
                        {req.urgency}
                      </span>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 8 }}>{req.hospital_name}</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Patient: <strong>{req.patient_name}</strong> | Needed: {req.units_needed} unit(s)
                      </p>
                    </div>
                    {req.distance_km !== undefined && (
                      <div style={{ textAlign: 'right', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                        <MapPin size={16} style={{ verticalAlign: 'middle' }} />
                        <span>about {req.distance_km} km away</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : matchesLoading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading invitations...</p>
      ) : filteredMatches.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <Heart size={40} color="var(--border)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>No invitations in this view</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            When a matching patient needs your blood group nearby, invitations will appear here in real time.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredMatches.map((m) => {
            const isNotified = m.match_status === 'NOTIFIED';
            const isAccepted = m.match_status === 'ACCEPTED';
            const isCritical = m.urgency === 'CRITICAL';

            return (
              <div
                key={m.match_id}
                className={`card ${isCritical && isNotified ? 'pulse-critical' : ''}`}
                style={{
                  borderLeft: `5px solid ${
                    isCritical
                      ? 'var(--danger)'
                      : m.urgency === 'URGENT'
                      ? 'var(--warning)'
                      : 'var(--primary)'
                  }`,
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="badge badge-blood">{m.blood_group}</span>
                    <span className={`badge badge-${m.urgency ? m.urgency.toLowerCase() : 'normal'}`}>
                      {m.urgency}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background:
                          isAccepted
                            ? 'var(--success-light)'
                            : isNotified
                            ? 'var(--primary-light)'
                            : '#f1f5f9',
                        color:
                          isAccepted
                            ? 'var(--success)'
                            : isNotified
                            ? 'var(--primary-dark)'
                            : 'var(--text-muted)',
                      }}
                    >
                      {m.match_status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <MapPin size={16} color="var(--primary)" />
                    <span>about {m.distance_km || '?'} km away</span>
                  </div>
                </div>

                {/* Body Details */}
                <div style={{ marginTop: 12 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{m.hospital_name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 2 }}>
                    Patient: <strong>{m.patient_name}</strong> • Units Required: <strong>{m.units_needed}</strong>
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Clock size={14} />
                    <span>Needed by: {m.needed_by ? new Date(m.needed_by).toLocaleString() : 'As soon as possible'}</span>
                  </p>
                </div>

                {/* Contact phone section */}
                <div
                  style={{
                    marginTop: 14,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: isAccepted ? 'var(--success-light)' : '#f8fafc',
                    border: `1px solid ${isAccepted ? '#86efac' : 'var(--border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isAccepted ? (
                      <Unlock size={18} color="var(--success)" />
                    ) : (
                      <Lock size={18} color="var(--text-muted)" />
                    )}
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: isAccepted ? 'var(--success)' : 'var(--text-muted)' }}>
                      Requester Contact: {m.contact_phone}
                    </span>
                  </div>
                  {!isAccepted && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Shared after you accept
                    </span>
                  )}
                </div>

                {/* Actions for Notified Requests */}
                {isNotified && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr',
                      gap: 12,
                      marginTop: 16,
                      borderTop: '1px solid var(--border)',
                      paddingTop: 14,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => acceptMutation.mutate(m.match_id)}
                      disabled={acceptMutation.isPending || declineMutation.isPending}
                      className="btn btn-success btn-lg"
                      style={{ width: '100%' }}
                    >
                      <CheckCircle size={20} />
                      <span>{acceptMutation.isPending ? 'Accepting...' : 'Accept to Donate'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => declineMutation.mutate(m.match_id)}
                      disabled={acceptMutation.isPending || declineMutation.isPending}
                      className="btn btn-secondary btn-lg"
                      style={{ width: '100%' }}
                    >
                      <XCircle size={20} />
                      <span>Decline</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
