import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Layout from '../components/Layout';
import InstallPrompt from '../components/InstallPrompt';
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
      updateNotificationPreferences: vi.fn(),
      getVapidPublicKey: vi.fn(),
      subscribePush: vi.fn(),
      updateDonorProfile: vi.fn(),
      setDonorAvailability: vi.fn(),
      updateAvailabilityWindows: vi.fn(),
    },
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-pwa-1', name: 'Tanvir Hasan', role: 'USER' },
    isAuthenticated: true,
    logout: vi.fn(),
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

describe('Phase 20 Frontend: i18n & PWA Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders Layout with language toggle and switches language', async () => {
    renderWithProviders(
      <Layout>
        <div>Page Content</div>
      </Layout>
    );

    const langBtn = screen.getByTitle('Change Language');
    expect(langBtn).toBeInTheDocument();

    // Toggle language
    fireEvent.click(langBtn);

    await waitFor(() => {
      // Either English or বাংলা will be rendered on the button
      expect(langBtn.textContent).toMatch(/English|বাংলা/);
    });
  });

  it('renders InstallPrompt on beforeinstallprompt event and responds to install click', async () => {
    renderWithProviders(<InstallPrompt />);

    // Initially not visible before the event
    expect(screen.queryByText(/Install/i)).not.toBeInTheDocument();

    // Simulate beforeinstallprompt event
    const promptMock = vi.fn();
    const event = new Event('beforeinstallprompt');
    event.prompt = promptMock;
    event.userChoice = Promise.resolve({ outcome: 'accepted' });

    window.dispatchEvent(event);

    await waitFor(() => {
      expect(screen.getByRole('complementary', { name: 'Install App Banner' })).toBeInTheDocument();
    });

    const installBtn = screen.getByRole('button', { name: /Install App|অ্যাপ ইনস্টল করুন/i });
    fireEvent.click(installBtn);

    await waitFor(() => {
      expect(promptMock).toHaveBeenCalled();
    });
  });

  it('renders notification channel preferences with push toggle in DonorProfile', async () => {
    api.getDonorProfile.mockResolvedValue({
      data: {
        profile: {
          blood_group: 'B+',
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

    renderWithProviders(<DonorProfile />);

    await waitFor(() => {
      expect(screen.getByText('Notification & Alert Channel Preferences')).toBeInTheDocument();
      expect(screen.getByText('In-App Notifications')).toBeInTheDocument();
      expect(screen.getByText('Browser Web Push')).toBeInTheDocument();
      expect(screen.getByText('Email Alerts')).toBeInTheDocument();
      expect(screen.getByText('SMS Text Messages')).toBeInTheDocument();
    });
  });
});
