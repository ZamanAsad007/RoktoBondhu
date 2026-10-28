import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  Building2,
  Package,
  Calendar,
  Users,
  PlusCircle,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Clock,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function OrgDashboard() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'drives' | 'new-drive' | 'profile'

  // Org Profile Query
  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ['myOrg'],
    queryFn: async () => {
      const res = await api.getMyOrg();
      return res?.data;
    },
    retry: false,
  });

  // Inventory Query
  const { data: inventory = [], isLoading: invLoading } = useQuery({
    queryKey: ['orgInventory', org?.id],
    queryFn: async () => {
      if (!org?.id) return [];
      const res = await api.getOrgInventory(org.id);
      return res?.data || [];
    },
    enabled: Boolean(org?.id),
  });

  // Drives Query
  const { data: drives = [], isLoading: drivesLoading } = useQuery({
    queryKey: ['orgDrives'],
    queryFn: async () => {
      const res = await api.getMyDrives();
      return res?.data || [];
    },
    enabled: Boolean(org?.id),
  });

  // Selected drive for attendee checklist
  const [selectedDriveId, setSelectedDriveId] = useState(null);
  const { data: attendees = [] } = useQuery({
    queryKey: ['driveAttendees', selectedDriveId],
    queryFn: async () => {
      if (!selectedDriveId) return [];
      const res = await api.getDriveAttendees(selectedDriveId);
      return res?.data || [];
    },
    enabled: Boolean(selectedDriveId),
  });

  // Update Inventory State
  const [stockEdits, setStockEdits] = useState({});

  const updateInventoryMutation = useMutation({
    mutationFn: (body) => api.updateInventory(body),
    onSuccess: () => {
      showToast('Inventory unit updated successfully!', 'success');
      queryClient.invalidateQueries(['orgInventory']);
    },
    onError: (err) => {
      showToast(err.message || 'Failed to update inventory', 'error');
    },
  });

  // Drive Creation Form State
  const [driveForm, setDriveForm] = useState({
    title: '',
    description: '',
    venueName: '',
    address: '',
    latitude: 23.8103,
    longitude: 90.4125,
    startTime: '',
    endTime: '',
    capacity: 50,
  });

  const createDriveMutation = useMutation({
    mutationFn: (payload) => api.createDrive(payload),
    onSuccess: () => {
      showToast('Blood collection drive scheduled!', 'success');
      setActiveTab('drives');
      queryClient.invalidateQueries(['orgDrives']);
    },
    onError: (err) => {
      showToast(err.message || 'Failed to create drive', 'error');
    },
  });

  // Mark Attendance Mutation
  const markAttendanceMutation = useMutation({
    mutationFn: ({ driveId, userId }) => api.markDriveAttendance(driveId, userId),
    onSuccess: () => {
      showToast('Attendance recorded! Donor stats & certificate credited.', 'success');
      queryClient.invalidateQueries(['driveAttendees', selectedDriveId]);
    },
    onError: (err) => {
      showToast(err.message || 'Failed to record attendance', 'error');
    },
  });

  // Profile Registration Form State
  const [profileForm, setProfileForm] = useState({
    orgName: '',
    registrationNumber: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    latitude: 23.8103,
    longitude: 90.4125,
  });

  const registerOrgMutation = useMutation({
    mutationFn: (payload) => api.registerOrg(payload),
    onSuccess: () => {
      showToast('Organization profile registered! Awaiting admin verification badge.', 'success');
      queryClient.invalidateQueries(['myOrg']);
    },
    onError: (err) => {
      showToast(err.message || 'Failed to register organization', 'error');
    },
  });

  if (orgLoading) {
    return <div style={{ textAlign: 'center', padding: 48 }}>Loading organization details...</div>;
  }

  // If user hasn't registered organization details yet
  if (!org) {
    return (
      <div className="container" style={{ maxWidth: 650, margin: '40px auto', padding: '0 16px' }}>
        <div className="card" style={{ padding: 32 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Building2 size={40} color="#e53935" style={{ margin: '0 auto 8px' }} />
            <h2 style={{ margin: 0, fontWeight: 700 }}>Register Organization</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 6 }}>
              Set up your hospital or blood bank profile to manage live inventories and organize blood drives.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              registerOrgMutation.mutate(profileForm);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div>
              <label className="label">Organization / Hospital Name *</label>
              <input
                className="input"
                required
                value={profileForm.orgName}
                onChange={(e) => setProfileForm({ ...profileForm, orgName: e.target.value })}
                placeholder="e.g. Bangladesh Red Crescent Blood Center"
              />
            </div>
            <div>
              <label className="label">Govt / Directorate License / Reg Number</label>
              <input
                className="input"
                value={profileForm.registrationNumber}
                onChange={(e) => setProfileForm({ ...profileForm, registrationNumber: e.target.value })}
                placeholder="e.g. DGHS-BB-2026-042"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="label">Contact Phone</label>
                <input
                  className="input"
                  value={profileForm.contactPhone}
                  onChange={(e) => setProfileForm({ ...profileForm, contactPhone: e.target.value })}
                  placeholder="+8801700..."
                />
              </div>
              <div>
                <label className="label">Contact Email</label>
                <input
                  className="input"
                  type="email"
                  value={profileForm.contactEmail}
                  onChange={(e) => setProfileForm({ ...profileForm, contactEmail: e.target.value })}
                  placeholder="info@hospital.org"
                />
              </div>
            </div>
            <div>
              <label className="label">Hospital / Center Address</label>
              <input
                className="input"
                value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                placeholder="Street, Area, Dhaka"
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={registerOrgMutation.isPending} style={{ marginTop: 8 }}>
              {registerOrgMutation.isPending ? 'Registering...' : 'Register Organization Profile'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 1050, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header with verified badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>{org.org_name}</h1>
            {org.is_verified ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  background: '#e8f5e9',
                  color: '#2e7d32',
                  borderRadius: 16,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                <ShieldCheck size={16} /> Verified Organization
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  background: '#fff3e0',
                  color: '#e65100',
                  borderRadius: 16,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                <Clock size={16} /> Verification Pending
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', margin: '6px 0 0 0', fontSize: '0.9rem' }}>
            {org.address} • Reg: {org.registration_number || 'N/A'} • {org.contact_phone}
          </p>
        </div>

        {/* Tab switchers */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`btn ${activeTab === 'inventory' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          >
            <Package size={16} />
            <span>Blood Inventory</span>
          </button>
          <button
            onClick={() => setActiveTab('drives')}
            className={`btn ${activeTab === 'drives' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          >
            <Calendar size={16} />
            <span>Drives & Attendees</span>
          </button>
          <button
            onClick={() => setActiveTab('new-drive')}
            className={`btn ${activeTab === 'new-drive' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          >
            <PlusCircle size={16} />
            <span>New Drive</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Blood Inventory */}
      {activeTab === 'inventory' && (
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700 }}>
              Live Blood Group Stock Units
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
              Adjust available reserve units. If units drop below the low-stock threshold, automated alert events are published to alert coordinators.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {BLOOD_GROUPS.map((bg) => {
              const current = inventory.find((i) => i.blood_group === bg);
              const units = stockEdits[bg]?.units ?? current?.units_available ?? 0;
              const threshold = stockEdits[bg]?.threshold ?? current?.low_stock_threshold ?? 5;
              const isLow = units < threshold;

              return (
                <div
                  key={bg}
                  className="card"
                  style={{
                    padding: 16,
                    border: isLow ? '1px solid #ef5350' : '1px solid var(--border)',
                    background: isLow ? 'rgba(239, 83, 80, 0.04)' : 'var(--card-bg)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e53935' }}>{bg}</span>
                    {isLow && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#d32f2f', fontSize: '0.75rem', fontWeight: 600 }}>
                        <AlertTriangle size={14} /> Low Stock Alert
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Units Available:
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="input"
                        value={units}
                        onChange={(e) =>
                          setStockEdits({
                            ...stockEdits,
                            [bg]: { ...stockEdits[bg], units: parseInt(e.target.value, 10) || 0 },
                          })
                        }
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Low Stock Alert Threshold:
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="input"
                        value={threshold}
                        onChange={(e) =>
                          setStockEdits({
                            ...stockEdits,
                            [bg]: { ...stockEdits[bg], threshold: parseInt(e.target.value, 10) || 0 },
                          })
                        }
                      />
                    </div>

                    <button
                      onClick={() =>
                        updateInventoryMutation.mutate({
                          bloodGroup: bg,
                          unitsAvailable: units,
                          lowStockThreshold: threshold,
                        })
                      }
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: 4 }}
                    >
                      Save Units
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Drives & Attendees */}
      {activeTab === 'drives' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedDriveId ? '1fr 1fr' : '1fr', gap: 20 }}>
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 700 }}>My Blood Drives</h3>
            {drives.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                No blood collection drives created yet. Click "New Drive" to organize one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {drives.map((d) => (
                  <div
                    key={d.id}
                    className="card"
                    style={{
                      padding: 16,
                      cursor: 'pointer',
                      border: selectedDriveId === d.id ? '2px solid #e53935' : '1px solid var(--border)',
                    }}
                    onClick={() => setSelectedDriveId(d.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <h4 style={{ margin: 0, fontWeight: 700 }}>{d.title}</h4>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e53935' }}>{d.status}</span>
                    </div>
                    <p style={{ margin: '0 0 8px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {d.venue_name} • {new Date(d.start_time).toLocaleDateString()}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span>RSVPs: <strong>{d.rsvp_count} / {d.capacity}</strong></span>
                      <span style={{ color: '#e53935', fontWeight: 600 }}>Click to manage attendees &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attendee Checklist Column */}
          {selectedDriveId && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  <Users size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Donor Attendees
                </h3>
                <button onClick={() => setSelectedDriveId(null)} className="btn btn-secondary btn-sm">
                  Close
                </button>
              </div>

              {attendees.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
                  No volunteers have RSVP'd to this drive yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {attendees.map((att) => (
                    <div
                      key={att.rsvp_id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: 'var(--bg)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong>{att.name}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Group: {att.blood_group || 'N/A'} • {att.phone}
                        </div>
                      </div>

                      <div>
                        {att.rsvp_status === 'ATTENDED' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2e7d32', fontWeight: 600, fontSize: '0.85rem' }}>
                            <CheckCircle2 size={16} /> Attended & Credited
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              markAttendanceMutation.mutate({
                                driveId: selectedDriveId,
                                userId: att.user_id,
                              })
                            }
                            className="btn btn-primary btn-sm"
                            disabled={markAttendanceMutation.isPending}
                          >
                            Mark Attended
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Create Drive Form */}
      {activeTab === 'new-drive' && (
        <div className="card" style={{ padding: 24, maxWidth: 650, margin: '0 auto' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 700 }}>
            Schedule Blood Collection Drive
          </h3>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createDriveMutation.mutate(driveForm);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div>
              <label className="label">Drive Title *</label>
              <input
                className="input"
                required
                value={driveForm.title}
                onChange={(e) => setDriveForm({ ...driveForm, title: e.target.value })}
                placeholder="e.g. Dhaka University Spring Blood Drive"
              />
            </div>
            <div>
              <label className="label">Description & Instructions</label>
              <textarea
                className="input"
                rows="3"
                value={driveForm.description}
                onChange={(e) => setDriveForm({ ...driveForm, description: e.target.value })}
                placeholder="Special notes for volunteer donors..."
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="label">Venue Name *</label>
                <input
                  className="input"
                  required
                  value={driveForm.venueName}
                  onChange={(e) => setDriveForm({ ...driveForm, venueName: e.target.value })}
                  placeholder="e.g. TSC Auditorium"
                />
              </div>
              <div>
                <label className="label">Donor Capacity Limit *</label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  required
                  value={driveForm.capacity}
                  onChange={(e) => setDriveForm({ ...driveForm, capacity: parseInt(e.target.value, 10) || 1 })}
                />
              </div>
            </div>
            <div>
              <label className="label">Address *</label>
              <input
                className="input"
                required
                value={driveForm.address}
                onChange={(e) => setDriveForm({ ...driveForm, address: e.target.value })}
                placeholder="Full venue address"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="label">Start Date & Time *</label>
                <input
                  type="datetime-local"
                  className="input"
                  required
                  value={driveForm.startTime}
                  onChange={(e) => setDriveForm({ ...driveForm, startTime: new Date(e.target.value).toISOString() })}
                />
              </div>
              <div>
                <label className="label">End Date & Time *</label>
                <input
                  type="datetime-local"
                  className="input"
                  required
                  value={driveForm.endTime}
                  onChange={(e) => setDriveForm({ ...driveForm, endTime: new Date(e.target.value).toISOString() })}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={createDriveMutation.isPending} style={{ marginTop: 8 }}>
              {createDriveMutation.isPending ? 'Scheduling...' : 'Create & Publish Blood Drive'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
