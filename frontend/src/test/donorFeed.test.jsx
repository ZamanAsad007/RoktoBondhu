import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DonorFeed from '../pages/DonorFeed';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    api: {
      ...actual.api,
      getMyMatches: vi.fn().mockResolvedValue({
        success: true,
        data: {
          matches: [
            {
              match_id: 'm-1',
              match_status: 'NOTIFIED',
              blood_group: 'O+',
              urgency: 'CRITICAL',
              hospital_name: 'Dhaka Medical College',
              patient_name: 'Rashid Khan',
              units_needed: 2,
              distance_km: 3.5,
              contact_phone: '+88017****5678',
              needed_by: '2026-10-27T12:00:00Z',
            },
          ],
        },
      }),
      acceptMatch: vi.fn().mockResolvedValue({ success: true }),
      declineMatch: vi.fn().mockResolvedValue({ success: true }),
    },
  };
});

describe('DonorFeed Page', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders notified request with Accept and Decline buttons', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <DonorFeed />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Dhaka Medical College')).toBeInTheDocument();
    });

    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText(/Rashid Khan/i)).toBeInTheDocument();
    expect(screen.getByText(/Shared after you accept/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Accept to Donate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Decline/i })).toBeInTheDocument();
  });
});
