import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  ShieldCheck,
  TrendingUp,
  Clock,
  Users,
  AlertOctagon,
  CheckCircle,
  XCircle,
  Search,
  Lock,
  Unlock,
  Radio,
  FileText,
  Filter,
} from 'lucide-react';

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('stats'); // 'stats' | 'requests' | 'reports' | 'users'
  const [requestStatusFilter, setRequestStatusFilter] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // 1. Fetch Dashboard Stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const res = await api.getAdminStats();
      return res.data?.stats || null;
    },
    refetchInterval: 15000,
  });

  // 2. Fetch Requests
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['adminRequests', requestStatusFilter],
    queryFn: async () => {
      const param = requestStatusFilter ? `status=${requestStatusFilter}` : '';
      const res = await api.getAdminRequests(param);
      return res.data?.requests || [];
    },
    enabled: activeTab === 'requests' || activeTab === 'stats',
  });

  // 3. Fetch Reports
  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['adminReports'],
    queryFn: async () => {
      const res = await api.getAdminReports();
      return res.data?.reports || [];
    },
    enabled: activeTab === 'reports' || activeTab === 'stats',
  });

  // 4. Search Users
  const { data: searchResults = [], refetch: runUserSearch } = useQuery({
    queryKey: ['adminUserSearch', userSearchTerm],
    queryFn: async () => {
      if (!userSearchTerm.trim()) return [];
      const res = await api.searchUsers(userSearchTerm);
      return res.data?.users || [];
    },
    enabled: false,
  });

  // Update Report Mutation
  const updateReportMutation = useMutation({
    mutationFn: ({ id, status, notes }) => api.updateReportStatus(id, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReports'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setFeedback({ type: 'success', message: 'Report status updated.' });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to update report.' });
    },
  });

  // Block / Unblock User Mutation
  const blockUserMutation = useMutation({
    mutationFn: ({ userId, isBlocked }) => api.setBlockUser(userId, isBlocked),
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['adminUserSearch', userSearchTerm] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setFeedback({
        type: 'success',
        message: vars.isBlocked
          ? 'User has been BLOCKED. They cannot log in or make requests.'
          : 'User has been UNBLOCKED.',
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to update block status.' });
    },
  });

  function handleSearchSubmit(e) {
    e.preventDefault();
    runUserSearch();
  }

  const stats = statsData || {
    totalRequests: 0,
    fulfilledRequests: 0,
    fulfillmentRate: 0,
    avgTimeToFirstAcceptMinutes: 0,
    totalDonors: 0,
    availableDonors: 0,
    totalUsers: 0,
    blockedUsers: 0,
    pendingReports: 0,
    requestsPerDay: [],
  };

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={30} color="var(--primary)" />
          <span>Admin & Safety Operations</span>
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Monitor system metrics, fulfillment performance, abuse reports, and user safety enforcement.
        </p>
      </div>

      {feedback.message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 20,
            background: feedback.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)',
            fontSize: '0.92rem',
            fontWeight: 600,
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* Top Stats Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card" style={{ padding: 16 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Requests</span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>{stats.totalRequests}</h2>
          <small style={{ color: 'var(--text-muted)' }}>Fulfilled: {stats.fulfilledRequests}</small>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Fulfillment Rate</span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>
            {stats.fulfillmentRate}%
          </h2>
          <small style={{ color: 'var(--text-muted)' }}>Target: &gt; 80%</small>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Avg Response Time</span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--info)', marginTop: 4 }}>
            {stats.avgTimeToFirstAcceptMinutes} min
          </h2>
          <small style={{ color: 'var(--text-muted)' }}>Time to first donor accept</small>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Registered Donors</span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>{stats.totalDonors}</h2>
          <small style={{ color: 'var(--success)', fontWeight: 600 }}>Available: {stats.availableDonors}</small>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Safety Reports</span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: stats.pendingReports > 0 ? 'var(--danger)' : 'var(--text-main)', marginTop: 4 }}>
            {stats.pendingReports}
          </h2>
          <small style={{ color: 'var(--text-muted)' }}>Blocked Users: {stats.blockedUsers}</small>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab('stats')}
          className={`btn btn-sm ${activeTab === 'stats' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <TrendingUp size={16} />
          <span>Dashboard & Trends</span>
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`btn btn-sm ${activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <FileText size={16} />
          <span>All Requests</span>
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`btn btn-sm ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <AlertOctagon size={16} />
          <span>Reports Queue ({stats.pendingReports})</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Users size={16} />
          <span>User Safety & Blocking</span>
        </button>
      </div>

      {/* Tab: Dashboard & Trends */}
      {activeTab === 'stats' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Requests per Day (Last 7 Days)</h3>
            {stats.requestsPerDay.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No request activity recorded in this period.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.requestsPerDay.map((d) => (
                  <div key={d.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{d.date}</span>
                    <span className="badge badge-normal" style={{ fontSize: '0.8rem' }}>{d.count} requests</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Safety & Concurrency Health</h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.9rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={18} color="var(--success)" />
                <span>Row-level locks active on concurrent donor acceptance</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={18} color="var(--success)" />
                <span>Daily rate limiting (max 3 requests / 24h) enforced</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={18} color="var(--success)" />
                <span>Phone contacts strictly hidden until mutual match acceptance</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={18} color="var(--success)" />
                <span>Approximate-distance display enabled for donor privacy</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab: All Requests */}
      {activeTab === 'requests' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>System Requests</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={16} color="var(--text-muted)" />
              <select
                className="form-control"
                style={{ minHeight: 34, padding: '4px 8px', fontSize: '0.85rem' }}
                value={requestStatusFilter}
                onChange={(e) => setRequestStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="PARTIALLY_FULFILLED">PARTIALLY_FULFILLED</option>
                <option value="FULFILLED">FULFILLED</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          </div>

          {requestsLoading ? (
            <p style={{ textAlign: 'center', padding: 24 }}>Loading requests...</p>
          ) : requests.length === 0 ? (
            <p style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No requests found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>Patient</th>
                    <th style={{ padding: '8px 10px' }}>Blood</th>
                    <th style={{ padding: '8px 10px' }}>Hospital</th>
                    <th style={{ padding: '8px 10px' }}>Requester</th>
                    <th style={{ padding: '8px 10px' }}>Progress</th>
                    <th style={{ padding: '8px 10px' }}>Urgency</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 10px', fontWeight: 600 }}>{r.patient_name}</td>
                      <td style={{ padding: '10px 10px' }}><span className="badge badge-blood">{r.blood_group}</span></td>
                      <td style={{ padding: '10px 10px' }}>{r.hospital_name}</td>
                      <td style={{ padding: '10px 10px' }}>{r.requester_name} ({r.requester_phone})</td>
                      <td style={{ padding: '10px 10px' }}>{r.accepted_count} / {r.units_needed}</td>
                      <td style={{ padding: '10px 10px' }}>
                        <span className={`badge badge-${r.urgency ? r.urgency.toLowerCase() : 'normal'}`}>{r.urgency}</span>
                      </td>
                      <td style={{ padding: '10px 10px', fontWeight: 700 }}>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Reports Queue */}
      {activeTab === 'reports' && (
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16 }}>Safety Reports Queue</h3>

          {reportsLoading ? (
            <p style={{ textAlign: 'center', padding: 24 }}>Loading reports...</p>
          ) : reports.length === 0 ? (
            <p style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No abuse reports in queue.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reports.map((rep) => (
                <div key={rep.id} style={{ padding: 14, background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span className={`badge ${rep.status === 'PENDING' ? 'badge-critical' : 'badge-normal'}`}>
                        {rep.status}
                      </span>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, marginTop: 6 }}>{rep.reason}</h4>
                      {rep.details && <p style={{ fontSize: '0.85rem', color: '#334155', marginTop: 2 }}>"{rep.details}"</p>}
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
                        Reported by: <strong>{rep.reporter_name}</strong> ({rep.reporter_phone}) • {new Date(rep.created_at).toLocaleString()}
                      </div>
                      {rep.reported_user_name && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--danger)', marginTop: 2 }}>
                          Reported User: <strong>{rep.reported_user_name}</strong> ({rep.reported_user_phone})
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      {rep.user_id && (
                        <button
                          onClick={() => blockUserMutation.mutate({ userId: rep.user_id, isBlocked: true })}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                        >
                          <Lock size={12} />
                          <span>Block User</span>
                        </button>
                      )}
                      {rep.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => updateReportMutation.mutate({ id: rep.id, status: 'RESOLVED', notes: 'Action taken by admin' })}
                            className="btn btn-success btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => updateReportMutation.mutate({ id: rep.id, status: 'DISMISSED', notes: 'No violation found' })}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          >
                            Dismiss
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: User Safety & Blocking */}
      {activeTab === 'users' && (
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16 }}>User Search & Access Control</h3>

          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search user by name, phone (+8801...), or email..."
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" style={{ minWidth: 100 }}>
              <Search size={16} />
              <span>Search</span>
            </button>
          </form>

          {searchResults.length === 0 && userSearchTerm && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No matching users found.</p>
          )}

          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {searchResults.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 12,
                    background: u.is_blocked ? '#fee2e2' : '#f8fafc',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${u.is_blocked ? '#fca5a5' : 'var(--border)'}`,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700 }}>{u.name}</span>
                      <span className="badge badge-normal">{u.role}</span>
                      {u.is_blocked && <span className="badge badge-critical">BLOCKED</span>}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {u.phone} • {u.email}
                    </div>
                  </div>

                  <div>
                    {u.role !== 'ADMIN' && (
                      <button
                        onClick={() =>
                          blockUserMutation.mutate({ userId: u.id, isBlocked: !u.is_blocked })
                        }
                        disabled={blockUserMutation.isPending}
                        className={`btn btn-sm ${u.is_blocked ? 'btn-success' : 'btn-danger'}`}
                      >
                        {u.is_blocked ? (
                          <>
                            <Unlock size={14} />
                            <span>Unblock</span>
                          </>
                        ) : (
                          <>
                            <Lock size={14} />
                            <span>Block User</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
