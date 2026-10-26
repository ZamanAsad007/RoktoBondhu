import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  Bell,
  CheckCheck,
  Check,
  Clock,
  Mail,
  MessageSquare,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotificationsInbox() {
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const {
    data: notifData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: async () => {
      const res = await api.getNotifications(`unread_only=${unreadOnly}&channel=all`);
      return res.data || { notifications: [], unread_count: 0 };
    },
    refetchInterval: 12000,
  });

  const notifications = notifData?.notifications || [];
  const unreadCount = notifData?.unread_count || 0;

  // Mark single as read
  const markReadMutation = useMutation({
    mutationFn: (id) => api.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read
  const markAllMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <div style={{ maxWidth: 750, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={26} color="var(--primary)" />
            <span>Notifications Inbox</span>
            {unreadCount > 0 && (
              <span className="badge badge-critical" style={{ fontSize: '0.8rem' }}>
                {unreadCount} Unread
              </span>
            )}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Stay updated on wave alerts, donor acceptances, reminders, and fulfillment.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="btn btn-secondary btn-sm"
          >
            <CheckCheck size={16} />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setUnreadOnly(false)}
          className={`btn btn-sm ${!unreadOnly ? 'btn-primary' : 'btn-secondary'}`}
        >
          All Notifications
        </button>
        <button
          onClick={() => setUnreadOnly(true)}
          className={`btn btn-sm ${unreadOnly ? 'btn-primary' : 'btn-secondary'}`}
        >
          Unread Only ({unreadCount})
        </button>
      </div>

      {isLoading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading notifications...</p>
      ) : error ? (
        <div className="card" style={{ color: 'var(--danger)', textAlign: 'center', padding: 30 }}>
          {error.message || 'Failed to load notifications.'}
        </div>
      ) : notifications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <Bell size={36} color="var(--border)" style={{ margin: '0 auto 10px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No notifications</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            {unreadOnly ? 'You have read all of your notifications!' : 'Your inbox is empty.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifications.map((n) => {
            const isRead = !!n.read_at;
            const payload = typeof n.payload === 'string' ? JSON.parse(n.payload) : n.payload || {};

            return (
              <div
                key={n.id}
                className="card"
                style={{
                  padding: 16,
                  background: isRead ? '#ffffff' : '#fef2f2',
                  borderLeft: `4px solid ${isRead ? 'var(--border)' : 'var(--primary)'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background:
                          n.channel === 'in_app'
                            ? 'var(--primary-light)'
                            : n.channel === 'email'
                            ? 'var(--info-light)'
                            : 'var(--warning-light)',
                        color:
                          n.channel === 'in_app'
                            ? 'var(--primary-dark)'
                            : n.channel === 'email'
                            ? 'var(--info)'
                            : '#b45309',
                      }}
                    >
                      {n.channel}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1rem', fontWeight: isRead ? 600 : 800 }}>
                    {payload.title || n.type}
                  </h4>
                  <p style={{ fontSize: '0.88rem', color: '#334155', marginTop: 2 }}>
                    {payload.message || JSON.stringify(payload)}
                  </p>

                  {payload.actionUrl && (
                    <Link
                      to={payload.actionUrl}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: 'var(--primary)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        marginTop: 6,
                      }}
                    >
                      <span>View details</span>
                      <ExternalLink size={12} />
                    </Link>
                  )}
                </div>

                {!isRead && (
                  <button
                    onClick={() => markReadMutation.mutate(n.id)}
                    disabled={markReadMutation.isPending}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                    title="Mark as read"
                  >
                    <Check size={14} />
                    <span>Read</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
