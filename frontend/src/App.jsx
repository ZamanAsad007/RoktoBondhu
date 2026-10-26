import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Register from './pages/Register';
import VerifyOtp from './pages/VerifyOtp';
import DonorProfile from './pages/DonorProfile';
import DonorFeed from './pages/DonorFeed';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Layout>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-otp" element={<VerifyOtp />} />

              {/* Protected Donor Routes (Phase 8) */}
              <Route
                path="/donor/profile"
                element={
                  <ProtectedRoute>
                    <DonorProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/donor/feed"
                element={
                  <ProtectedRoute>
                    <DonorFeed />
                  </ProtectedRoute>
                }
              />

              {/* Fallback & Default */}
              <Route path="/" element={<Navigate to="/donor/feed" replace />} />
              <Route path="*" element={<Navigate to="/donor/feed" replace />} />
            </Routes>
          </Layout>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
