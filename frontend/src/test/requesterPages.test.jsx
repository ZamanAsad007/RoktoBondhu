import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LandingPage from '../pages/LandingPage';
import CreateRequest from '../pages/CreateRequest';
import MyRequests from '../pages/MyRequests';
import RequestDetail from '../pages/RequestDetail';
import NotificationsInbox from '../pages/NotificationsInbox';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    api: {
      ...actual.api,
      createBloodRequest: vi.fn().mockResolvedValue({ success: true, data: { id: 'req-101' } }),
      getMyRequests: vi.fn().mockResolvedValue({
        success: true,
        data: {
          requests: [
            {
              id: 'req-1',
              hospital_name: 'Apollo Hospital',
              patient_name: 'Farhana',
              blood_group: 'B+',
              units_needed: 2,
              accepted_count: 1,
              status: 'PARTIALLY_FULFILLED',
              urgency: 'URGENT',
              wave_number: 2,
              current_radius_km: 10,
              needed_by: '2026-10-27T18:00:00Z',
            },
          ],
        },
      }),
      getRequestById: vi.fn().mockResolvedValue({
        success: true,
        data: {
          request: {
            id: 'req-1',
            hospital_name: 'Apollo Hospital',
            patient_name: 'Farhana',
            blood_group: 'B+',
            units_needed: 2,
            status: 'PARTIALLY_FULFILLED',
            urgency: 'URGENT',
            wave_number: 2,
            current_radius_km: 10,
            needed_by: '2026-10-27T18:00:00Z',
            expires_at: '2026-10-28T00:00:00Z',
            matches: [
              {
                id: 'm-101',
                donor_id: 'd-1',
                donor_name: 'Dr. Kabir',
                donor_phone: '+8801711223344',
                donor_blood_group: 'B+',
                distance_km: 2.5,
                status: 'ACCEPTED',
              },
            ],
          },
        },
      }),
      getNotifications: vi.fn().mockResolvedValue({
        success: true,
        data: {
          notifications: [
            {
              id: 'notif-1',
              channel: 'in_app',
              type: 'request.nearby',
              payload: { title: 'Emergency Blood Request Nearby', message: 'Patient needs B+ blood' },
              created_at: '2026-10-27T10:00:00Z',
              read_at: null,
            },
          ],
          unread_count: 1,
        },
      }),
      confirmDonation: vi.fn().mockResolvedValue({ success: true }),
      markNotificationRead: vi.fn().mockResolvedValue({ success: true }),
      markAllNotificationsRead: vi.fn().mockResolvedValue({ success: true }),
    },
  };
});

describe('Phase 9 Frontend Requester Pages', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders LandingPage with two clear CTAs and live stats', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByRole('link', { name: /Need Blood Now/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /I Want to Donate/i })).toBeInTheDocument();
    expect(screen.getByText(/Active Donors Seeded in Dhaka/i)).toBeInTheDocument();
    expect(screen.getByText(/Concurrency-Safe Allocations/i)).toBeInTheDocument();
  });

  it('renders CreateRequest form with map pin and urgency options', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <CreateRequest />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText(/Request Emergency Blood/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Patient Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hospital Name/i)).toBeInTheDocument();
    expect(screen.getByText(/Critical \(SOS\)/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Publish Request & Dispatch Wave 1/i })
    ).toBeInTheDocument();
  });

  it('renders MyRequests with progress indicator', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <MyRequests />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Apollo Hospital')).toBeInTheDocument();
    });

    expect(screen.getByText(/1 of 2 donors confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/Wave 2/i)).toBeInTheDocument();
  });

  it('renders RequestDetail with accepted donors and phone contact', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/requests/req-1']}>
            <Routes>
              <Route path="/requests/:id" element={<RequestDetail />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Apollo Hospital')).toBeInTheDocument();
    });

    expect(screen.getByText('Dr. Kabir')).toBeInTheDocument();
    expect(screen.getByText('+8801711223344')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Donation/i })).toBeInTheDocument();
  });

  it('renders NotificationsInbox with unread badge and notification items', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <NotificationsInbox />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Emergency Blood Request Nearby')).toBeInTheDocument();
    });

    expect(screen.getByText('1 Unread')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark all read/i })).toBeInTheDocument();
  });
});
