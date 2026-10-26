import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { Flag, X, AlertTriangle, CheckCircle } from 'lucide-react';

const REASON_OPTIONS = [
  'Fake patient or non-existent hospital emergency',
  'Demanding money or commercial blood sale',
  'Harassment, abusive behavior, or repeated calls',
  'Incorrect blood group or outdated request',
  'Other suspicious activity',
];

export default function ReportModal({ requestId = null, userId = null, title = 'Submit Safety Report', onClose }) {
  const [reason, setReason] = useState(REASON_OPTIONS[0]);
  const [details, setDetails] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const reportMutation = useMutation({
    mutationFn: (body) => api.createReport(body),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    },
    onError: (err) => {
      setError(err.message || 'Failed to submit report.');
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    reportMutation.mutate({
      requestId,
      userId,
      reason,
      details: details.trim() || null,
    });
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#ffffff',
          position: 'relative',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: 'var(--text-muted)',
          }}
          title="Close"
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'var(--danger-light)', padding: 8, borderRadius: '50%' }}>
            <Flag size={20} color="var(--danger)" />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{title}</h3>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--success)' }}>
            <CheckCircle size={40} style={{ margin: '0 auto 12px' }} />
            <h4 style={{ fontWeight: 700 }}>Thank you for keeping our community safe</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
              Our administration team has received your report and will review it promptly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div
                style={{
                  background: 'var(--danger-light)',
                  color: 'var(--danger)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.88rem',
                  marginBottom: 14,
                }}
              >
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="reason">Primary Reason</label>
              <select
                id="reason"
                className="form-control"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              >
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="details">Additional Details (Optional)</label>
              <textarea
                id="details"
                className="form-control"
                rows={3}
                placeholder="Describe any evidence or specific details..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger btn-sm"
                disabled={reportMutation.isPending}
              >
                <Flag size={16} />
                <span>{reportMutation.isPending ? 'Submitting...' : 'Submit Report'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
