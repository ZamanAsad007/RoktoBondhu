import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, tokenStorage } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadUser() {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      if (res.success && res.data.user) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('[AuthContext] Failed to load user:', err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();

    function handleForceLogout() {
      tokenStorage.clearTokens();
      setUser(null);
    }

    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, []);

  async function login(email, password) {
    const res = await api.login({ email, password });
    if (res.success && res.data) {
      tokenStorage.setTokens(res.data.accessToken, res.data.refreshToken);
      setUser(res.data.user);
      return res.data;
    }
    throw new Error(res.error?.message || 'Login failed');
  }

  async function register(userData) {
    const res = await api.register(userData);
    if (res.success && res.data) {
      tokenStorage.setTokens(res.data.accessToken, res.data.refreshToken);
      setUser(res.data.user);
      return res.data;
    }
    throw new Error(res.error?.message || 'Registration failed');
  }

  async function sendOtp(phone) {
    return api.sendOtp({ phone });
  }

  async function verifyOtp(phone, otp) {
    const res = await api.verifyOtp({ phone, otp });
    if (res.success) {
      await loadUser();
      return res.data;
    }
    throw new Error(res.error?.message || 'OTP verification failed');
  }

  async function logout() {
    try {
      const refreshToken = tokenStorage.getRefreshToken();
      if (refreshToken) {
        await api.logout({ refreshToken });
      }
    } catch (err) {
      // Ignore logout errors
    } finally {
      tokenStorage.clearTokens();
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        sendOtp,
        verifyOtp,
        logout,
        refreshUser: loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
