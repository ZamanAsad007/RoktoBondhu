/**
 * API client with automatic JWT token refresh on 401 Unauthorized responses.
 */

const BASE_URL = '/api';

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem('rb_access_token'),
  getRefreshToken: () => localStorage.getItem('rb_refresh_token'),
  setTokens: (accessToken, refreshToken) => {
    if (accessToken) localStorage.setItem('rb_access_token', accessToken);
    if (refreshToken) localStorage.setItem('rb_refresh_token', refreshToken);
  },
  clearTokens: () => {
    localStorage.removeItem('rb_access_token');
    localStorage.removeItem('rb_refresh_token');
  },
};

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

export async function apiClient(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = tokenStorage.getAccessToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  let response = await fetch(url, config);

  // If 401 Unauthorized and not already refreshing token
  if (response.status === 401 && !options._retry && tokenStorage.getRefreshToken()) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          config.headers['Authorization'] = `Bearer ${newToken}`;
          return fetch(url, config);
        })
        .then((res) => parseResponse(res));
    }

    options._retry = true;
    isRefreshing = true;

    try {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokenStorage.getRefreshToken() }),
      });

      const refreshData = await refreshRes.json();
      if (!refreshRes.ok || !refreshData.success) {
        throw new Error(refreshData.error?.message || 'Token refresh failed');
      }

      const newAccessToken = refreshData.data.accessToken;
      const newRefreshToken = refreshData.data.refreshToken;
      tokenStorage.setTokens(newAccessToken, newRefreshToken);

      processQueue(null, newAccessToken);

      config.headers['Authorization'] = `Bearer ${newAccessToken}`;
      response = await fetch(url, config);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      tokenStorage.clearTokens();
      window.dispatchEvent(new CustomEvent('auth:logout'));
      throw refreshErr;
    } finally {
      isRefreshing = false;
    }
  }

  return parseResponse(response);
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMsg = (typeof data === 'object' && (data.error?.message || data.message)) || 'Request failed';
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

