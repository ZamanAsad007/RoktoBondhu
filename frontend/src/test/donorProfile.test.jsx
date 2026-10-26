import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DonorProfile from '../pages/DonorProfile';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    api: {
      ...actual.api,
      getDonorProfile: vi.fn().mockResolvedValue({
        success: true,
        data: {
          profile: {
            blood_group: 'B+',
            city: 'Dhaka',
            date_of_birth: '1998-05-15',
            latitude: 23.8103,
            longitude: 90.4125,
            available: true,
            last_donated_at: '2025-10-01',
          },
        },
      }),
      updateDonorProfile: vi.fn().mockResolvedValue({ success: true }),
      setDonorAvailability: vi.fn().mockResolvedValue({ success: true }),
    },
  };
});

describe('DonorProfile Page', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders profile details and availability toggle', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <DonorProfile />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Donor Profile & Availability/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Blood Group/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/City \/ District/i)).toBeInTheDocument();
    expect(screen.getByText(/Available to Donate Blood/i)).toBeInTheDocument();
  });
});
