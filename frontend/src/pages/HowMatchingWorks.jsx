import React from 'react';
import {
  Radio,
  Target,
  ShieldCheck,
  Zap,
  Lock,
  Clock,
  Compass,
  ArrowRight,
  CheckCircle,
  FileText,
  AlertTriangle,
  Award,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HowMatchingWorks() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', padding: '32px 16px', background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', marginBottom: 16 }}>
          <Radio size={16} />
          <span>Distributed Concurrency & Geo-Matching Architecture</span>
        </div>
        <h1 style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 12px 0' }}>
          How RoktoBondhu Matching Works
        </h1>
        <p style={{ maxWidth: 680, margin: '0 auto', color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: 1.6 }}>
          Learn how RoktoBondhu delivers critical blood to patients within minutes while eliminating spam blasts,
          preventing concurrency races, and protecting user privacy.
        </p>
      </div>

      {/* 1. Proximity Waves */}
      <div className="card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#fee2e2', padding: 10, borderRadius: 12, color: 'var(--primary)' }}>
            <Compass size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>1. Automated Proximity Expansion Waves</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Expanding geographic rings powered by PostGIS & BullMQ</span>
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.95rem' }}>
          Rather than broadcasting an emergency to thousands of distant donors simultaneously (causing alert fatigue and hospital congestion),
          RoktoBondhu searches in expanding geographic concentric rings. Nearby donors are alerted first; if slots remain unfulfilled after the wave timeout,
          the system expands outwards automatically.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 20 }}>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span className="badge badge-normal" style={{ marginBottom: 8 }}>Wave 1: Immediate</span>
            <h4 style={{ margin: '4px 0', fontSize: '1.1rem', fontWeight: 800 }}>0 – 5 km Radius</h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Immediate push/Telegram alert to donors within walking or short driving distance.
            </p>
          </div>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span className="badge badge-normal" style={{ marginBottom: 8 }}>Wave 2: 10-60 min</span>
            <h4 style={{ margin: '4px 0', fontSize: '1.1rem', fontWeight: 800 }}>5 – 10 km Radius</h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Radius expands automatically if request remains unfulfilled after wave timeout.
            </p>
          </div>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span className="badge badge-urgent" style={{ marginBottom: 8 }}>Wave 3: Metropolitan</span>
            <h4 style={{ margin: '4px 0', fontSize: '1.1rem', fontWeight: 800 }}>10 – 25 km Radius</h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Wider city-wide search covering donor networks across neighboring sectors.
            </p>
          </div>
          <div style={{ background: '#fef2f2', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid #fca5a5' }}>
            <span className="badge badge-critical" style={{ marginBottom: 8 }}>SOS Escalation</span>
            <h4 style={{ margin: '4px 0', fontSize: '1.1rem', fontWeight: 800, color: '#991b1b' }}>25 – 50 km+</h4>
            <p style={{ fontSize: '0.82rem', color: '#7f1d1d', margin: 0 }}>
              Critical emergency escalation triggered manually or automatically with public share pages.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Smart Candidate Ranking */}
      <div className="card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#eff6ff', padding: 10, borderRadius: 12, color: '#2563eb' }}>
            <Target size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>2. Smart Candidate Ranking Engine (V2)</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Multi-factor scoring prioritizing reliability and readiness</span>
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.95rem' }}>
          When dozens of donors are eligible within the radius, RoktoBondhu ranks candidates with a multi-objective scoring formula
          so that the most reliable, prompt donors are notified first:
        </p>

        <div style={{ background: '#1e293b', color: '#f8fafc', padding: 18, borderRadius: 10, fontFamily: 'monospace', fontSize: '0.92rem', marginBottom: 20 }}>
          Score = (0.35 × Proximity) + (0.25 × ReliabilityScore) + (0.15 × ResponseSpeed) + (0.15 × Recency) + (0.10 × VerificationBonus)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, fontSize: '0.88rem' }}>
          <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <strong>Proximity (35%):</strong> Distance calculated via PostGIS spherical geometry.
          </div>
          <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <strong>Reliability (25%):</strong> Dynamic rating based on confirmed donations vs. no-shows.
          </div>
          <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <strong>Response Speed (15%):</strong> Historical minutes to respond to emergency invitations.
          </div>
          <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <strong>Recency (15%):</strong> Cooldown window balancing donor fatigue and readiness.
          </div>
        </div>
      </div>

      {/* 3. Strict Concurrency & State Machines */}
      <div className="card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#ecfdf5', padding: 10, borderRadius: 12, color: '#059669' }}>
            <Lock size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>3. Race-Proof Concurrency & State Machine</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Row-level locking ensuring exactly N units are accepted</span>
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.95rem' }}>
          In an emergency, multiple matched donors may tap "Accept" on their smartphones in the exact same millisecond.
          RoktoBondhu guarantees transactional consistency through PostgreSQL row-level locks:
        </p>

        <div style={{ background: '#0f172a', color: '#e2e8f0', padding: 16, borderRadius: 8, fontSize: '0.84rem', fontFamily: 'monospace', overflowX: 'auto', marginBottom: 20 }}>
          <span style={{ color: '#94a3b8' }}>-- Transactional Acceptance Isolation</span><br />
          <span style={{ color: '#f43f5e' }}>BEGIN;</span><br />
          <span style={{ color: '#38bdf8' }}>SELECT</span> * <span style={{ color: '#38bdf8' }}>FROM</span> blood_requests <span style={{ color: '#38bdf8' }}>WHERE</span> id = $1 <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>FOR UPDATE;</span><br />
          <span style={{ color: '#94a3b8' }}>-- Verify currently accepted matches &lt; units_needed</span><br />
          <span style={{ color: '#38bdf8' }}>UPDATE</span> request_matches <span style={{ color: '#38bdf8' }}>SET</span> status = <span style={{ color: '#10b981' }}>'ACCEPTED'</span> <span style={{ color: '#38bdf8' }}>WHERE</span> id = $2;<br />
          <span style={{ color: '#f43f5e' }}>COMMIT;</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: 700 }}>Request Lifecycle States</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
              <li><strong style={{ color: '#2563eb' }}>OPEN:</strong> Wave active, awaiting donor acceptance.</li>
              <li><strong style={{ color: '#d97706' }}>PARTIALLY_FULFILLED:</strong> 1+ units accepted, more needed.</li>
              <li><strong style={{ color: '#059669' }}>FULFILLED:</strong> All required units committed.</li>
              <li><strong style={{ color: '#64748b' }}>EXPIRED:</strong> Deadline passed without complete fulfillment.</li>
            </ul>
          </div>
          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: 700 }}>Donor Match States</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
              <li><strong style={{ color: '#2563eb' }}>NOTIFIED:</strong> Invitation delivered to donor device.</li>
              <li><strong style={{ color: '#059669' }}>ACCEPTED:</strong> Committed donor; contact masked chat unlocked.</li>
              <li><strong style={{ color: '#64748b' }}>DECLINED:</strong> Donor unavailable; next candidate notified.</li>
              <li><strong style={{ color: '#7c3aed' }}>DONATED:</strong> Verified donation with certificate badge.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 4. Privacy & Reliability Pillars */}
      <div className="card" style={{ padding: 28 }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 16 }}>4. Privacy & Reliability Guarantees</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
            <ShieldCheck size={20} color="var(--primary)" style={{ marginBottom: 8 }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 700 }}>Masked In-App Chat</h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Phone numbers remain masked until acceptance. Requester and donor communicate through an ephemeral, content-filtered chat thread.
            </p>
          </div>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
            <Zap size={20} color="#2563eb" style={{ marginBottom: 8 }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 700 }}>Transactional Outbox</h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Events and wave notifications are written in the same DB transaction as request creation, ensuring zero lost jobs even across outages.
            </p>
          </div>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
            <CheckCircle size={20} color="#059669" style={{ marginBottom: 8 }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 700 }}>Idempotent APIs</h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Unique idempotency keys cache and replay requests safely, completely preventing accidental duplicate blood requests on poor mobile connections.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Bottom */}
      <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--primary-light)', borderRadius: 'var(--radius-lg)' }}>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--primary)' }}>
          Ready to save a life or request emergency blood?
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
          Join thousands of registered volunteer donors in Bangladesh.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <Link to="/register" className="btn btn-primary">
            Register as a Donor
          </Link>
          <Link to="/requests/new" className="btn btn-secondary">
            Request Blood
          </Link>
        </div>
      </div>
    </div>
  );
}
