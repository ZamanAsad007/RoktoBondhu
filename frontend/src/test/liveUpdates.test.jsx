import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider } from '../context/AuthContext';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import RequestDetail from '../pages/RequestDetail';
import { api, tokenStorage } from '../api/client';

// Mock MockEventSource
class MockEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.listeners = {};
    this.readyState = 1;
    MockEventSource.instances.push(this);

    setTimeout(() => {
      if (this.onopen) this.onopen();
      this.dispatchEvent('connected', { data: JSON.stringify({ status: 'connected' }) });
    }, 10);
  }

  addEventListener(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  removeEventListener(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
  }

  dispatchEvent(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => cb(data));
    }
  }

  close() {
    this.readyState = 2;
  }
}

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    tokenStorage: {
      getAccessToken: vi.fn(() => 'mock-jwt-token'),
      getRefreshToken: vi.fn(() => 'mock-refresh-token'),
      setTokens: vi.fn(),
      clearTokens: vi.fn(),
    },
    api: {
      ...actual.api,
      getRequestById: vi.fn(() =>
        Promise.resolve({
          success: true,
          data: {
            request: {
              id: 'req-live-1',
              hospital_name: 'Dhaka Medical College',
              patient_name: 'Rahim Khan',
              blood_group: 'B+',
              units_needed: 2,
              accepted_count: 0,
              urgency: 'URGENT',
              status: 'OPEN',
              is_sos: false,
              current_radius_km: 5,
              matches: [],
            },
          },
        })
      ),
      getMe: vi.fn(() =>
        Promise.resolve({
          success: true,
          data: { user: { id: 'u-1', name: 'Test Requester', role: 'USER' } },
        })
      ),
    },
  };
});

describe('Phase 16 Frontend: Live Updates Hook & Toast Notifications', () => {
  let queryClient;

  beforeEach(() => {
    MockEventSource.instances = [];
    window.EventSource = MockEventSource;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    delete window.EventSource;
  });

  function HookTester({ requestId, onEvent }) {
    const { isConnected, lastEvent, pollingInterval } = useLiveUpdates({
      requestId,
      fallbackInterval: 8000,
      onEvent,
    });

    return (
      <div>
        <div data-testid="status">{isConnected ? 'CONNECTED' : 'DISCONNECTED'}</div>
        <div data-testid="polling">{pollingInterval === false ? 'DISABLED' : `${pollingInterval}ms`}</div>
        <div data-testid="last-event">{lastEvent ? lastEvent.event : 'NONE'}</div>
      </div>
    );
  }

  it('connects via EventSource, receives live match.accepted event, and displays toast alert', async () => {
    const handleEvent = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <HookTester requestId="req-live-1" onEvent={handleEvent} />
        </ToastProvider>
      </QueryClientProvider>
    );

    // Verify initial connection
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('CONNECTED');
      expect(screen.getByTestId('polling').textContent).toBe('DISABLED');
    });

    expect(MockEventSource.instances.length).toBe(1);
    const es = MockEventSource.instances[0];
    expect(es.url).toContain('/api/stream?');
    expect(es.url).toContain('requestId=req-live-1');

    // Simulate match.accepted event from server
    act(() => {
      es.dispatchEvent('match.accepted', {
        data: JSON.stringify({
          requestId: 'req-live-1',
          donorName: 'Farhan Kabir',
          acceptedCount: 1,
          unitsNeeded: 2,
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('last-event').textContent).toBe('match.accepted');
      expect(handleEvent).toHaveBeenCalledWith('match.accepted', expect.any(Object));
      expect(screen.getByRole('alert')).toHaveTextContent('Farhan Kabir accepted your request (1/2 units)!');
    });
  });

  it('falls back to polling interval if EventSource disconnects or encounters error', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <HookTester requestId="req-live-1" />
        </ToastProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('CONNECTED');
    });

    const es = MockEventSource.instances[0];

    // Trigger error on stream
    act(() => {
      if (es.onerror) es.onerror(new Error('Network disconnected'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('DISCONNECTED');
      expect(screen.getByTestId('polling').textContent).toBe('8000ms');
    });
  });

  it('renders RequestDetail with live status indicator', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={['/requests/req-live-1']}>
              <Routes>
                <Route path="/requests/:id" element={<RequestDetail />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Dhaka Medical College')).toBeInTheDocument();
      expect(screen.getByText('Live')).toBeInTheDocument();
    });
  });
});
