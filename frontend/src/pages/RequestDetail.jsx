import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import {
  Droplet,
  MapPin,
  Clock,
  Phone,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Radio,
  UserCheck,
  ShieldAlert,
  ArrowLeft,
  Calendar,
  Flag,
  Share2,
  Copy,
  Check,
  Flame,
  ShieldCheck,
  FileText,
  Upload,
  MessageSquare,
} from 'lucide-react';
import ReportModal from '../components/ReportModal';
import ChatBox from '../components/ChatBox';

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [showReportModal, setShowReportModal] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [activeChatMatchId, setActiveChatMatchId] = useState(null);

  // Escalate to SOS Mutation
  const escalateMutation = useMutation({
    mutationFn: () => api.escalateRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloodRequest', id] });
      queryClient.invalidateQueries({ queryKey: ['myRequests'] });
      setFeedback({ type: 'success', message: 'Request escalated to CRITICAL SOS! Search radius expanded.' });
      setTimeout(() => setFeedback({ type: '', message: '' }), 8000);
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Could not escalate request.' });
    },
  });

  // Live SSE stream updates replacing polling
  const { isConnected: isLive, pollingInterval } = useLiveUpdates({ requestId: id });

  // Fetch Request Details
  const {
    data: request,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['bloodRequest', id],
    queryFn: async () => {
      const res = await api.getRequestById(id);
      return res.data?.request || res.data || null;
    },
    refetchInterval: pollingInterval, // Dynamic: disabled when SSE live, fallback when disconnected
  });

  // Cancel Request Mutation
  const cancelMutation = useMutation({
    mutationFn: () => api.cancelBloodRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloodRequest', id] });
      queryClient.invalidateQueries({ queryKey: ['myRequests'] });
      setFeedback({ type: 'info', message: 'Blood request has been cancelled.' });
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Could not cancel request.' });
    },
  });

  // Confirm Donation Mutation
  const confirmMutation = useMutation({
    mutationFn: (matchId) => api.confirmDonation(id, matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloodRequest', id] });
      setFeedback({ type: 'success', message: 'Donation successfully confirmed! Thank you to the donor.' });
      setTimeout(() => setFeedback({ type: '', message: '' }), 6000);
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Could not confirm donation.' });
    },
  });

  // Upload Medical Verification Document Mutation
  const uploadDocMutation = useMutation({
    mutationFn: (formData) => api.uploadVerificationDocument(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bloodRequest', id] });
      setFeedback({ type: 'success', message: 'Medical requisition slip uploaded! Awaiting admin review.' });
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to upload document.' });
    },
  });

  function handleCancel() {
    if (window.confirm('Are you sure you want to cancel this blood request? Pending donor notifications will be withdrawn.')) {
      cancelMutation.mutate();
    }
  }

  function handleEscalate() {
    if (window.confirm('Escalate to CRITICAL SOS? This will widen the matching radius immediately and accelerate alerts.')) {
      escalateMutation.mutate();
    }
  }

  function handleCopyShare() {
    if (request?.share_token) {
      const publicUrl = `${window.location.origin}/s/${request.share_token}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(publicUrl);
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2500);
      }
    }
  }

  if (isLoading) {
    return <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading request details...</p>;
  }

  if (error || !request) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--danger)' }}>
        {error?.message || 'Blood request not found.'}
      </div>
    );
  }

  const isRequester = user && user.id === request.requester_id;
  const isAdmin = user && user.role === 'ADMIN';
  const matches = request.matches || [];
  const acceptedMatches = matches.filter((m) => m.status === 'ACCEPTED' || m.status === 'DONATED');
  const isFulfilled = request.status === 'FULFILLED' || acceptedMatches.length >= request.units_needed;
  const canCancel =
    (isRequester || isAdmin) &&
    (request.status === 'OPEN' || request.status === 'PARTIALLY_FULFILLED');

  return (
    <div style={{ maxWidth: 850, margin: '0 auto' }}>
      <button
        onClick={() => navigate('/requests')}
        className="btn btn-secondary btn-sm"
        style={{ marginBottom: 16 }}
      >
        <ArrowLeft size={16} />
        <span>Back to My Requests</span>
      </button>

      {feedback.message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 20,
            background:
              feedback.type === 'success'
                ? 'var(--success-light)'
                : feedback.type === 'error'
                ? 'var(--danger-light)'
                : 'var(--info-light)',
            color:
              feedback.type === 'success'
                ? 'var(--success)'
                : feedback.type === 'error'
                ? 'var(--danger)'
                : 'var(--info)',
            fontSize: '0.92rem',
            fontWeight: 600,
          }}
        >
          {feedback.message}
        </div>
      )}

      {request.is_sos && (
        <div
          style={{
            background: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
            color: '#ffffff',
            padding: '14px 20px',
            borderRadius: 'var(--radius)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 4px 12px rgba(185, 28, 28, 0.3)',
          }}
        >
          <AlertTriangle size={26} color="#fde047" />
          <div>
            <strong style={{ fontSize: '1rem', letterSpacing: '0.02em' }}>CRITICAL SOS ESCALATION ACTIVE</strong>
            <p style={{ fontSize: '0.82rem', margin: '2px 0 0', opacity: 0.9 }}>
              Search radius expanded to 25+ km. Accelerated emergency waves active.
            </p>
          </div>
        </div>
      )}

      {/* Main Request Header Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="badge badge-blood">{request.blood_group}</span>
              <span className={`badge badge-${request.urgency ? request.urgency.toLowerCase() : 'normal'}`}>
                {request.urgency}
              </span>
              {request.is_verified_request && (
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 4,
                    background: '#dcfce7',
                    color: '#15803d',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Verified by medical authority or admin"
                >
                  <ShieldCheck size={14} /> Verified Request
                </span>
              )}
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 4,
                  background: isFulfilled
                    ? 'var(--success-light)'
                    : request.status === 'CANCELLED'
                    ? '#f1f5f9'
                    : 'var(--primary-light)',
                  color: isFulfilled
                    ? 'var(--success)'
                    : request.status === 'CANCELLED'
                    ? 'var(--text-muted)'
                    : 'var(--primary-dark)',
                }}
              >
                {request.status}
              </span>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: isLive ? '#dcfce7' : '#f1f5f9',
                  color: isLive ? '#15803d' : '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title={isLive ? 'Real-time updates active via SSE' : 'Polling mode active'}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: isLive ? '#22c55e' : '#94a3b8',
                  }}
                />
                {isLive ? 'Live' : 'Polling'}
              </span>
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{request.hospital_name}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: 4 }}>
              Patient: <strong>{request.patient_name}</strong> • Units Needed: <strong>{request.units_needed}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {request.share_token && (
              <button
                onClick={handleCopyShare}
                className="btn btn-secondary btn-sm"
                title="Copy public emergency share link"
              >
                {copiedShare ? <Check size={16} color="#16a34a" /> : <Share2 size={16} />}
                <span>{copiedShare ? 'Copied Public Link!' : 'Share'}</span>
              </button>
            )}

            {canCancel && !request.is_sos && (
              <button
                onClick={handleEscalate}
                disabled={escalateMutation.isPending}
                className="btn btn-primary btn-sm"
                style={{ background: '#b91c1c' }}
                title="Escalate to CRITICAL SOS"
              >
                <Flame size={16} />
                <span>{escalateMutation.isPending ? 'Escalating...' : 'Escalate to SOS'}</span>
              </button>
            )}

            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="btn btn-danger btn-sm"
              >
                <XCircle size={16} />
                <span>{cancelMutation.isPending ? 'Cancelling...' : 'Cancel'}</span>
              </button>
            )}

            <button
              onClick={() => setShowReportModal(true)}
              className="btn btn-secondary btn-sm"
              style={{ color: 'var(--text-muted)' }}
              title="Report suspicious or fake request"
            >
              <Flag size={14} />
              <span>Report</span>
            </button>
          </div>
        </div>

        {showReportModal && (
          <ReportModal
            requestId={request.id}
            userId={request.requester_id}
            title="Report Blood Request"
            onClose={() => setShowReportModal(false)}
          />
        )}

        {/* Timeline & Wave Progress Bar */}
        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 'var(--radius-sm)', marginTop: 20 }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
            Matching Status & Wave Timeline
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
            <div style={{ padding: '8px 4px', background: '#ffffff', borderRadius: 6, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Wave Round</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                Wave {request.wave_number || 1}
              </p>
            </div>

            <div style={{ padding: '8px 4px', background: '#ffffff', borderRadius: 6, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Search Radius</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                {request.current_radius_km || 5} km
              </p>
            </div>

            <div style={{ padding: '8px 4px', background: '#ffffff', borderRadius: 6, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Confirmed</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)' }}>
                {acceptedMatches.length} / {request.units_needed}
              </p>
            </div>

            <div style={{ padding: '8px 4px', background: '#ffffff', borderRadius: 6, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Wave Timeout</span>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                {request.urgency === 'CRITICAL' ? '10 mins' : request.urgency === 'URGENT' ? '20 mins' : '30 mins'}
              </p>
            </div>
          </div>
        </div>

        {/* Time Info */}
        <div style={{ display: 'flex', gap: 24, marginTop: 16, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={16} />
            <span>Needed by: {new Date(request.needed_by).toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={16} />
            <span>Expires at: {new Date(request.expires_at).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Hospital Verification Document Card (Phase 18) */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px 0' }}>
          <FileText size={20} color="var(--primary)" />
          <span>Hospital Verification & Medical Slip</span>
        </h3>
        {request.is_verified_request ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: '#f0fdf4', borderRadius: 8, color: '#166534' }}>
            <ShieldCheck size={24} color="#22c55e" />
            <div>
              <strong>Verified Emergency Request</strong>
              <div style={{ fontSize: '0.82rem' }}>This blood request has been authenticated with official hospital documentation.</div>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 12px 0' }}>
              Upload an image or PDF of the patient's hospital requisition slip, cross-match form, or doctor's prescription. Verified requests earn trust, priority alerts to donors, and bypass daily rate limits.
            </p>
            {request.verification_document_url ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: '#fffbeb', borderRadius: 8, border: '1px solid #fef3c7' }}>
                <span style={{ fontSize: '0.88rem', color: '#b45309', fontWeight: 600 }}>
                  Document uploaded and awaiting admin review.
                </span>
                <a href={request.verification_document_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                  View Document
                </a>
              </div>
            ) : isRequester ? (
              <label className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <Upload size={16} />
                <span>Upload Medical Requisition Slip</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const data = new FormData();
                      data.append('document', file);
                      uploadDocMutation.mutate(data);
                    }
                  }}
                />
              </label>
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No verification document submitted by the requester yet.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Accepted Donors Section */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <UserCheck size={22} color="var(--success)" />
          <span>Accepted Donors ({acceptedMatches.length})</span>
        </h2>

        {acceptedMatches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 16px', background: '#f8fafc', borderRadius: 'var(--radius-sm)' }}>
            <Radio size={32} color="var(--primary)" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Matching Waves Are Active</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
              Nearby compatible donors in Wave {request.wave_number || 1} are being notified. When a donor accepts, their contact phone will immediately appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {acceptedMatches.map((m) => {
              const isDonated = m.status === 'DONATED';
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 16,
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: 'var(--radius-sm)',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{m.donor_name}</span>
                      <span className="badge badge-blood">{m.donor_blood_group}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        (approx {m.distance_km || '?'} km away)
                      </span>
                    </div>

                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Phone size={16} color="var(--success)" />
                      <a
                        href={`tel:${m.donor_phone}`}
                        style={{ color: 'var(--success)', fontWeight: 700, textDecoration: 'underline' }}
                      >
                        {m.donor_phone}
                      </a>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setActiveChatMatchId(m.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <MessageSquare size={16} color="var(--primary)" />
                      <span>Chat</span>
                    </button>

                    {isDonated ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontWeight: 700 }}>
                        <CheckCircle size={18} />
                        <span>Donation Confirmed</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => confirmMutation.mutate(m.id)}
                        disabled={confirmMutation.isPending}
                        className="btn btn-success btn-sm"
                      >
                        <CheckCircle size={16} />
                        <span>Confirm Donation</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Masked Chat Modal */}
      {activeChatMatchId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl">
            <ChatBox
              matchId={activeChatMatchId}
              currentUser={user}
              onClose={() => setActiveChatMatchId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
