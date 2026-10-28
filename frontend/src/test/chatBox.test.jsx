import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatBox from '../components/ChatBox';
import { api } from '../api/client';

// Mock scrollTo
window.HTMLElement.prototype.scrollIntoView = vi.fn();

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
      getChatThread: vi.fn(),
      getChatThreadByMatch: vi.fn(),
      getChatMessages: vi.fn(),
      sendChatMessage: vi.fn(),
      shareChatPhone: vi.fn(),
      blockChatUser: vi.fn(),
    },
  };
});

describe('Phase 19 Frontend: ChatBox & Privacy UI', () => {
  const mockUser = { id: 'usr-1', name: 'Requester Alice', role: 'USER' };
  const mockThread = {
    id: 'thread-123',
    match_id: 'match-123',
    requester_id: 'usr-1',
    donor_id: 'usr-2',
    requester_name: 'Requester Alice',
    donor_name: 'Donor Bob',
    donor_phone: '018****4444',
    requester_phone: '017****2222',
    status: 'OPEN',
    phone_shared_by_donor: false,
    phone_shared_by_requester: false,
  };

  const mockMessages = [
    {
      id: 'msg-1',
      thread_id: 'thread-123',
      sender_id: 'usr-2',
      sender_name: 'Donor Bob',
      content: 'Hello Alice, I am on my way to donate.',
      is_system: false,
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    api.getChatThreadByMatch.mockResolvedValue({ data: mockThread });
    api.getChatMessages.mockResolvedValue({ data: mockMessages });
  });

  it('renders chat header, masked phone privacy banner, and messages list', async () => {
    render(<ChatBox matchId="match-123" currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Donor Bob')).toBeInTheDocument();
      expect(screen.getByText('Volunteer Donor')).toBeInTheDocument();
      expect(screen.getByText('Masked Privacy Mode Active')).toBeInTheDocument();
      expect(screen.getByText('Phone numbers masked for safety.')).toBeInTheDocument();
      expect(screen.getByText('Share Contact Number')).toBeInTheDocument();
      expect(screen.getByText('Hello Alice, I am on my way to donate.')).toBeInTheDocument();
    });
  });

  it('sends message via send button', async () => {
    api.sendChatMessage.mockResolvedValue({
      data: {
        id: 'msg-2',
        thread_id: 'thread-123',
        sender_id: 'usr-1',
        sender_name: 'Requester Alice',
        content: 'Thank you Bob, see you at reception.',
        is_system: false,
        created_at: new Date().toISOString(),
      },
    });

    render(<ChatBox matchId="match-123" currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Message Donor Bob...')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Message Donor Bob...');
    fireEvent.change(input, { target: { value: 'Thank you Bob, see you at reception.' } });

    const submitBtn = screen.getByRole('button', { name: '' }); // Send icon button
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.sendChatMessage).toHaveBeenCalledWith('thread-123', 'Thank you Bob, see you at reception.');
      expect(screen.getByText('Thank you Bob, see you at reception.')).toBeInTheDocument();
    });
  });

  it('handles sharing contact phone', async () => {
    api.shareChatPhone.mockResolvedValue({
      data: {
        phonesUnlocked: false,
        thread: {
          ...mockThread,
          phone_shared_by_requester: true,
        },
      },
    });

    render(<ChatBox matchId="match-123" currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Share Contact Number')).toBeInTheDocument();
    });

    const shareBtn = screen.getByText('Share Contact Number');
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(api.shareChatPhone).toHaveBeenCalledWith('thread-123');
      expect(screen.getByText('Waiting for Donor Bob...')).toBeInTheDocument();
    });
  });
});
