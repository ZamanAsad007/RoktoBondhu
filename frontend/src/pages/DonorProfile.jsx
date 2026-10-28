import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import MapPicker from '../components/MapPicker';
import { urlBase64ToUint8Array } from '../utils/push';
import { User, Droplet, Calendar, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight, Save, Clock, Bell, Smartphone, Mail, Globe } from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function DonorProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    bloodGroup: 'O+',
    dateOfBirth: '1995-01-01',
    city: 'Dhaka',
    latitude: 23.8103,
    longitude: 90.4125,
    lastDonatedAt: '',
    available: true,
  });

  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Fetch current profile
  const { data: profileData, isLoading, error: queryError } = useQuery({
    queryKey: ['donorProfile'],
    queryFn: async () => {
      const res = await api.getDonorProfile();
      return res.data?.profile || null;
    },
  });

  // Fetch notification preferences (Phase 20)
  const [preferences, setPreferences] = useState({
    in_app: true,
    email: true,
    sms: false,
    push: true,
  });

  const { data: prefData } = useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: async () => {
      const res = await api.getNotificationPreferences();
      return res.data || null;
    },
  });

  useEffect(() => {
    if (prefData) {
      setPreferences({
        in_app: prefData.in_app !== undefined ? prefData.in_app : true,
        email: prefData.email !== undefined ? prefData.email : true,
        sms: prefData.sms !== undefined ? prefData.sms : false,
        push: prefData.push !== undefined ? prefData.push : true,
      });
    }
  }, [prefData]);

  const updatePreferencesMutation = useMutation({
    mutationFn: (newPrefs) => api.updateNotificationPreferences(newPrefs),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
      setFeedback({ type: 'success', message: 'Notification preferences saved successfully!' });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to update preferences' });
    },
  });

  const handleTogglePreference = async (key) => {
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);

    // If enabling push, request browser permission and register subscription
    if (key === 'push' && updated.push && 'serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const reg = await navigator.serviceWorker.ready;
          const vapidRes = await api.getVapidPublicKey();
          const publicKey = vapidRes.data?.publicKey;
          if (publicKey) {
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey),
            });
            await api.subscribePush(sub.toJSON());
          }
        } else {
          setFeedback({ type: 'error', message: 'Browser notification permission denied.' });
          setPreferences((prev) => ({ ...prev, push: false }));
          return;
        }
      } catch (e) {
        console.warn('[Push] Error subscribing to push:', e);
      }
    }

    updatePreferencesMutation.mutate(updated);
  };

  useEffect(() => {
    if (profileData) {
      setFormData({
        bloodGroup: profileData.blood_group || 'O+',
        dateOfBirth: profileData.date_of_birth ? profileData.date_of_birth.substring(0, 10) : '1995-01-01',
        city: profileData.city || 'Dhaka',
        latitude: profileData.latitude !== undefined ? Number(profileData.latitude) : 23.8103,
        longitude: profileData.longitude !== undefined ? Number(profileData.longitude) : 90.4125,
        lastDonatedAt: profileData.last_donated_at ? profileData.last_donated_at.substring(0, 10) : '',
        available: profileData.available !== undefined ? profileData.available : true,
      });
    }
  }, [profileData]);

  // Mutation for updating profile
  const updateProfileMutation = useMutation({
    mutationFn: (body) => api.updateDonorProfile(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donorProfile'] });
      setFeedback({ type: 'success', message: 'Donor profile updated successfully!' });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to update profile.' });
    },
  });

  // Mutation for toggling availability
  const toggleAvailabilityMutation = useMutation({
    mutationFn: (newVal) => api.setDonorAvailability(newVal),
    onSuccess: (res, newVal) => {
      setFormData((prev) => ({ ...prev, available: newVal }));
      queryClient.invalidateQueries({ queryKey: ['donorProfile'] });
      setFeedback({
        type: 'success',
        message: newVal
          ? 'You are now marked as AVAILABLE to receive emergency alerts.'
          : 'You are now marked as UNAVAILABLE. You will not receive donor notifications.',
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to update availability.' });
    },
  });

  function handleAvailabilityToggle() {
    const nextVal = !formData.available;
    toggleAvailabilityMutation.mutate(nextVal);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    const payload = {
      bloodGroup: formData.bloodGroup,
      dateOfBirth: formData.dateOfBirth,
      city: formData.city,
      latitude: formData.latitude,
      longitude: formData.longitude,
      lastDonatedAt: formData.lastDonatedAt || null,
      available: formData.available,
    };

    updateProfileMutation.mutate(payload);
  }

  // Calculate days since last donation
  let daysSinceDonation = null;
  let isEligibleByInterval = true;
  if (formData.lastDonatedAt) {
    const lastDate = new Date(formData.lastDonatedAt);
    const diffTime = Math.abs(Date.now() - lastDate.getTime());
    daysSinceDonation = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    isEligibleByInterval = daysSinceDonation >= 90;
  }

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 40 }}>Loading donor profile...</div>;
  }

  return (
    <div style={{ maxWidth: 650, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Donor Profile & Availability</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Manage your blood group, geo-matching location, and emergency readiness.
        </p>
      </div>

      {feedback.message && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 20,
            background: feedback.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)',
            fontSize: '0.92rem',
            fontWeight: 500,
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Instant Availability Switch Card */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          borderLeft: `5px solid ${formData.available ? 'var(--success)' : 'var(--border)'}`,
          background: formData.available ? '#f0fdf4' : '#ffffff',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: formData.available ? 'var(--success)' : 'var(--text-muted)',
              }}
            />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              {formData.available ? 'Available to Donate Blood' : 'Unavailable (Not receiving alerts)'}
            </h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            {formData.available
              ? 'You will be included in matching waves when compatible patients nearby need blood.'
              : 'Toggle ON when you are ready to be matched with nearby requests.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleAvailabilityToggle}
          className={`btn ${formData.available ? 'btn-success' : 'btn-secondary'}`}
          disabled={toggleAvailabilityMutation.isPending}
          style={{ minWidth: 120 }}
        >
          {formData.available ? (
            <>
              <ToggleRight size={20} />
              <span>Active</span>
            </>
          ) : (
            <>
              <ToggleLeft size={20} />
              <span>Offline</span>
            </>
          )}
        </button>
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleSubmit} className="card">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16 }}>Profile Details</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="bloodGroup">
              <Droplet size={16} color="var(--primary)" style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Blood Group
            </label>
            <select
              id="bloodGroup"
              className="form-control"
              value={formData.bloodGroup}
              onChange={(e) => setFormData((prev) => ({ ...prev, bloodGroup: e.target.value }))}
              required
            >
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="city">City / District</label>
            <input
              id="city"
              type="text"
              className="form-control"
              value={formData.city}
              onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
              placeholder="e.g. Dhaka"
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="dateOfBirth">
              <Calendar size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Date of Birth
            </label>
            <input
              id="dateOfBirth"
              type="date"
              className="form-control"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="lastDonatedAt">
              <Clock size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Last Donated Date
            </label>
            <input
              id="lastDonatedAt"
              type="date"
              className="form-control"
              value={formData.lastDonatedAt}
              onChange={(e) => setFormData((prev) => ({ ...prev, lastDonatedAt: e.target.value }))}
            />
            {daysSinceDonation !== null && (
              <small
                style={{
                  display: 'block',
                  marginTop: 4,
                  fontSize: '0.8rem',
                  color: isEligibleByInterval ? 'var(--success)' : 'var(--danger)',
                  fontWeight: 600,
                }}
              >
                {daysSinceDonation} days ago {isEligibleByInterval ? '(Eligible to donate)' : '(Must wait 90 days)'}
              </small>
            )}
          </div>
        </div>

        {/* Location Picker */}
        <div className="form-group" style={{ marginTop: 8 }}>
          <MapPicker
            latitude={formData.latitude}
            longitude={formData.longitude}
            city={formData.city}
            onCityChange={(city) => setFormData((prev) => ({ ...prev, city }))}
            onChange={(lat, lng) => setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
          />
          <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginTop: 6 }}>
            Privacy Note: Requesters only see your approximate distance (e.g. "about 3 km away"). Your exact coordinates are never revealed.
          </small>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg"
          style={{ width: '100%', marginTop: 12 }}
          disabled={updateProfileMutation.isPending}
        >
          <Save size={18} />
          <span>{updateProfileMutation.isPending ? 'Saving...' : 'Save Donor Profile'}</span>
        </button>
      </form>

      {/* Weekly Availability Windows (Phase 18) */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Clock size={18} color="var(--primary)" />
          <span>Weekly Availability Windows</span>
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 16px 0' }}>
          Specify preferred hours (e.g. evening hours when you are free from work/study). Smarter matching v2 prioritizes alerting you during your active availability windows.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Available 24/7 (Anytime)', windows: [] },
            {
              label: 'Evenings Only (18:00 - 22:00)',
              windows: [
                { day: 'sunday', start: '18:00', end: '22:00' },
                { day: 'monday', start: '18:00', end: '22:00' },
                { day: 'tuesday', start: '18:00', end: '22:00' },
                { day: 'wednesday', start: '18:00', end: '22:00' },
                { day: 'thursday', start: '18:00', end: '22:00' },
                { day: 'friday', start: '18:00', end: '22:00' },
                { day: 'saturday', start: '18:00', end: '22:00' },
              ],
            },
            {
              label: 'Weekends Only (Fri - Sat)',
              windows: [
                { day: 'friday', start: '08:00', end: '22:00' },
                { day: 'saturday', start: '08:00', end: '22:00' },
              ],
            },
          ].map((preset, idx) => (
            <button
              key={idx}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  await api.updateAvailabilityWindows(preset.windows);
                  setFeedback({ type: 'success', message: `Availability window set to: ${preset.label}` });
                } catch (err) {
                  setFeedback({ type: 'error', message: err.message || 'Failed to update windows' });
                }
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notification Channel Preferences & Web Push (Phase 20) */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Bell size={18} color="var(--primary)" />
          <span>Notification & Alert Channel Preferences</span>
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 16px 0' }}>
          Select which channels you want to receive emergency blood match invitations and system updates through.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {/* In-App */}
          <div
            onClick={() => handleTogglePreference('in_app')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 14,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: preferences.in_app ? '#f0fdf4' : '#ffffff',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bell size={18} color={preferences.in_app ? 'var(--success)' : 'var(--text-muted)'} />
              <div>
                <strong style={{ fontSize: '0.9rem' }}>In-App Notifications</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Real-time inbox and badges</div>
              </div>
            </div>
            {preferences.in_app ? (
              <ToggleRight size={26} color="var(--success)" />
            ) : (
              <ToggleLeft size={26} color="var(--text-muted)" />
            )}
          </div>

          {/* Web Push */}
          <div
            onClick={() => handleTogglePreference('push')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 14,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: preferences.push ? '#f0fdf4' : '#ffffff',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Globe size={18} color={preferences.push ? 'var(--success)' : 'var(--text-muted)'} />
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Browser Web Push</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Instant home screen push alerts</div>
              </div>
            </div>
            {preferences.push ? (
              <ToggleRight size={26} color="var(--success)" />
            ) : (
              <ToggleLeft size={26} color="var(--text-muted)" />
            )}
          </div>

          {/* Email */}
          <div
            onClick={() => handleTogglePreference('email')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 14,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: preferences.email ? '#f0fdf4' : '#ffffff',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Mail size={18} color={preferences.email ? 'var(--success)' : 'var(--text-muted)'} />
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Email Alerts</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Urgent requisition summaries</div>
              </div>
            </div>
            {preferences.email ? (
              <ToggleRight size={26} color="var(--success)" />
            ) : (
              <ToggleLeft size={26} color="var(--text-muted)" />
            )}
          </div>

          {/* SMS */}
          <div
            onClick={() => handleTogglePreference('sms')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 14,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: preferences.sms ? '#f0fdf4' : '#ffffff',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Smartphone size={18} color={preferences.sms ? 'var(--success)' : 'var(--text-muted)'} />
              <div>
                <strong style={{ fontSize: '0.9rem' }}>SMS Text Messages</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Direct mobile SMS alerts</div>
              </div>
            </div>
            {preferences.sms ? (
              <ToggleRight size={26} color="var(--success)" />
            ) : (
              <ToggleLeft size={26} color="var(--text-muted)" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
