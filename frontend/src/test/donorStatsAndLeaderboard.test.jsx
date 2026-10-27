import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DonorStats from '../pages/DonorStats';
import Leaderboard from '../pages/Leaderboard';
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
        if (url === '/donors/me/stats') {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                donatedCount: 3,
                currentStreak: 2,
                longestStreak: 2,
                nextEligibleAt: '2026-11-20',
                daysUntilEligible: 23,
                isEligibleNow: false,
                showOnLeaderboard: true,
                badges: [
                  {
                    code: 'FIRST_DONATION',
                    name: 'First Donation',
                    description: 'Donated blood for the first time.',
                    icon: '🩸',
                    isEarned: true,
                    earnedAt: '2026-08-01',
                  },
                  {
                    code: 'DONOR_BRONZE',
                    name: 'Bronze Life Saver',
                    description: 'Completed 3 successful blood donations.',
                    icon: '🥉',
                    isEarned: true,
                    earnedAt: '2026-10-25',
                  },
                ],
                recentDonations: [
                  {
                    id: 'don-1',
                    donated_at: '2026-10-25T10:00:00Z',
                    hospital_name: 'Square Hospital',
                    city: 'Dhaka',
                    urgency: 'CRITICAL',
                    certificate_no: 'RB-20261025-ABC12',
                  },
                ],
              },
            },
          });
        }
        if (url === '/leaderboard') {
          return Promise.resolve({
            data: {
              success: true,
              data: [
                {
                  rank: 1,
                  displayName: 'Tanvir A.',
                  city: 'Dhaka',
                  bloodGroup: 'O+',
                  donatedCount: 12,
                  currentStreak: 4,
                  badgesCount: 5,
                },
                {
                  rank: 2,
                  displayName: 'Nadia S.',
                  city: 'Chittagong',
                  bloodGroup: 'A+',
                  donatedCount: 7,
                  currentStreak: 2,
                  badgesCount: 3,
                },
              ],
            },
          });
        }
        return Promise.reject(new Error(`Unhandled GET ${url}`));
      }),
      put: vi.fn().mockResolvedValue({
        data: { success: true, data: { showOnLeaderboard: true } },
      }),
    },
  };
});

describe('Phase 14 Frontend: DonorStats & Leaderboard', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders DonorStats with badges, countdown, and donation history', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <DonorStats />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/My Donation Impact & Badges/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/23 Days/i)).toBeInTheDocument();
    expect(screen.getByText(/First Donation/i)).toBeInTheDocument();
    expect(screen.getByText(/Bronze Life Saver/i)).toBeInTheDocument();
    expect(screen.getByText(/Square Hospital/i)).toBeInTheDocument();
    expect(screen.getByText(/RB-20261025-ABC12/i)).toBeInTheDocument();
    expect(screen.getByText(/Certificate PDF/i)).toBeInTheDocument();
  });

  it('renders Leaderboard with top community donors', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <Leaderboard />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Tanvir A\./i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Nadia S\./i)).toBeInTheDocument();
    expect(screen.getByText(/12/i)).toBeInTheDocument();
  });
});
