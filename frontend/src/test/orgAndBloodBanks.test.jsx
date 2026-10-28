import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BloodBanks from '../pages/BloodBanks';
import BloodDrives from '../pages/BloodDrives';
import OrgDashboard from '../pages/OrgDashboard';
import { ToastProvider } from '../context/ToastContext';
import { api } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    tokenStorage: {
      getAccessToken: vi.fn(() => 'mock-token'),
      getRefreshToken: vi.fn(() => 'mock-refresh'),
      setTokens: vi.fn(),
      clearTokens: vi.fn(),
    },
    api: {
      ...actual.api,
      getNearbyBloodBanks: vi.fn(),
      getNearbyDrives: vi.fn(),
      getMyOrg: vi.fn(),
      getOrgInventory: vi.fn(),
      getMyDrives: vi.fn(),
      getDriveAttendees: vi.fn(),
      updateInventory: vi.fn(),
      createDrive: vi.fn(),
      rsvpDrive: vi.fn(),
      cancelDriveRsvp: vi.fn(),
      markDriveAttendance: vi.fn(),
      registerOrg: vi.fn(),
    },
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-org-1', name: 'Org Admin', role: 'ORG' },
    isAuthenticated: true,
  }),
}));

function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('Phase 17 Frontend: Organizations, Blood Banks & Drives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders BloodBanks page with search filters and nearby blood bank inventory', async () => {
    api.getNearbyBloodBanks.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'org-1',
          org_name: 'BDRCS Blood Center',
          is_verified: true,
          address: 'Moghbazar, Dhaka',
          distance_km: '2.5',
          contact_phone: '+8801700000000',
          inventory: [
            { blood_group: 'O+', units_available: 2, is_low_stock: true },
            { blood_group: 'A+', units_available: 10, is_low_stock: false },
          ],
        },
      ],
    });

    renderWithProviders(<BloodBanks />);

    await waitFor(() => {
      expect(screen.getByText('Blood Banks & Inventory')).toBeInTheDocument();
      expect(screen.getByText('BDRCS Blood Center')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
      expect(screen.getByText('2 units')).toBeInTheDocument();
      expect(screen.getByText('10 units')).toBeInTheDocument();
    });
  });

  it('renders BloodDrives page with upcoming drives and RSVP button', async () => {
    api.getNearbyDrives.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'drv-1',
          title: 'Dhanmondi Youth Blood Drive',
          org_name: 'Red Crescent Dhaka',
          venue_name: 'Dhanmondi Lake',
          address: 'Road 8A, Dhaka',
          start_time: '2026-11-01T10:00:00Z',
          end_time: '2026-11-01T16:00:00Z',
          capacity: 50,
          rsvp_count: 15,
          status: 'UPCOMING',
          distance_km: '1.2',
          is_verified: true,
        },
      ],
    });

    renderWithProviders(<BloodDrives />);

    await waitFor(() => {
      expect(screen.getByText('Community Blood Drives')).toBeInTheDocument();
      expect(screen.getByText('Dhanmondi Youth Blood Drive')).toBeInTheDocument();
      expect(screen.getByText('RSVP to Donate')).toBeInTheDocument();
      expect(screen.getByText('15 / 50 donors')).toBeInTheDocument();
    });
  });

  it('renders OrgDashboard with profile and inventory adjustment', async () => {
    api.getMyOrg.mockResolvedValue({
      success: true,
      data: {
        id: 'org-1',
        org_name: 'National Blood Transfusion Center',
        is_verified: true,
        registration_number: 'DGHS-999',
        address: 'Shahbag, Dhaka',
        contact_phone: '+8801700111222',
      },
    });

    api.getOrgInventory.mockResolvedValue({
      success: true,
      data: [
        { blood_group: 'O+', units_available: 5, low_stock_threshold: 5 },
      ],
    });

    api.getMyDrives.mockResolvedValue({
      success: true,
      data: [],
    });

    renderWithProviders(<OrgDashboard />);

    await waitFor(() => {
      expect(screen.getByText('National Blood Transfusion Center')).toBeInTheDocument();
      expect(screen.getByText('Verified Organization')).toBeInTheDocument();
      expect(screen.getByText('Blood Inventory')).toBeInTheDocument();
    });
  });
});
