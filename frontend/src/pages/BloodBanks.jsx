import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Building2, MapPin, Phone, Mail, ShieldCheck, AlertCircle, Droplet, Search } from 'lucide-react';

export default function BloodBanks() {
  const [coords, setCoords] = useState({ latitude: 23.8103, longitude: 90.4125 }); // Default Dhaka
  const [radiusKm, setRadiusKm] = useState(15);
  const [selectedGroup, setSelectedGroup] = useState('');

  const { data: bloodBanks = [], isLoading, refetch } = useQuery({
    queryKey: ['bloodBanks', coords.latitude, coords.longitude, radiusKm, selectedGroup],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        latitude: coords.latitude,
        longitude: coords.longitude,
        radiusKm,
      });
      if (selectedGroup) {
        searchParams.append('bloodGroup', selectedGroup);
      }
      const res = await api.getNearbyBloodBanks(searchParams.toString());
      return res?.data || [];
    },
  });

  function handleUseCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          refetch();
        },
        () => {
          alert('Unable to retrieve your location. Using default location.');
        }
      );
    }
  }

  return (
    <div className="container" style={{ maxWidth: 1050, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
          <Building2 color="#e53935" size={28} />
          <span>Blood Banks & Inventory</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
          Search accredited blood banks near you, check real-time stock levels, and find emergency reserves.
        </p>
      </div>

      {/* Filter and Geo Bar */}
      <div className="card" style={{ padding: 20, marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', background: 'var(--card-bg)' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Blood Group Filter
          </label>
          <select
            className="input"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="">All Blood Groups</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((grp) => (
              <option key={grp} value={grp}>{grp}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 180px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Search Radius: {radiusKm} km
          </label>
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <button
            onClick={handleUseCurrentLocation}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <MapPin size={16} />
            <span>My Location</span>
          </button>
        </div>
      </div>

      {/* Blood Bank List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <Droplet className="spin" size={32} color="#e53935" />
          <p style={{ marginTop: 12 }}>Finding nearby blood banks and checking inventory...</p>
        </div>
      ) : bloodBanks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, background: 'var(--card-bg)' }}>
          <AlertCircle size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3>No Blood Banks Found</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: 450, margin: '8px auto 0' }}>
            Try increasing the search radius or resetting the blood group filter.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {bloodBanks.map((bank) => (
            <div key={bank.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                    {bank.org_name}
                  </h3>
                  {bank.is_verified && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        background: '#e8f5e9',
                        color: '#2e7d32',
                        borderRadius: 12,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                      title="Admin Verified Blood Bank"
                    >
                      <ShieldCheck size={14} /> Verified
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 4 }}>
                  <MapPin size={14} />
                  <span>{bank.address || 'Address on file'} ({bank.distance_km} km away)</span>
                </div>

                {bank.contact_phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 12 }}>
                    <Phone size={14} />
                    <a href={`tel:${bank.contact_phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {bank.contact_phone}
                    </a>
                  </div>
                )}

                {/* Stock Level Chips */}
                <div style={{ marginTop: 14 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Current Blood Stock (Units)
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {bank.inventory && bank.inventory.length > 0 ? (
                      bank.inventory.map((inv) => (
                        <div
                          key={inv.blood_group}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: inv.is_low_stock ? '#ffebee' : '#f1f8e9',
                            color: inv.is_low_stock ? '#c62828' : '#33691e',
                            border: `1px solid ${inv.is_low_stock ? '#ffcdd2' : '#dcedc8'}`,
                          }}
                          title={inv.is_low_stock ? 'Low stock threshold reached' : 'Adequate units available'}
                        >
                          <span>{inv.blood_group}</span>
                          <span style={{ opacity: 0.85 }}>{inv.units_available} units</span>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No inventory data listed yet
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <a
                  href={`tel:${bank.contact_phone}`}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                >
                  <Phone size={14} />
                  <span>Call Blood Bank</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
