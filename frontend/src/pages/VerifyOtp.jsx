import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function VerifyOtp() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyOtp, sendOtp } = useAuth();

  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await verifyOtp(phone, otp.trim());
      setSuccessMsg('Phone verified successfully! Redirecting...');
      setTimeout(() => {
        navigate('/donor/profile');
      }, 1200);
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP. Please check server console or resend.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!phone) {
      setError('Please provide a phone number first');
      return;
    }
    setError('');
    setResending(true);
    try {
      await sendOtp(phone);
      setSuccessMsg('A fresh OTP has been sent! Check server console log.');
    } catch (err) {
      setError(err.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: '40px auto' }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', background: 'var(--success-light)', padding: 12, borderRadius: '50%', marginBottom: 12 }}>
            <ShieldCheck size={32} color="var(--success)" />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Verify Phone Number</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Enter the 6-digit OTP code sent to your phone
          </p>
        </div>

        <div style={{ background: '#f8fafc', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <strong>Portfolio / Dev Mode Notice:</strong>
          <br />
          SMS OTP is mocked. Check the Core API terminal output to view your 6-digit code.
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--danger-light)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: '0.88rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--success-light)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: '0.88rem' }}>
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleVerify}>
          <div className="form-group">
            <label className="form-label" htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              className="form-control"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+8801XXXXXXXXX"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="otp">6-Digit Verification Code</label>
            <input
              id="otp"
              type="text"
              maxLength={6}
              className="form-control"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={{ letterSpacing: '4px', fontSize: '1.25rem', textAlign: 'center', fontWeight: 700 }}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            <CheckCircle2 size={18} />
            <span>{loading ? 'Verifying...' : 'Verify Phone'}</span>
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleResend}
            className="btn btn-secondary btn-sm"
            disabled={resending}
            style={{ width: '100%' }}
          >
            <RefreshCw size={14} className={resending ? 'spin' : ''} />
            <span>{resending ? 'Sending...' : 'Resend Code'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
