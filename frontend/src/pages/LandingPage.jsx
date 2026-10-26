import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Droplet,
  Heart,
  PlusCircle,
  ShieldCheck,
  Zap,
  Users,
  Clock,
  Compass,
  ArrowRight,
} from 'lucide-react';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Hero Section */}
      <div
        style={{
          textAlign: 'center',
          padding: '48px 16px',
          background: 'radial-gradient(ellipse at top, #ffebee 0%, #ffffff 80%)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          marginBottom: 40,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--primary-light)',
            color: 'var(--primary-dark)',
            padding: '6px 14px',
            borderRadius: 999,
            fontSize: '0.85rem',
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          <Droplet size={16} fill="var(--primary)" />
          <span>রক্তবন্ধু — Bangladesh Emergency Blood Matcher</span>
        </div>

        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: 900,
            lineHeight: 1.2,
            maxWidth: 720,
            margin: '0 auto 16px',
            color: '#0f172a',
          }}
        >
          Minutes Matter. Connect with Nearby Volunteer Donors Instantly.
        </h1>

        <p
          style={{
            fontSize: '1.15rem',
            color: 'var(--text-muted)',
            maxWidth: 640,
            margin: '0 auto 32px',
          }}
        >
          RoktoBondhu automates PostGIS radius wave matching and transactional acceptance so emergency patients get blood when every second counts.
        </p>

        {/* Two Clear Primary CTAs */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <Link
            to={isAuthenticated ? '/requests/new' : '/login'}
            className="btn btn-primary btn-lg"
            style={{ minWidth: 220, boxShadow: 'var(--shadow-md)' }}
          >
            <PlusCircle size={22} />
            <span>Need Blood Now</span>
          </Link>

          <Link
            to={isAuthenticated ? '/donor/profile' : '/register'}
            className="btn btn-secondary btn-lg"
            style={{ minWidth: 220, boxShadow: 'var(--shadow-sm)' }}
          >
            <Heart size={22} color="var(--primary)" fill="var(--primary-light)" />
            <span>I Want to Donate</span>
          </Link>
        </div>
      </div>

      {/* Live Stats Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 40,
        }}
      >
        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ color: 'var(--primary)', marginBottom: 6 }}>
            <Users size={28} style={{ margin: '0 auto' }} />
          </div>
          <h3 style={{ fontSize: '1.8rem', fontWeight: 900 }}>15+</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Active Donors Seeded in Dhaka</p>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ color: 'var(--success)', marginBottom: 6 }}>
            <ShieldCheck size={28} style={{ margin: '0 auto' }} />
          </div>
          <h3 style={{ fontSize: '1.8rem', fontWeight: 900 }}>100%</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Concurrency-Safe Allocations</p>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ color: 'var(--warning)', marginBottom: 6 }}>
            <Clock size={28} style={{ margin: '0 auto' }} />
          </div>
          <h3 style={{ fontSize: '1.8rem', fontWeight: 900 }}>&lt; 10 min</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Wave Timeout (Critical SOS)</p>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ color: 'var(--info)', marginBottom: 6 }}>
            <Compass size={28} style={{ margin: '0 auto' }} />
          </div>
          <h3 style={{ fontSize: '1.8rem', fontWeight: 900 }}>5 → 25 km</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Automated Radius Rings</p>
        </div>
      </div>

      {/* 3-Step Workflow Section */}
      <div className="card" style={{ padding: 32, marginBottom: 40 }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textAlign: 'center', marginBottom: 28 }}>
          How RoktoBondhu Works
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24 }}>
          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 'var(--radius-sm)' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                marginBottom: 12,
              }}
            >
              1
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Request Created</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 6 }}>
              Hospital location, blood group, units needed, and urgency are specified. PostGIS instantly calculates closest matching rings.
            </p>
          </div>

          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 'var(--radius-sm)' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                marginBottom: 12,
              }}
            >
              2
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Waves Dispatched</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 6 }}>
              BullMQ dispatches notification alerts via in-app, SMS, and email. If unfilled within timeout, the search radius expands automatically.
            </p>
          </div>

          <div style={{ padding: 16, background: '#f8fafc', borderRadius: 'var(--radius-sm)' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                marginBottom: 12,
              }}
            >
              3
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Mutual Acceptance</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 6 }}>
              Phone contacts are unlocked only after mutual acceptance. Row-level locks prevent over-subscription and race conditions.
            </p>
          </div>
        </div>
      </div>

      {/* Privacy Safeguard Callout */}
      <div
        style={{
          background: 'var(--primary-light)',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <ShieldCheck size={40} color="var(--primary-dark)" />
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
            Strict Privacy & Contact Masking
          </h4>
          <p style={{ color: '#7f1d1d', fontSize: '0.88rem', marginTop: 2 }}>
            Your phone number and exact coordinates are never made public. Requesters only see approximate distance until a donor explicitly agrees to accept the call.
          </p>
        </div>
      </div>
    </div>
  );
}
