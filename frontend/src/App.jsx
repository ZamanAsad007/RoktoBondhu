import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyOtp from './pages/VerifyOtp';
import DonorProfile from './pages/DonorProfile';
import DonorFeed from './pages/DonorFeed';
import CreateRequest from './pages/CreateRequest';
import MyRequests from './pages/MyRequests';
import RequestDetail from './pages/RequestDetail';
import NotificationsInbox from './pages/NotificationsInbox';
import AdminDashboard from './pages/AdminDashboard';
import DonorStats from './pages/DonorStats';
import Leaderboard from './pages/Leaderboard';

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
              <Route path="/" element={<LandingPage />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-otp" element={<VerifyOtp />} />

              {/* Protected Donor Routes (Phase 8 & Phase 14) */}
              <Route
                path="/donor/profile"
                element={
                  <ProtectedRoute>
                    <DonorProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/donor/stats"
                element={
                  <ProtectedRoute>
                    <DonorStats />
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

              {/* Protected Requester & Notification Routes (Phase 9) */}
              <Route
                path="/requests"
                element={
                  <ProtectedRoute>
                    <MyRequests />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requests/new"
                element={
                  <ProtectedRoute>
                    <CreateRequest />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requests/:id"
                element={
                  <ProtectedRoute>
                    <RequestDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <NotificationsInbox />
                  </ProtectedRoute>
                }
              />

              {/* Protected Admin Route (Phase 10) */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roleRequired="ADMIN">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
