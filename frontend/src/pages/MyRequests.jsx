import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  List,
  PlusCircle,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Radio,
  ChevronRight,
} from 'lucide-react';

export default function MyRequests() {
  const {
    data: requests = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['myRequests'],
    queryFn: async () => {
      const res = await api.getMyRequests();
      return res.data?.requests || res.data || [];
    },
    refetchInterval: 10000,
  });

  return (
    <div style={{ maxWidth: 850, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>My Blood Requests</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Track donation progress, donor responses, and matching waves in real time.
          </p>
        </div>
        <Link to="/requests/new" className="btn btn-primary">
          <PlusCircle size={18} />
          <span>New Request</span>
        </Link>
      </div>

      {isLoading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading your requests...</p>
      ) : error ? (
        <div className="card" style={{ color: 'var(--danger)', textAlign: 'center', padding: 30 }}>
          {error.message || 'Failed to load requests.'}
        </div>
      ) : requests.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <List size={40} color="var(--border)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No blood requests yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4, marginBottom: 20 }}>
            Create an emergency request to start finding compatible volunteer donors nearby.
          </p>
          <Link to="/requests/new" className="btn btn-primary">
            <PlusCircle size={18} />
            <span>Create Blood Request</span>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {requests.map((req) => {
            const acceptedCount = req.accepted_count || 0;
            const progressPercent = Math.min(
              100,
              Math.round((acceptedCount / req.units_needed) * 100)
            );
            const isFulfilled = req.status === 'FULFILLED' || acceptedCount >= req.units_needed;

            return (
              <Link
                key={req.id}
                to={`/requests/${req.id}`}
                className="card"
                style={{
                  display: 'block',
                  transition: 'all 0.2s ease',
                  borderLeft: `5px solid ${
                    isFulfilled
                      ? 'var(--success)'
                      : req.status === 'CANCELLED'
                      ? 'var(--text-muted)'
                      : 'var(--primary)'
                  }`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="badge badge-blood">{req.blood_group}</span>
                    <span className={`badge badge-${req.urgency ? req.urgency.toLowerCase() : 'normal'}`}>
                      {req.urgency}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: isFulfilled
                          ? 'var(--success-light)'
                          : req.status === 'CANCELLED'
                          ? '#f1f5f9'
                          : 'var(--primary-light)',
                        color: isFulfilled
                          ? 'var(--success)'
                          : req.status === 'CANCELLED'
                          ? 'var(--text-muted)'
                          : 'var(--primary-dark)',
                      }}
                    >
                      {req.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <Radio size={14} color="var(--primary)" />
                    <span>Wave {req.wave_number || 1} ({req.current_radius_km || 5} km)</span>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{req.hospital_name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Patient: <strong>{req.patient_name}</strong> • City: {req.city || 'Dhaka'}
                  </p>
                </div>

                {/* Progress bar ("1 of 2 donors confirmed") */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>
                    <span style={{ color: isFulfilled ? 'var(--success)' : 'var(--text-main)' }}>
                      {acceptedCount} of {req.units_needed} donors confirmed
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{progressPercent}%</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${progressPercent}%`,
                        height: '100%',
                        background: isFulfilled ? 'var(--success)' : 'var(--primary)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} />
                    <span>Needed by: {new Date(req.needed_by).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', fontWeight: 600 }}>
                    <span>View Timeline & Donors</span>
                    <ChevronRight size={16} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
