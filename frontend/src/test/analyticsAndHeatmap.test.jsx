import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminDashboard from '../pages/AdminDashboard';
import DonorFeed from '../pages/DonorFeed';
import HeatmapGrid from '../components/HeatmapGrid';
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
            totalRequests: 20,
            fulfilledRequests: 15,
            fulfillmentRate: 75,
            avgTimeToFirstAcceptMinutes: 8.2,
            totalDonors: 30,
            availableDonors: 18,
            totalUsers: 50,
            blockedUsers: 2,
            pendingReports: 1,
            requestsPerDay: [],
          },
        },
      }),
      getAdminRequests: vi.fn().mockResolvedValue({ success: true, data: { requests: [] } }),
      getAdminReports: vi.fn().mockResolvedValue({ success: true, data: { reports: [] } }),
      searchUsers: vi.fn().mockResolvedValue({ success: true, data: { users: [] } }),
      getAdminAnalyticsOverview: vi.fn().mockResolvedValue({
        success: true,
        data: {
          analytics: {
            totalRequests: 20,
            fulfilledRequests: 15,
            fulfillmentRatePct: 75,
            breakdown: [
              {
                area: 'Dhaka',
                bloodGroup: 'O-',
                totalRequests: 8,
                fulfilledRequests: 5,
                activeRequests: 3,
                fulfillmentRatePct: 62.5,
                totalDonors: 2,
                eligibleDonors: 1,
                supplyDemandRatio: 0.33,
                shortageRisk: true,
                avgTimeToAcceptMins: 14.2,
              },
            ],
          },
        },
      }),
      getAdminHeatmapGrid: vi.fn().mockResolvedValue({
        success: true,
        data: {
          grid: [
            {
              lat: 23.8103,
              lng: 90.4125,
              city: 'Dhaka Central',
              requestCount: 8,
              activeRequests: 3,
              donorCount: 2,
              eligibleDonors: 1,
              bloodGroups: ['O-'],
              supplyDemandRatio: 0.33,
              shortageRisk: true,
              intensity: 0.8,
            },
          ],
        },
      }),
      getAdminShortageForecast: vi.fn().mockResolvedValue({
        success: true,
        data: {
          forecast: [
            {
              bloodGroup: 'O-',
              city: 'Dhaka',
              weeklyHistory: [2, 1, 3, 2],
              movingAvgWeeklyDemand: 2.0,
              forecastedDemandNextWeek: 2,
              currentEligibleDonors: 1,
              riskLevel: 'HIGH',
              shortageRisk: true,
            },
          ],
        },
      }),
      getRecruitNudges: vi.fn().mockResolvedValue({
        success: true,
        data: {
          nudges: [
            {
              id: 'nudge-dhaka-o-neg',
              bloodGroup: 'O-',
              city: 'Dhaka',
              riskLevel: 'HIGH',
              title: 'Donors Urgently Needed in Dhaka',
              message: 'High demand for O- blood in Dhaka.',
              forecastedDemand: 2,
              eligibleDonors: 1,
            },
          ],
        },
      }),
      getMyMatches: vi.fn().mockResolvedValue({ success: true, data: { matches: [] } }),
      getNearbyRequests: vi.fn().mockResolvedValue({ success: true, data: { requests: [] } }),
    },
  };
});

describe('Phase 22 Frontend: Heatmap, Forecast & Nudges', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it('renders Admin Heatmap and Shortage Forecast tab and content', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify analytics tab button is rendered
    const tabBtn = await screen.findByRole('button', { name: /Demand Heatmap & Forecast/i });
    expect(tabBtn).toBeInTheDocument();

    // Click tab
    fireEvent.click(tabBtn);

    // Verify forecast alerts and table rendered
    await waitFor(() => {
      expect(screen.getByText(/Blood Group Shortage Risk Forecast/i)).toBeInTheDocument();
      expect(screen.getByText('HIGH RISK')).toBeInTheDocument();
      expect(screen.getByText(/Supply vs. Demand Breakdown by Area/i)).toBeInTheDocument();
      expect(screen.getByText('0.33x')).toBeInTheDocument();
    });
  });

  it('renders interactive HeatmapGrid and opens drawer on cell click', async () => {
    const mockGrid = [
      {
        lat: 23.8103,
        lng: 90.4125,
        city: 'Dhaka North',
        requestCount: 5,
        activeRequests: 2,
        donorCount: 4,
        eligibleDonors: 3,
        bloodGroups: ['A+'],
        supplyDemandRatio: 1.5,
        shortageRisk: false,
        intensity: 0.6,
      },
    ];

    render(<HeatmapGrid grid={mockGrid} />);

    expect(screen.getByText(/Geographic Demand & Supply Heatmap/i)).toBeInTheDocument();
    expect(screen.getByText('(1 active cells)')).toBeInTheDocument();

    // Click cell
    const cellEl = screen.getByTitle(/Dhaka North: 5 requests, 3 donors/i);
    expect(cellEl).toBeInTheDocument();
    fireEvent.click(cellEl);

    // Verify details drawer appears
    expect(screen.getByText(/Dhaka North \(23.810, 90.412\)/i)).toBeInTheDocument();
    expect(screen.getByText('1.5x')).toBeInTheDocument();
  });

  it('renders recruit nudges banner on DonorFeed for high risk shortage', async () => {
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
      expect(screen.getByText(/Donors Urgently Needed in Dhaka/i)).toBeInTheDocument();
      expect(screen.getByText(/High demand for O- blood in Dhaka/i)).toBeInTheDocument();
      expect(screen.getByText(/DONORS NEEDED/i)).toBeInTheDocument();
    });
  });
});
