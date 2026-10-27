import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  Share2,
  Copy,
  Check,
  ShieldCheck,
  MapPin,
  Clock,
  Heart,
  Droplet,
  Loader2,
} from 'lucide-react';

export default function PublicSharePage() {
  const { shareToken } = useParams();
  const { isAuthenticated } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: request, isLoading, error } = useQuery({
    queryKey: ['public-request-share', shareToken],
    queryFn: async () => {
      const res = await api.get(`/requests/share/${shareToken}`);
      return res.data.data.request;
    },
    enabled: Boolean(shareToken),
  });

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  function handleCopy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <Loader2 className="animate-spin" size={36} color="var(--primary)" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="card" style={{ maxWidth: 540, margin: '60px auto', textAlign: 'center' }}>
        <AlertTriangle size={48} color="#e53935" style={{ margin: '0 auto 12px' }} />
        <h2>Request Not Found or Expired</h2>
        <p className="text-muted" style={{ marginTop: 8 }}>
          This emergency blood request may have already been fulfilled or expired.
        </p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: 20 }}>
          Go to RoktoBondhu Home
        </Link>
      </div>
    );
  }

  const shareMessage = `EMERGENCY: ${request.units_needed} unit(s) of ${request.blood_group} blood urgently needed at ${request.hospital_name || 'Hospital'}, ${request.city || 'Dhaka'}. Can you help?`;

  return (
    <div style={{ maxWidth: 650, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* SOS / Emergency Banner */}
      {request.is_sos ? (
        <div
          style={{
            background: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
            color: '#ffffff',
            padding: '16px 20px',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 4px 14px rgba(185, 28, 28, 0.35)',
            animation: 'pulse 2s infinite',
          }}
        >
          <AlertTriangle size={32} color="#fef08a" />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.02em' }}>
              CRITICAL SOS EMERGENCY ESCALATION
            </div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              This request was escalated to wide-radius immediate broadcast. Donors needed right now.
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Request Card */}
      <div className="card" style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <span className={`badge badge-${(request.urgency || 'NORMAL').toLowerCase()}`} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
            {request.urgency} URGENCY
          </span>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fee2e2', color: '#b91c1c', borderRadius: '50%', width: 80, height: 80, margin: '8px auto' }}>
          <span style={{ fontSize: '2rem', fontWeight: 900 }}>{request.blood_group}</span>
        </div>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 12, color: 'var(--text-main)' }}>
          {request.blood_group} Blood Needed
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: 4 }}>
          <strong>{request.units_needed} unit(s)</strong> needed ({request.accepted_count || 0} accepted)
        </p>

        {/* Details List */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 16,
            margin: '20px 0',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            fontSize: '0.92rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Hospital:</span>
            <strong>{request.hospital_name || 'Hospital Area'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Location:</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={14} color="#b91c1c" />
              <strong>{request.city || 'Dhaka, Bangladesh'}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Status:</span>
            <span style={{ fontWeight: 700, color: request.status === 'OPEN' ? '#16a34a' : '#ea580c' }}>
              {request.status}
            </span>
          </div>
          {request.needed_by && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Needed By:</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={14} color="#ea580c" />
                <span>{new Date(request.needed_by).toLocaleString()}</span>
              </span>
            </div>
          )}
        </div>

        {/* Privacy Protection Notice */}
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 'var(--radius)',
            padding: '12px 16px',
            fontSize: '0.82rem',
            color: '#1e40af',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            textAlign: 'left',
          }}
        >
          <ShieldCheck size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>Patient Privacy Protected:</strong> Patient name and contact telephone numbers are kept private and confidential. Only verified donors who accept this request are granted secure access to patient contact information.
          </span>
        </div>

        {/* CTA Button */}
        <div style={{ marginTop: 24 }}>
          {isAuthenticated ? (
            <Link
              to="/donor/feed"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
            >
              <Heart size={20} />
              <span>I Can Donate (Go to Feed)</span>
            </Link>
          ) : (
            <Link
              to={`/register?redirect=/s/${request.share_token}`}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
            >
              <Heart size={20} />
              <span>I Can Donate Blood (Sign Up / Login)</span>
            </Link>
          )}
        </div>
      </div>

      {/* Social Share Buttons Card */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Share2 size={18} color="var(--primary)" />
          <span>Help Spread the Word</span>
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          Sharing this link on Facebook, WhatsApp, or Telegram directly alerts eligible donors nearby.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {/* Copy Link */}
          <button
            onClick={handleCopy}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {copied ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>

          {/* WhatsApp */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareMessage + ' ' + shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{
              background: '#25D366',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>WhatsApp</span>
          </a>

          {/* Facebook */}
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{
              background: '#1877F2',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>Facebook</span>
          </a>

          {/* Telegram */}
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{
              background: '#229ED9',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>Telegram</span>
          </a>
        </div>
      </div>
    </div>
  );
}
