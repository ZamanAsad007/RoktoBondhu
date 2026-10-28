import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DonorProfile from '../pages/DonorProfile';
import { api } from '../api/client';
import '../i18n';

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
      getDonorProfile: vi.fn(),
      getNotificationPreferences: vi.fn(),
      getTelegramStatus: vi.fn(),
      getTelegramLinkCode: vi.fn(),
      unlinkTelegram: vi.fn(),
      updateDonorProfile: vi.fn(),
      setDonorAvailability: vi.fn(),
      updateAvailabilityWindows: vi.fn(),
    },
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-tg-1', name: 'Farhan Kabir', role: 'USER' },
    isAuthenticated: true,
  }),
}));

function renderWithProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Phase 21 Frontend: Telegram Bot Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    api.getDonorProfile.mockResolvedValue({
      data: {
        profile: {
          blood_group: 'AB+',
          city: 'Dhaka',
          available: true,
        },
      },
    });

    api.getNotificationPreferences.mockResolvedValue({
      data: {
        in_app: true,
        email: true,
        sms: false,
        push: true,
      },
    });
  });

  it('renders Telegram section with Connect button when unlinked', async () => {
    api.getTelegramStatus.mockResolvedValue({
      data: {
        isLinked: false,
        botUsername: 'RoktoBondhuBot',
      },
    });

    renderWithProviders(<DonorProfile />);

    await waitFor(() => {
      expect(screen.getByText('Telegram Emergency Alerts Bot')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Connect Telegram Bot/i })).toBeInTheDocument();
    });
  });

  it('generates linking code and displays /start command instructions', async () => {
    api.getTelegramStatus.mockResolvedValue({
      data: {
        isLinked: false,
        botUsername: 'RoktoBondhuBot',
      },
    });

    api.getTelegramLinkCode.mockResolvedValue({
      data: {
        linkCode: '492815',
        botUsername: 'RoktoBondhuBot',
      },
    });

    renderWithProviders(<DonorProfile />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Connect Telegram Bot/i })).toBeInTheDocument();
    });

    const connectBtn = screen.getByRole('button', { name: /Connect Telegram Bot/i });
    fireEvent.click(connectBtn);

    await waitFor(() => {
      expect(api.getTelegramLinkCode).toHaveBeenCalled();
      expect(screen.getByText('Complete Linking on Telegram:')).toBeInTheDocument();
      expect(screen.getByText('/start 492815')).toBeInTheDocument();
    });
  });

  it('renders connected status and Disconnect button when account is linked', async () => {
    api.getTelegramStatus.mockResolvedValue({
      data: {
        isLinked: true,
        telegramUsername: 'farhan_tg',
        isActive: true,
      },
    });

    renderWithProviders(<DonorProfile />);

    await waitFor(() => {
      expect(screen.getByText('Connected to Telegram')).toBeInTheDocument();
      expect(screen.getByText(/farhan_tg/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Disconnect Telegram/i })).toBeInTheDocument();
    });
  });
});
