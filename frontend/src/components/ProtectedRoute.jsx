import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roleRequired }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading authentication state...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roleRequired && user.role !== roleRequired) {
    return (
      <div className="card" style={{ maxWidth: 500, margin: '40px auto', textAlign: 'center' }}>
        <h3 style={{ color: 'var(--danger)', marginBottom: 8 }}>Access Denied</h3>
        <p style={{ color: 'var(--text-muted)' }}>You do not have the required permissions ({roleRequired}) to view this page.</p>
      </div>
    );
  }

  return children;
}
