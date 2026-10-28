import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Heart,
  Droplet,
  User,
  Bell,
  LogOut,
  PlusCircle,
  List,
  ShieldCheck,
  LogIn,
  UserPlus,
  Trophy,
  Award,
  Building2,
  Calendar,
} from 'lucide-react';

export default function Layout({ children }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-container">
      <header className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="brand">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-light)', padding: 6, borderRadius: '50%' }}>
              <Droplet size={24} fill="#e53935" color="#e53935" />
            </div>
            <span>RoktoBondhu</span>
            <span className="brand-badge">রক্তবন্ধু</span>
          </Link>

          <nav className="nav-links desktop-only">
            <NavLink to="/blood-banks" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Building2 size={18} />
              <span>Blood Banks</span>
            </NavLink>
            <NavLink to="/drives" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Calendar size={18} />
              <span>Drives</span>
            </NavLink>
            <NavLink to="/leaderboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Trophy size={18} />
              <span>Leaderboard</span>
            </NavLink>
            {isAuthenticated ? (
              <>
                <NavLink to="/donor/feed" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Heart size={18} />
                  <span>Donor Feed</span>
                </NavLink>
                <NavLink to="/donor/stats" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Award size={18} />
                  <span>Badges & Stats</span>
                </NavLink>
                <NavLink to="/donor/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <User size={18} />
                  <span>My Profile</span>
                </NavLink>
                <NavLink to="/requests" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <List size={18} />
                  <span>My Requests</span>
                </NavLink>
                <NavLink to="/requests/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <PlusCircle size={18} />
                  <span>Request Blood</span>
                </NavLink>
                {(user?.role === 'ORG' || user?.role === 'ADMIN') && (
                  <NavLink to="/org/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Building2 size={18} />
                    <span>Org Center</span>
                  </NavLink>
                )}
                {user?.role === 'ADMIN' && (
                  <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <ShieldCheck size={18} />
                    <span>Admin</span>
                  </NavLink>
                )}
                <NavLink to="/notifications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Bell size={18} />
                  <span>Inbox</span>
                </NavLink>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 12, borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{user.name}</span>
                  <button onClick={handleLogout} className="btn btn-secondary btn-sm" title="Log out">
                    <LogOut size={16} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-secondary btn-sm">
                  <LogIn size={16} />
                  <span>Login</span>
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm">
                  <UserPlus size={16} />
                  <span>Register</span>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="main-content">{children}</main>

      {/* Mobile Bottom Navigation */}
      {isAuthenticated && (
        <nav className="mobile-nav">
          <NavLink to="/donor/feed" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Heart size={20} />
            <span style={{ fontSize: '0.75rem' }}>Feed</span>
          </NavLink>
          <NavLink to="/requests" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <List size={20} />
            <span style={{ fontSize: '0.75rem' }}>Requests</span>
          </NavLink>
          <NavLink to="/requests/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <PlusCircle size={20} />
            <span style={{ fontSize: '0.75rem' }}>Need Blood</span>
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Bell size={20} />
            <span style={{ fontSize: '0.75rem' }}>Inbox</span>
          </NavLink>
          <NavLink to="/donor/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <User size={20} />
            <span style={{ fontSize: '0.75rem' }}>Profile</span>
          </NavLink>
        </nav>
      )}

      <footer style={{ borderTop: '1px solid var(--border)', background: '#ffffff', padding: '24px 16px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <p><strong>RoktoBondhu | রক্তবন্ধু</strong> — Life-saving emergency blood matcher.</p>
        <p style={{ marginTop: 4 }}>Donor contact information is protected and disclosed only after mutual acceptance.</p>
      </footer>
    </div>
  );
}
