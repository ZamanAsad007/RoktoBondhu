import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PublicSharePage from '../pages/PublicSharePage';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    tokenStorage: {
      getAccessToken: vi.fn(() => null),
      getRefreshToken: vi.fn(() => null),
      setTokens: vi.fn(),
      clearTokens: vi.fn(),
    },
    api: {
      ...actual.api,
      get: vi.fn((url) => {
        if (url.includes('/requests/share/emergency-token-123')) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                request: {
                  id: 'req-sos-1',
                  blood_group: 'AB-',
                  units_needed: 2,
                  hospital_name: 'National Heart Foundation',
                  city: 'Mirpur, Dhaka',
                  urgency: 'CRITICAL',
                  status: 'OPEN',
                  is_sos: true,
                  share_token: 'emergency-token-123',
                  accepted_count: 0,
                  needed_by: '2026-10-30T12:00:00Z',
                },
              },
            },
          });
        }
        return Promise.reject(new Error(`Unhandled GET ${url}`));
      }),
    },
  };
});

describe('Phase 15 Frontend: PublicSharePage & SOS', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders PublicSharePage with SOS alert, safe details, and share buttons', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/s/emergency-token-123']}>
            <Routes>
              <Route path="/s/:shareToken" element={<PublicSharePage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/CRITICAL SOS EMERGENCY ESCALATION/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/AB- Blood Needed/i)).toBeInTheDocument();
    expect(screen.getByText(/National Heart Foundation/i)).toBeInTheDocument();
    expect(screen.getByText(/Mirpur, Dhaka/i)).toBeInTheDocument();
    expect(screen.getByText(/Patient Privacy Protected/i)).toBeInTheDocument();
    expect(screen.getByText(/I Can Donate Blood/i)).toBeInTheDocument();
    expect(screen.getAllByText(/WhatsApp/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Facebook/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Telegram/i)[0]).toBeInTheDocument();
  });
});
