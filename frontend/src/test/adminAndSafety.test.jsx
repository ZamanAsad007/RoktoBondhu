import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReportModal from '../components/ReportModal';
import AdminDashboard from '../pages/AdminDashboard';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    api: {
      ...actual.api,
      getAdminStats: vi.fn().mockResolvedValue({
        success: true,
        data: {
          stats: {
            totalRequests: 25,
            fulfilledRequests: 21,
            fulfillmentRate: 84,
            avgTimeToFirstAcceptMinutes: 7.5,
            totalDonors: 15,
            availableDonors: 12,
            totalUsers: 30,
            blockedUsers: 1,
            pendingReports: 2,
            requestsPerDay: [
              { date: '2026-10-25', count: 4 },
              { date: '2026-10-26', count: 7 },
            ],
          },
        },
      }),
      getAdminRequests: vi.fn().mockResolvedValue({
        success: true,
        data: {
          requests: [
            {
              id: 'r-1',
              patient_name: 'Sadia Rahman',
              blood_group: 'AB-',
              hospital_name: 'Evercare Hospital',
              requester_name: 'Anisul',
              requester_phone: '+8801700112233',
              accepted_count: 1,
              units_needed: 1,
              urgency: 'CRITICAL',
              status: 'FULFILLED',
            },
          ],
        },
      }),
      getAdminReports: vi.fn().mockResolvedValue({
        success: true,
        data: {
          reports: [
            {
              id: 'rep-1',
              reason: 'Commercial blood sale demanded',
              details: 'User asked 5000 BDT for blood unit',
              status: 'PENDING',
              reporter_name: 'Tamim',
              reporter_phone: '+8801811223344',
              user_id: 'u-bad',
              reported_user_name: 'Scammer',
              reported_user_phone: '+8801911223344',
              created_at: '2026-10-27T00:00:00Z',
            },
          ],
        },
      }),
      searchUsers: vi.fn().mockResolvedValue({
        success: true,
        data: {
          users: [
            {
              id: 'u-bad',
              name: 'Abusive User',
              phone: '+8801911223344',
              email: 'abuse@example.com',
              role: 'USER',
              is_blocked: false,
            },
          ],
        },
      }),
      createReport: vi.fn().mockResolvedValue({ success: true }),
      setBlockUser: vi.fn().mockResolvedValue({ success: true }),
      updateReportStatus: vi.fn().mockResolvedValue({ success: true }),
    },
  };
});

describe('Phase 10 Admin & Safety Components', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders ReportModal with reason choices and submit action', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ReportModal requestId="req-123" onClose={vi.fn()} />
      </QueryClientProvider>
    );

    expect(screen.getByText('Submit Safety Report')).toBeInTheDocument();
    expect(screen.getByLabelText(/Primary Reason/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Report/i })).toBeInTheDocument();
  });

  it('renders AdminDashboard with stats, fulfillment rate, and response times', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <AdminDashboard />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('84%')).toBeInTheDocument();
    });

    expect(screen.getByText('7.5 min')).toBeInTheDocument();
    expect(screen.getByText(/Requests per Day/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reports Queue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /User Safety & Blocking/i })).toBeInTheDocument();
  });
});
