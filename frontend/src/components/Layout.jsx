import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import InstallPrompt from './InstallPrompt';
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
  Languages,
  Compass,
} from 'lucide-react';

export default function Layout({ children }) {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function toggleLanguage() {
    const nextLang = i18n.language?.startsWith('bn') ? 'en' : 'bn';
    i18n.changeLanguage(nextLang);
  }

  const isBengali = i18n.language?.startsWith('bn');

  return (
    <div className="app-container">
      <header className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="brand">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-light)', padding: 6, borderRadius: '50%' }}>
              <Droplet size={24} fill="#e53935" color="#e53935" />
            </div>
            <span>{isBengali ? 'রক্তবন্ধু' : 'RoktoBondhu'}</span>
            <span className="brand-badge">{isBengali ? 'জরুরী রক্তদান' : 'Life Saving'}</span>
          </Link>

          <nav className="nav-links desktop-only">
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}
              title="Change Language"
            >
              <Languages size={15} />
              <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{isBengali ? 'English' : 'বাংলা'}</span>
            </button>

            <NavLink to="/how-matching-works" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Compass size={18} />
              <span>{isBengali ? 'কিভাবে কাজ করে' : 'How It Works'}</span>
            </NavLink>
            <NavLink to="/blood-banks" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Building2 size={18} />
              <span>{t('nav.bloodBanks')}</span>
            </NavLink>
            <NavLink to="/drives" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Calendar size={18} />
              <span>{t('nav.bloodDrives')}</span>
            </NavLink>
            <NavLink to="/leaderboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Trophy size={18} />
              <span>{t('nav.leaderboard')}</span>
            </NavLink>
            {isAuthenticated ? (
              <>
                <NavLink to="/donor/feed" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Heart size={18} />
                  <span>{t('nav.donorFeed')}</span>
                </NavLink>
                <NavLink to="/donor/stats" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Award size={18} />
                  <span>Badges</span>
                </NavLink>
                <NavLink to="/donor/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <User size={18} />
                  <span>{t('nav.profile')}</span>
                </NavLink>
                <NavLink to="/requests" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <List size={18} />
                  <span>{t('nav.emergencyRequests')}</span>
                </NavLink>
                <NavLink to="/requests/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <PlusCircle size={18} />
                  <span>{t('nav.requestBlood')}</span>
                </NavLink>
                {(user?.role === 'ORG' || user?.role === 'ADMIN') && (
                  <NavLink to="/org/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Building2 size={18} />
                    <span>{t('nav.orgPortal')}</span>
                  </NavLink>
                )}
                {user?.role === 'ADMIN' && (
                  <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <ShieldCheck size={18} />
                    <span>{t('nav.admin')}</span>
                  </NavLink>
                )}
                <NavLink to="/notifications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Bell size={18} />
                  <span>Inbox</span>
                </NavLink>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 12, borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{user.name}</span>
                  <button onClick={handleLogout} className="btn btn-secondary btn-sm" title={t('nav.logout')}>
                    <LogOut size={16} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-secondary btn-sm">
                  <LogIn size={16} />
                  <span>{t('nav.login')}</span>
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm">
                  <UserPlus size={16} />
                  <span>{t('nav.register')}</span>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="main-content">{children}</main>

      {/* PWA Install Prompt Banner */}
      <InstallPrompt />

      {/* Mobile Bottom Navigation */}
      {isAuthenticated && (
        <nav className="mobile-nav">
          <NavLink to="/donor/feed" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Heart size={20} />
            <span style={{ fontSize: '0.75rem' }}>{t('nav.donorFeed')}</span>
          </NavLink>
          <NavLink to="/requests" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <List size={20} />
            <span style={{ fontSize: '0.75rem' }}>{t('nav.emergencyRequests')}</span>
          </NavLink>
          <NavLink to="/requests/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <PlusCircle size={20} />
            <span style={{ fontSize: '0.75rem' }}>{t('nav.requestBlood')}</span>
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Bell size={20} />
            <span style={{ fontSize: '0.75rem' }}>Inbox</span>
          </NavLink>
          <NavLink to="/donor/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <User size={20} />
            <span style={{ fontSize: '0.75rem' }}>{t('nav.profile')}</span>
          </NavLink>
        </nav>
      )}

      <footer style={{ borderTop: '1px solid var(--border)', background: '#ffffff', padding: '24px 16px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <p><strong>RoktoBondhu | রক্তবন্ধু</strong> — Life-saving emergency blood matcher.</p>
        <p style={{ marginTop: 4 }}>Donor contact information is protected and disclosed only after mutual acceptance.</p>
        <p style={{ marginTop: 6 }}>
          <Link to="/how-matching-works" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            {isBengali ? 'ম্যাচিং প্রক্রিয়া বিস্তারিত পড়ুন →' : 'Learn How Matching Works →'}
          </Link>
        </p>
      </footer>
    </div>
  );
}
