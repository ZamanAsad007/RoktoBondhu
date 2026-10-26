import React from 'react';
import { MapPin, Navigation, Compass } from 'lucide-react';

const CITY_PRESETS = [
  { name: 'Dhaka', lat: 23.8103, lng: 90.4125 },
  { name: 'Chittagong', lat: 22.3569, lng: 91.7832 },
  { name: 'Sylhet', lat: 24.8949, lng: 91.8687 },
  { name: 'Rajshahi', lat: 24.3636, lng: 88.6241 },
  { name: 'Khulna', lat: 22.8456, lng: 89.5403 },
  { name: 'Barisal', lat: 22.701, lng: 90.3535 },
  { name: 'Rangpur', lat: 25.7439, lng: 89.2752 },
];

export default function MapPicker({ latitude, longitude, onChange, city, onCityChange }) {
  function handlePresetClick(preset) {
    onChange(preset.lat, preset.lng);
    if (onCityChange) {
      onCityChange(preset.name);
    }
  }

  function handleCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          onChange(
            parseFloat(position.coords.latitude.toFixed(6)),
            parseFloat(position.coords.longitude.toFixed(6))
          );
        },
        (error) => {
          alert('Could not access current location: ' + error.message);
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  }

  // Interactive coordinate map canvas
  function handleMapClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Approximate mapping Bangladesh bounds:
    // Lat: 20.5 to 26.5 (Y inverted)
    // Lng: 88.0 to 92.8 (X)
    const lat = 26.5 - (y / rect.height) * (26.5 - 20.5);
    const lng = 88.0 + (x / rect.width) * (92.8 - 88.0);

    onChange(parseFloat(lat.toFixed(4)), parseFloat(lng.toFixed(4)));
  }

  // Compute marker position on canvas (percentage)
  const markerX = Math.min(Math.max(((longitude - 88.0) / (92.8 - 88.0)) * 100, 0), 100);
  const markerY = Math.min(Math.max(((26.5 - latitude) / (26.5 - 20.5)) * 100, 0), 100);

  return (
    <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={16} color="var(--primary)" />
          <span>Location Picker (Latitude & Longitude)</span>
        </label>
        <button
          type="button"
          onClick={handleCurrentLocation}
          className="btn btn-secondary btn-sm"
          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
        >
          <Navigation size={14} color="var(--primary)" />
          <span>Use My GPS</span>
        </button>
      </div>

      {/* Quick City Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {CITY_PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => handlePresetClick(p)}
            className={`btn btn-sm ${city === p.name ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '3px 8px', fontSize: '0.78rem', minHeight: 30 }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Visual Interactive Map Representation */}
      <div
        onClick={handleMapClick}
        style={{
          height: 180,
          background: 'radial-gradient(ellipse at center, #e0f2fe 0%, #cbd5e1 100%)',
          borderRadius: 'var(--radius-sm)',
          position: 'relative',
          cursor: 'crosshair',
          overflow: 'hidden',
          border: '1px solid #94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Click anywhere to drop or move your location pin"
      >
        <div style={{ position: 'absolute', top: 8, left: 10, fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
          Interactive Map Pin (Click to reposition)
        </div>

        {/* Grid lines */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

        {/* Pin marker */}
        <div
          style={{
            position: 'absolute',
            left: `${markerX}%`,
            top: `${markerY}%`,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transition: 'all 0.15s ease-out',
          }}
        >
          <MapPin size={28} color="#e53935" fill="#e53935" />
          <span style={{ background: '#0f172a', color: '#fff', fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap', marginTop: -4 }}>
            {latitude.toFixed(2)}, {longitude.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Manual Numeric Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Latitude</label>
          <input
            type="number"
            step="0.0001"
            className="form-control"
            value={latitude}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0, longitude)}
            style={{ padding: '6px 10px', fontSize: '0.88rem', minHeight: 36 }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Longitude</label>
          <input
            type="number"
            step="0.0001"
            className="form-control"
            value={longitude}
            onChange={(e) => onChange(latitude, parseFloat(e.target.value) || 0)}
            style={{ padding: '6px 10px', fontSize: '0.88rem', minHeight: 36 }}
          />
        </div>
      </div>
    </div>
  );
}