// API Endpoints abstraction
export const api = {
  // Generic HTTP methods
  get: (endpoint, options = {}) => apiClient(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body = {}, options = {}) =>
    apiClient(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (endpoint, body = {}, options = {}) =>
    apiClient(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),

  // Auth
  register: (body) => apiClient('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => apiClient('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  sendOtp: (body) => apiClient('/auth/send-otp', { method: 'POST', body: JSON.stringify(body) }),
  verifyOtp: (body) => apiClient('/auth/verify-otp', { method: 'POST', body: JSON.stringify(body) }),
  refresh: (body) => apiClient('/auth/refresh', { method: 'POST', body: JSON.stringify(body) }),
  logout: (body) => apiClient('/auth/logout', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => apiClient('/auth/me'),

  // Donor
  getDonorProfile: () => apiClient('/donors/profile'),
  updateDonorProfile: (body) => apiClient('/donors/profile', { method: 'PUT', body: JSON.stringify(body) }),
  setDonorAvailability: (available) =>
    apiClient('/donors/availability', { method: 'PATCH', body: JSON.stringify({ available }) }),
  updateAvailabilityWindows: (windows) =>
    apiClient('/donors/me/availability-windows', { method: 'PUT', body: JSON.stringify({ windows }) }),

  // Matches / Donor Side
  getMyMatches: (params = '') => apiClient(`/matches/mine${params ? `?${params}` : ''}`),
  acceptMatch: (id) => apiClient(`/matches/${id}/accept`, { method: 'POST' }),
  declineMatch: (id) => apiClient(`/matches/${id}/decline`, { method: 'POST' }),

  // Requests
  getNearbyRequests: (params = '') => apiClient(`/requests/nearby${params ? `?${params}` : ''}`),
  createBloodRequest: (body) => apiClient('/requests', { method: 'POST', body: JSON.stringify(body) }),
  getMyRequests: (params = '') => apiClient(`/requests/mine${params ? `?${params}` : ''}`),
  getRequestById: (id) => apiClient(`/requests/${id}`),
  cancelBloodRequest: (id) => apiClient(`/requests/${id}/cancel`, { method: 'POST' }),
  escalateRequest: (id) => apiClient(`/requests/${id}/escalate`, { method: 'POST' }),
  uploadVerificationDocument: async (id, formData) => {
    const token = tokenStorage.getAccessToken();
    const res = await fetch(`/api/requests/${id}/verification-document`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    return parseResponse(res);
  },
  confirmDonation: (requestId, matchId) =>
    apiClient(`/requests/${requestId}/matches/${matchId}/confirm-donation`, { method: 'POST' }),

  // Notifications & Push (Phase 20)
  getNotifications: (params = '') => apiClient(`/notifications${params ? `?${params}` : ''}`),
  markNotificationRead: (id) => apiClient(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => apiClient('/notifications/read-all', { method: 'PATCH' }),
  getVapidPublicKey: () => apiClient('/notifications/vapid-public-key'),
  subscribePush: (body) => apiClient('/notifications/push/subscribe', { method: 'POST', body: JSON.stringify(body) }),
  unsubscribePush: (body) => apiClient('/notifications/push/unsubscribe', { method: 'POST', body: JSON.stringify(body) }),
  getNotificationPreferences: () => apiClient('/notifications/preferences'),
  updateNotificationPreferences: (body) =>
    apiClient('/notifications/preferences', { method: 'PUT', body: JSON.stringify(body) }),

  // Telegram Bot Channel (Phase 21)
  getTelegramStatus: () => apiClient('/telegram/status'),
  getTelegramLinkCode: () => apiClient('/telegram/link-code', { method: 'POST' }),
  unlinkTelegram: () => apiClient('/telegram/unlink', { method: 'POST' }),

  // Phase 22: Analytics, Heatmap & Shortage Forecast
  getAdminAnalyticsOverview: () => apiClient('/admin/analytics/overview'),
  getAdminHeatmapGrid: (resolution) =>
    apiClient(`/admin/analytics/heatmap${resolution ? `?resolution=${resolution}` : ''}`),
  getAdminShortageForecast: () => apiClient('/admin/analytics/forecast'),
  getRecruitNudges: () => apiClient('/donors/me/recruit-nudges'),

  // Admin & Safety
  getAdminStats: () => apiClient('/admin/stats'),
  getAdminRequests: (params = '') => apiClient(`/admin/requests${params ? `?${params}` : ''}`),
  getAdminReports: () => apiClient('/admin/reports'),
  setBlockUser: (userId, isBlocked) =>
    apiClient(`/admin/users/${userId}/block`, { method: 'PATCH', body: JSON.stringify({ isBlocked }) }),
  verifyRequest: (requestId, isVerified = true) =>
    apiClient(`/admin/requests/${requestId}/verify`, { method: 'PATCH', body: JSON.stringify({ isVerified }) }),
  updateReportStatus: (reportId, status, resolutionNotes = null) =>
    apiClient(`/admin/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, resolutionNotes }),
    }),
  createReport: (body) => apiClient('/reports', { method: 'POST', body: JSON.stringify(body) }),
  searchUsers: (q) => apiClient(`/admin/users/search?q=${encodeURIComponent(q)}`),

  // Organizations & Blood Banks (Phase 17)
  getNearbyBloodBanks: (params = '') => apiClient(`/organizations/nearby${params ? `?${params}` : ''}`),
  getMyOrg: () => apiClient('/organizations/me'),
  registerOrg: (body) => apiClient('/organizations/register', { method: 'POST', body: JSON.stringify(body) }),
  updateInventory: (body) => apiClient('/organizations/inventory', { method: 'PUT', body: JSON.stringify(body) }),
  getOrgInventory: (id) => apiClient(`/organizations/${id}/inventory`),
  createDrive: (body) => apiClient('/organizations/drives', { method: 'POST', body: JSON.stringify(body) }),
  getNearbyDrives: (params = '') => apiClient(`/organizations/drives/nearby${params ? `?${params}` : ''}`),
  getMyDrives: () => apiClient('/organizations/drives/mine'),
  rsvpDrive: (id) => apiClient(`/organizations/drives/${id}/rsvp`, { method: 'POST' }),
  cancelDriveRsvp: (id) => apiClient(`/organizations/drives/${id}/rsvp`, { method: 'DELETE' }),
  getDriveAttendees: (id) => apiClient(`/organizations/drives/${id}/attendees`),
  markDriveAttendance: (id, userId) =>
    apiClient(`/organizations/drives/${id}/attendees/${userId}/attend`, { method: 'PATCH' }),

  // Masked In-App Chat (Phase 19)
  getChatThreadByMatch: (matchId) => apiClient(`/chat/threads/by-match/${matchId}`),
  getChatThread: (threadId) => apiClient(`/chat/threads/${threadId}`),
  getChatMessages: (threadId, limit = 100) => apiClient(`/chat/threads/${threadId}/messages?limit=${limit}`),
  sendChatMessage: (threadId, content) =>
    apiClient(`/chat/threads/${threadId}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
  shareChatPhone: (threadId) => apiClient(`/chat/threads/${threadId}/share-phone`, { method: 'POST' }),
  blockChatUser: (threadId, reason) =>
    apiClient(`/chat/threads/${threadId}/block`, { method: 'POST', body: JSON.stringify({ reason }) }),
};
