import React, { useState } from 'react';
import { MapPin, AlertTriangle, ShieldCheck, Flame, Info } from 'lucide-react';

export default function HeatmapGrid({ grid = [] }) {
  const [selectedCell, setSelectedCell] = useState(null);

  // Bangladesh Bounds
  const MIN_LAT = 20.5;
  const MAX_LAT = 26.5;
  const MIN_LNG = 88.0;
  const MAX_LNG = 92.8;

  function getX(lng) {
    return Math.min(Math.max(((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * 100, 2), 98);
  }

  function getY(lat) {
    return Math.min(Math.max(((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * 100, 2), 98);
  }

  function getCellColor(cell) {
    if (cell.shortageRisk || cell.supplyDemandRatio < 0.8) {
      return { bg: 'rgba(239, 68, 68, 0.75)', border: '#b91c1c', text: '#fee2e2' };
    }
    if (cell.supplyDemandRatio < 1.2) {
      return { bg: 'rgba(245, 158, 11, 0.75)', border: '#d97706', text: '#fef3c7' };
    }
    return { bg: 'rgba(16, 185, 129, 0.75)', border: '#059669', text: '#d1fae5' };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Map Canvas Card */}
      <div
        className="card"
        style={{
          position: 'relative',
          padding: 0,
          overflow: 'hidden',
          background: '#0f172a',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* Map Header Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 16,
            zIndex: 10,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(6px)',
            padding: '8px 14px',
            borderRadius: 8,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Flame size={18} color="#ef4444" />
          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Geographic Demand & Supply Heatmap</span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({grid.length} active cells)</span>
        </div>

        {/* Legend */}
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: 16,
            zIndex: 10,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(6px)',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: '0.78rem',
            color: '#e2e8f0',
            display: 'flex',
            gap: 14,
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }}></span>
            Shortage Risk (&lt;0.8x)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }}></span>
            Tight Supply (0.8-1.2x)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }}></span>
            Adequate Supply (&gt;1.2x)
          </span>
        </div>

        {/* Interactive Coordinate Grid */}
        <div
          style={{
            height: 380,
            position: 'relative',
            background: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #0f172a 100%)',
          }}
        >
          {/* Subtle Grid Lines */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#fff" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gridPattern)" />
          </svg>

          {/* Render Aggregated Cells */}
          {grid.map((cell, idx) => {
            const posX = getX(cell.lng);
            const posY = getY(cell.lat);
            const colors = getCellColor(cell);
            const size = Math.max(Math.min(24 + cell.requestCount * 4, 48), 24);

            return (
              <div
                key={`${cell.lat}_${cell.lng}_${idx}`}
                onClick={() => setSelectedCell(cell)}
                title={`${cell.city}: ${cell.requestCount} requests, ${cell.eligibleDonors} donors`}
                style={{
                  position: 'absolute',
                  left: `${posX}%`,
                  top: `${posY}%`,
                  transform: 'translate(-50%, -50%)',
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  background: colors.bg,
                  border: `2px solid ${colors.border}`,
                  boxShadow: cell.shortageRisk
                    ? '0 0 16px rgba(239, 68, 68, 0.8)'
                    : '0 0 8px rgba(0,0,0,0.3)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  transition: 'all 0.2s ease',
                  zIndex: cell.shortageRisk ? 5 : 2,
                }}
              >
                {cell.requestCount}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Cell Details Drawer */}
      {selectedCell && (
        <div
          className="card"
          style={{
            padding: 16,
            background: '#f8fafc',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
              <MapPin size={18} color="var(--primary)" />
              <span>
                {selectedCell.city} ({selectedCell.lat.toFixed(3)}, {selectedCell.lng.toFixed(3)})
              </span>
            </h4>
            <button
              onClick={() => setSelectedCell(null)}
              className="btn btn-sm btn-secondary"
              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
            >
              Close
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
            <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Requests</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{selectedCell.requestCount}</div>
            </div>
            <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Requests</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--danger)' }}>
                {selectedCell.activeRequests}
              </div>
            </div>
            <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Eligible Donors</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>
                {selectedCell.eligibleDonors}
              </div>
            </div>
            <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supply/Demand Ratio</span>
              <div
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: selectedCell.supplyDemandRatio < 1.0 ? 'var(--danger)' : 'var(--success)',
                }}
              >
                {selectedCell.supplyDemandRatio}x
              </div>
            </div>
          </div>

          {selectedCell.shortageRisk && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 6,
                color: '#991b1b',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={16} />
              <span>
                <strong>Critical Shortage Risk:</strong> Active patient requests exceed available donor supply in this grid zone.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
