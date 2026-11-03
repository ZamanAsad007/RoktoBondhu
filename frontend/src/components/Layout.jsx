import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  ChevronDown,
  Menu,
  X,
  Sliders,
} from 'lucide-react';

export default function Layout({ children }) {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [exploreOpen, setExploreOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const exploreRef = useRef(null);
  const userMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);

  // Close menus on route change
  useEffect(() => {
    setExploreOpen(false);
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(e) {
      if (exploreRef.current && !exploreRef.current.contains(e.target)) {
        setExploreOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (
        mobileMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target) &&
        !e.target.closest('.mobile-menu-toggle')
      ) {
        setMobileMenuOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setExploreOpen(false);
        setUserMenuOpen(false);
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  async function handleLogout() {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
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
          {/* Brand Logo */}
          <Link to="/" className="brand" onClick={() => setMobileMenuOpen(false)}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--primary-light)',
                padding: 6,
                borderRadius: '50%',
                flexShrink: 0,
              }}
            >
              <Droplet size={22} fill="#e53935" color="#e53935" />
            </div>
            <span className="brand-title">{isBengali ? 'রক্তবন্ধু' : 'RoktoBondhu'}</span>
            <span className="brand-badge desktop-only">{isBengali ? 'জরুরী রক্তদান' : 'Life Saving'}</span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="nav-links desktop-only">
            {isAuthenticated ? (
              <>
                <NavLink to="/donor/feed" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Heart size={18} />
                  <span>{t('nav.donorFeed')}</span>
                </NavLink>
                <NavLink to="/requests" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <List size={18} />
                  <span>{t('nav.emergencyRequests')}</span>
                </NavLink>
                <NavLink
                  to="/requests/new"
                  className={({ isActive }) => `btn btn-primary btn-sm ${isActive ? 'active' : ''}`}
                  style={{ gap: 6, fontWeight: 700 }}
                >
                  <PlusCircle size={16} />
                  <span>{t('nav.requestBlood')}</span>
                </NavLink>
              </>
            ) : null}

            {/* Explore / Services Dropdown */}
            <div className="dropdown-wrapper" ref={exploreRef}>
              <button
                type="button"
                onClick={() => setExploreOpen((prev) => !prev)}
                className={`nav-link dropdown-trigger-btn ${exploreOpen ? 'active' : ''}`}
                aria-expanded={exploreOpen}
                aria-haspopup="true"
              >
                <Compass size={18} />
                <span>{t('nav.explore') || (isBengali ? 'সেবাসমূহ' : 'Explore')}</span>
                <ChevronDown size={14} className={`dropdown-chevron ${exploreOpen ? 'rotate' : ''}`} />
              </button>

              {exploreOpen && (
                <div className="dropdown-menu dropdown-menu-start">
                  <NavLink
                    to="/how-matching-works"
                    className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => setExploreOpen(false)}
                  >
                    <Compass size={16} color="var(--primary)" />
                    <div>
                      <div className="dropdown-item-title">{isBengali ? 'কিভাবে কাজ করে' : 'How It Works'}</div>
                      <div className="dropdown-item-desc">{isBengali ? 'স্বয়ংক্রিয় ম্যাচিং অ্যালগরিদম' : 'Matching algorithm explained'}</div>
                    </div>
                  </NavLink>
                  <NavLink
                    to="/blood-banks"
                    className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => setExploreOpen(false)}
                  >
                    <Building2 size={16} color="#0284c7" />
                    <div>
                      <div className="dropdown-item-title">{t('nav.bloodBanks')}</div>
                      <div className="dropdown-item-desc">{isBengali ? 'নিকটস্থ অনুমোদিত ব্লাড ব্যাংক' : 'Verified hospitals & inventory'}</div>
                    </div>
                  </NavLink>
                  <NavLink
                    to="/drives"
                    className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => setExploreOpen(false)}
                  >
                    <Calendar size={16} color="#16a34a" />
                    <div>
                      <div className="dropdown-item-title">{t('nav.bloodDrives')}</div>
                      <div className="dropdown-item-desc">{isBengali ? 'চলমান স্বেচ্ছায় রক্তদান ক্যাম্পেইন' : 'Upcoming donation campaigns'}</div>
                    </div>
                  </NavLink>
                  <NavLink
                    to="/leaderboard"
                    className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => setExploreOpen(false)}
                  >
                    <Trophy size={16} color="#f59e0b" />
                    <div>
                      <div className="dropdown-item-title">{t('nav.leaderboard')}</div>
                      <div className="dropdown-item-desc">{isBengali ? 'শীর্ষ রক্তদাতা ও স্বীকৃতি' : 'Top community donors'}</div>
                    </div>
                  </NavLink>
                </div>
              )}
            </div>

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}
              title="Change Language"
            >
              <Languages size={15} />
              <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{isBengali ? 'English' : 'বাংলা'}</span>
            </button>

            {isAuthenticated ? (
              <>
                {/* Notifications Link */}
                <NavLink
                  to="/notifications"
                  className={({ isActive }) => `nav-link icon-only-link ${isActive ? 'active' : ''}`}
                  title="Notifications"
                >
                  <Bell size={18} />
                </NavLink>

                {/* User Toolbox Dropdown */}
                <div className="dropdown-wrapper" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className={`user-toolbox-btn ${userMenuOpen ? 'active' : ''}`}
                    aria-expanded={userMenuOpen}
                    aria-haspopup="true"
                  >
                    <div className="user-avatar-badge">
                      {(user?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="user-display-name">
                      {user?.name ? user.name.split(' ')[0] : 'Account'}
                    </span>
                    {user?.role && user.role !== 'USER' && (
                      <span className="user-role-chip">{user.role}</span>
                    )}
                    <ChevronDown size={14} className={`dropdown-chevron ${userMenuOpen ? 'rotate' : ''}`} />
                  </button>

                  {userMenuOpen && (
                    <div className="dropdown-menu dropdown-menu-end user-menu-card">
                      <div className="dropdown-user-header">
                        <div className="dropdown-user-name">{user?.name}</div>
                        <div className="dropdown-user-sub">{user?.email || user?.phone}</div>
                        <span className="user-role-badge-tag">{user?.role || 'USER'}</span>
                      </div>

                      <div className="dropdown-divider" />

                      <NavLink
                        to="/donor/profile"
                        className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User size={16} />
                        <span>{t('nav.profile')}</span>
                      </NavLink>

                      <NavLink
                        to="/donor/stats"
                        className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Award size={16} />
                        <span>{isBengali ? 'ব্যাজ ও পরিসংখ্যান' : 'Badges & Stats'}</span>
                      </NavLink>

                      <NavLink
                        to="/notifications"
                        className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Bell size={16} />
                        <span>{isBengali ? 'নোটিফিকেশন ইনবক্স' : 'Notifications Inbox'}</span>
                      </NavLink>

                      {(user?.role === 'ORG' || user?.role === 'ADMIN') && (
                        <NavLink
                          to="/org/dashboard"
                          className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Building2 size={16} />
                          <span>{t('nav.orgPortal')}</span>
                        </NavLink>
                      )}

                      {user?.role === 'ADMIN' && (
                        <NavLink
                          to="/admin"
                          className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <ShieldCheck size={16} />
                          <span>{t('nav.admin')}</span>
                        </NavLink>
                      )}

                      <div className="dropdown-divider" />

                      <button
                        onClick={handleLogout}
                        className="dropdown-item dropdown-logout-action"
                        title={t('nav.logout')}
                      >
                        <LogOut size={16} color="var(--danger)" />
                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{t('nav.logout')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link to="/login" className="btn btn-secondary btn-sm">
                  <LogIn size={16} />
                  <span>{t('nav.login')}</span>
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm">
                  <UserPlus size={16} />
                  <span>{t('nav.register')}</span>
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Header Controls */}
          <div className="mobile-header-controls">
            <button
              onClick={toggleLanguage}
              className="btn btn-secondary btn-sm mobile-lang-btn"
              style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 700 }}
              title="Change Language (Mobile)"
              aria-label="Change Language"
            >
              <Languages size={14} />
              <span>{isBengali ? 'EN' : 'বাং'}</span>
            </button>

            {isAuthenticated && (
              <NavLink to="/notifications" className="btn btn-secondary btn-sm icon-only-mobile" title="Notifications">
                <Bell size={18} />
              </NavLink>
            )}

            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="btn btn-secondary btn-sm mobile-menu-toggle"
              aria-label="Toggle navigation toolbox"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-down Toolbox Drawer */}
      {mobileMenuOpen && (
        <>
          <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)} />
          <aside className="mobile-toolbox-drawer" ref={mobileMenuRef}>
            {isAuthenticated ? (
              <div className="mobile-user-card">
                <div className="user-avatar-badge large">
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="mobile-user-info">
                  <div className="mobile-user-name">{user?.name}</div>
                  <div className="mobile-user-sub">{user?.email || user?.phone}</div>
                </div>
                <span className="user-role-badge-tag">{user?.role || 'USER'}</span>
              </div>
            ) : (
              <div className="mobile-guest-actions">
                <Link
                  to="/login"
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <LogIn size={18} />
                  <span>{t('nav.login')}</span>
                </Link>
                <Link
                  to="/register"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <UserPlus size={18} />
                  <span>{t('nav.register')}</span>
                </Link>
              </div>
            )}

            <div className="mobile-menu-section-title">
              {isBengali ? 'জরুরী সেবা ও অনুরোধ' : 'Emergency & Actions'}
            </div>
            <div className="mobile-menu-list">
              {isAuthenticated && (
                <>
                  <NavLink
                    to="/requests/new"
                    className={({ isActive }) => `mobile-menu-item highlight ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <PlusCircle size={18} />
                    <span>{t('nav.requestBlood')}</span>
                  </NavLink>
                  <NavLink
                    to="/donor/feed"
                    className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Heart size={18} />
                    <span>{t('nav.donorFeed')}</span>
                  </NavLink>
                  <NavLink
                    to="/requests"
                    className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <List size={18} />
                    <span>{t('nav.emergencyRequests')}</span>
                  </NavLink>
                  <NavLink
                    to="/notifications"
                    className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Bell size={18} />
                    <span>{isBengali ? 'নোটিফিকেশন ইনবক্স' : 'Notifications Inbox'}</span>
                  </NavLink>
                </>
              )}
            </div>

            <div className="mobile-menu-section-title">
              {isBengali ? 'অন্বেষণ ও নেটওয়ার্ক' : 'Explore & Network'}
            </div>
            <div className="mobile-menu-list">
              <NavLink
                to="/how-matching-works"
                className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Compass size={18} />
                <span>{isBengali ? 'কিভাবে কাজ করে' : 'How It Works'}</span>
              </NavLink>
              <NavLink
                to="/blood-banks"
                className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Building2 size={18} />
                <span>{t('nav.bloodBanks')}</span>
              </NavLink>
              <NavLink
                to="/drives"
                className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Calendar size={18} />
                <span>{t('nav.bloodDrives')}</span>
              </NavLink>
              <NavLink
                to="/leaderboard"
                className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Trophy size={18} />
                <span>{t('nav.leaderboard')}</span>
              </NavLink>
            </div>

            {isAuthenticated && (
              <>
                <div className="mobile-menu-section-title">
                  {isBengali ? 'প্রোফাইল ও সেটিংস' : 'Profile & Settings'}
                </div>
                <div className="mobile-menu-list">
                  <NavLink
                    to="/donor/profile"
                    className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User size={18} />
                    <span>{t('nav.profile')}</span>
                  </NavLink>
                  <NavLink
                    to="/donor/stats"
                    className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Award size={18} />
                    <span>{isBengali ? 'ব্যাজ ও অর্জন' : 'Badges & Stats'}</span>
                  </NavLink>
                  {(user?.role === 'ORG' || user?.role === 'ADMIN') && (
                    <NavLink
                      to="/org/dashboard"
                      className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Building2 size={18} />
                      <span>{t('nav.orgPortal')}</span>
                    </NavLink>
                  )}
                  {user?.role === 'ADMIN' && (
                    <NavLink
                      to="/admin"
                      className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <ShieldCheck size={18} />
                      <span>{t('nav.admin')}</span>
                    </NavLink>
                  )}
                </div>

                <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={handleLogout}
                    className="btn btn-secondary"
                    style={{ width: '100%', color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
                    title={t('nav.logout')}
                  >
                    <LogOut size={18} />
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>
              </>
            )}
          </aside>
        </>
      )}

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
          <button
            type="button"
            className="nav-link"
            onClick={() => setMobileMenuOpen(true)}
            style={{ flexDirection: 'column', gap: 2, padding: '4px 8px' }}
          >
            <Sliders size={20} />
            <span style={{ fontSize: '0.75rem' }}>{isBengali ? 'টুলবক্স' : 'Toolbox'}</span>
          </button>
        </nav>
      )}

      <footer
        style={{
          borderTop: '1px solid var(--border)',
          background: '#ffffff',
          padding: '24px 16px',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
        }}
      >
        <p>
          <strong>RoktoBondhu | রক্তবন্ধু</strong> — Life-saving emergency blood matcher.
        </p>
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
