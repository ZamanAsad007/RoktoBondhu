import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import MapPicker from '../components/MapPicker';
import {
  Droplet,
  Hospital,
  AlertTriangle,
  User,
  Clock,
  Phone,
  PlusCircle,
  AlertCircle,
} from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function CreateRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tomorrow by default for needed_by
  const defaultNeededBy = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  const [formData, setFormData] = useState({
    patientName: '',
    bloodGroup: 'O+',
    unitsNeeded: 1,
    hospitalName: '',
    city: 'Dhaka',
    latitude: 23.8103,
    longitude: 90.4125,
    urgency: 'URGENT', // NORMAL | URGENT | CRITICAL
    neededBy: defaultNeededBy,
    contactPhone: user?.phone || '+880',
  });

  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (body) => api.createBloodRequest(body),
    onSuccess: (res) => {
      const createdId = res.data?.request?.id || res.data?.id;
      if (createdId) {
        navigate(`/requests/${createdId}`);
      } else {
        navigate('/requests');
      }
    },
    onError: (err) => {
      setError(err.message || 'Failed to submit blood request. You may have hit the daily 3-request rate limit.');
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const payload = {
      patientName: formData.patientName.trim(),
      bloodGroup: formData.bloodGroup,
      unitsNeeded: parseInt(formData.unitsNeeded, 10),
      hospitalName: formData.hospitalName.trim(),
      city: formData.city.trim(),
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      urgency: formData.urgency,
      neededBy: new Date(formData.neededBy).toISOString(),
      contactPhone: formData.contactPhone.trim(),
    };

    createMutation.mutate(payload);
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Droplet size={28} color="var(--primary)" fill="var(--primary)" />
          <span>Request Emergency Blood</span>
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Broadcast your need to compatible, eligible donors within increasing radius waves.
        </p>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 20,
            background: 'var(--danger-light)',
            color: 'var(--danger)',
            fontSize: '0.92rem',
            fontWeight: 500,
          }}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        {/* Urgency Selector */}
        <div className="form-group">
          <label className="form-label" style={{ marginBottom: 8 }}>
            Emergency Urgency Level
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              {
                id: 'NORMAL',
                label: 'Normal',
                desc: 'Within 48h (Scheduled surgery)',
                badge: 'badge-normal',
              },
              {
                id: 'URGENT',
                label: 'Urgent',
                desc: 'Within 24h (Urgent inpatient)',
                badge: 'badge-urgent',
              },
              {
                id: 'CRITICAL',
                label: 'Critical (SOS)',
                desc: 'Immediate (ICU / Hemorrhage)',
                badge: 'badge-critical',
              },
            ].map((u) => {
              const selected = formData.urgency === u.id;
              return (
                <div
                  key={u.id}
                  onClick={() => setFormData((prev) => ({ ...prev, urgency: u.id }))}
                  style={{
                    padding: 12,
                    borderRadius: 'var(--radius-sm)',
                    border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                    background: selected ? 'var(--primary-light)' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{u.label}</span>
                    <span className={`badge ${u.badge}`} style={{ fontSize: '0.65rem' }}>
                      {u.id}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {u.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Patient and Blood Group */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="patientName">
              <User size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Patient Name
            </label>
            <input
              id="patientName"
              type="text"
              className="form-control"
              placeholder="e.g. Fahim Ahmed"
              value={formData.patientName}
              onChange={(e) => setFormData((prev) => ({ ...prev, patientName: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="bloodGroup">Blood Group</label>
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
            <label className="form-label" htmlFor="unitsNeeded">Units Needed</label>
            <input
              id="unitsNeeded"
              type="number"
              min={1}
              max={10}
              className="form-control"
              value={formData.unitsNeeded}
              onChange={(e) => setFormData((prev) => ({ ...prev, unitsNeeded: e.target.value }))}
              required
            />
          </div>
        </div>

        {/* Hospital & City */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="hospitalName">
              <Hospital size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Hospital Name
            </label>
            <input
              id="hospitalName"
              type="text"
              className="form-control"
              placeholder="e.g. Dhaka Medical College Hospital"
              value={formData.hospitalName}
              onChange={(e) => setFormData((prev) => ({ ...prev, hospitalName: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="city">City / District</label>
            <input
              id="city"
              type="text"
              className="form-control"
              placeholder="e.g. Dhaka"
              value={formData.city}
              onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
              required
            />
          </div>
        </div>

        {/* Location Picker */}
        <div className="form-group">
          <MapPicker
            latitude={formData.latitude}
            longitude={formData.longitude}
            city={formData.city}
            onCityChange={(city) => setFormData((prev) => ({ ...prev, city }))}
            onChange={(lat, lng) => setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
          />
        </div>

        {/* Needed By and Contact Phone */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="neededBy">
              <Clock size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Needed By (Date & Time)
            </label>
            <input
              id="neededBy"
              type="datetime-local"
              className="form-control"
              value={formData.neededBy}
              onChange={(e) => setFormData((prev) => ({ ...prev, neededBy: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="contactPhone">
              <Phone size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Contact Phone Number
            </label>
            <input
              id="contactPhone"
              type="tel"
              className="form-control"
              placeholder="+88017XXXXXXXX"
              value={formData.contactPhone}
              onChange={(e) => setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))}
              required
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'block', marginTop: 4 }}>
              🔒 Protected: Only revealed to donors who explicitly accept.
            </small>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg"
          style={{ width: '100%', marginTop: 12 }}
          disabled={createMutation.isPending}
        >
          <PlusCircle size={20} />
          <span>{createMutation.isPending ? 'Publishing Request...' : 'Publish Request & Dispatch Wave 1'}</span>
        </button>
      </form>
    </div>
  );
}
