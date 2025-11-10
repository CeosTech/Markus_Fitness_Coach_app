import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import Loader from './shared/Loader';

interface AdminUser {
  id: number;
  email: string;
  firstName?: string | null;
  subscriptionTier: 'free' | 'pro' | 'elite';
  analysisCount: number;
  planCount: number;
  goalsCompleted: number;
  isAdmin: boolean;
}

interface AdminUserDetails {
  analyses: Array<{ id: number; type: string; exerciseName?: string | null; prompt?: string | null; createdAt: string }>;
  plans: Array<{ id: number; plan_name: string; createdAt: string }>;
  goals: Array<{ id: number; text: string; completed: number; createdAt: string }>;
}

interface AdminStats {
  totalUsers: number;
  totalAnalyses: number;
  totalPlans: number;
  totalGoalsCompleted: number;
  avgXp: number;
  topUsers: Array<{ email: string; analyses: number }>;
}

interface MetricPoint {
  day: string;
  label: string;
  count: number;
}

interface AdminMetrics {
  range: number;
  analysisSeries: MetricPoint[];
  signupSeries: MetricPoint[];
}

interface AdminLog {
  id: number;
  admin_email: string;
  action: string;
  payload_json?: string | null;
  createdAt: string;
}

interface CmsEntry {
  key: string;
  value: string;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

const tierOptions: Array<{ value: AdminUser['subscriptionTier']; label: string }> = [
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'elite', label: 'Elite' },
];

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | AdminUser['subscriptionTier']>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userDetails, setUserDetails] = useState<AdminUserDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricRange, setMetricRange] = useState(14);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [cmsEntries, setCmsEntries] = useState<CmsEntry[]>([]);
  const [cmsDrafts, setCmsDrafts] = useState<Record<string, string>>({});
  const [cmsMessage, setCmsMessage] = useState<string | null>(null);
  const [cmsSaving, setCmsSaving] = useState(false);
  const [newCmsEntry, setNewCmsEntry] = useState<{ key: string; value: string }>({ key: '', value: '' });
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(() => new Set());
  const [bulkTier, setBulkTier] = useState<AdminUser['subscriptionTier']>('pro');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const loadUsers = useCallback(() => {
    setIsLoading(true);
    fetch('/api/admin/users')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
      })
      .then((data: AdminUser[]) => {
        setUsers(data);
        setError(null);
        setSelectedUserIds(prev => {
          if (prev.size === 0) return prev;
          const next = new Set<number>();
          data.forEach(user => {
            if (prev.has(user.id)) {
              next.add(user.id);
            }
          });
          return next;
        });
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    fetch('/api/admin/stats')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch stats');
        return res.json();
      })
      .then((data: AdminStats) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  const loadMetrics = useCallback((range: number) => {
    setMetricsLoading(true);
    fetch(`/api/admin/metrics?range=${range}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch metrics');
        return res.json();
      })
      .then((data: AdminMetrics) => setMetrics(data))
      .catch(() => setMetrics(null))
      .finally(() => setMetricsLoading(false));
  }, []);

  const loadLogs = useCallback(() => {
    setLogsLoading(true);
    fetch('/api/admin/logs')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch logs');
        return res.json();
      })
      .then((data: AdminLog[]) => setLogs(data || []))
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false));
  }, []);

  const loadCms = useCallback(() => {
    fetch('/api/admin/cms')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load CMS entries');
        return res.json();
      })
      .then((data: { entries: CmsEntry[] }) => {
        setCmsEntries(data.entries || []);
        setCmsDrafts({});
      })
      .catch(() => setCmsEntries([]));
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadStats();
    loadLogs();
    loadCms();
  }, [loadStats, loadLogs, loadCms]);

  useEffect(() => {
    loadMetrics(metricRange);
  }, [metricRange, loadMetrics]);

  const handleTierChange = async (userId: number, tier: AdminUser['subscriptionTier']) => {
    setSavingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSavingUserId(null);
    }
  };

  const toggleUserSelection = (id: number) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedUserIds(new Set());
  const selectedCount = selectedUserIds.size;

  const performBulkAction = async (action: 'setTier' | 'resetTools' | 'notify') => {
    if (!selectedCount) return;
    if (action === 'setTier' && !bulkTier) return;
    setBulkLoading(true);
    setBulkMessage(null);
    try {
      const res = await fetch('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userIds: Array.from(selectedUserIds),
          tier: action === 'setTier' ? bulkTier : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Bulk action failed');
      setBulkMessage(data.message || t('admin.bulk.successFallback'));
      setBulkStatus('success');
      clearSelection();
      if (action !== 'notify') {
        loadUsers();
      }
      loadLogs();
      setTimeout(() => setBulkMessage(null), 4000);
    } catch (err) {
      setBulkStatus('error');
      setBulkMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleCmsValueChange = (key: string, value: string) => {
    setCmsDrafts(prev => ({ ...prev, [key]: value }));
  };

  const handleCmsSave = async () => {
    const updates = Object.entries(cmsDrafts).map(([key, value]) => ({ key, value }));
    if (newCmsEntry.key.trim()) {
      updates.push({ key: newCmsEntry.key.trim(), value: newCmsEntry.value });
    }
    if (!updates.length) {
      setCmsMessage(t('admin.cms.noChanges'));
      return;
    }
    setCmsSaving(true);
    setCmsMessage(null);
    try {
      const res = await fetch('/api/admin/cms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'CMS update failed');
      setCmsMessage(data.message);
      setCmsDrafts({});
      setNewCmsEntry({ key: '', value: '' });
      loadCms();
    } catch (err) {
      setCmsMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCmsSaving(false);
      setTimeout(() => setCmsMessage(null), 4000);
    }
  };

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return users.filter(user => {
      const matchesTier = tierFilter === 'all' || user.subscriptionTier === tierFilter;
      const matchesSearch = !term || user.email.toLowerCase().includes(term) || (user.firstName || '').toLowerCase().includes(term);
      return matchesTier && matchesSearch;
    });
  }, [users, searchTerm, tierFilter]);

  const isAllSelected = filteredUsers.length > 0 && filteredUsers.every(user => selectedUserIds.has(user.id));

  const openUserDetails = (user: AdminUser) => {
    setSelectedUser(user);
    setDetailsLoading(true);
    setDetailsError(null);
    fetch(`/api/admin/users/${user.id}/details`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load details');
        return res.json();
      })
      .then((data: AdminUserDetails) => setUserDetails(data))
      .catch(err => setDetailsError(err.message))
      .finally(() => setDetailsLoading(false));
  };

  const closeDetails = () => {
    setSelectedUser(null);
    setUserDetails(null);
    setDetailsError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">{t('admin.title')}</h2>
        <p className="text-gray-400">{t('admin.subtitle')}</p>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('admin.searchPlaceholder')}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white"
          />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as typeof tierFilter)}
            className="bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white"
          >
            <option value="all">{t('admin.filter.all')}</option>
            <option value="free">{t('admin.tiers.free')}</option>
            <option value="pro">{t('admin.tiers.pro')}</option>
            <option value="elite">{t('admin.tiers.elite')}</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={loadUsers}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {t('admin.refresh')}
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statsLoading ? (
          <div className="col-span-4 bg-gray-800 rounded-lg p-6 flex justify-center">
            <Loader />
          </div>
        ) : stats ? (
          <>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-xs uppercase tracking-wide text-gray-400">{t('admin.stats.cards.totalUsers')}</p>
              <p className="text-3xl font-semibold text-white mt-2">{stats.totalUsers}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-xs uppercase tracking-wide text-gray-400">{t('admin.stats.cards.analyses')}</p>
              <p className="text-3xl font-semibold text-white mt-2">{stats.totalAnalyses}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-xs uppercase tracking-wide text-gray-400">{t('admin.stats.cards.plans')}</p>
              <p className="text-3xl font-semibold text-white mt-2">{stats.totalPlans}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-xs uppercase tracking-wide text-gray-400">{t('admin.stats.cards.avgXp')}</p>
              <p className="text-3xl font-semibold text-white mt-2">{stats.avgXp}</p>
              <p className="text-xs text-gray-500">{t('admin.stats.cards.goals', { count: stats.totalGoalsCompleted })}</p>
            </div>
          </>
        ) : (
          <p className="col-span-4 text-sm text-gray-400">{t('admin.stats.empty')}</p>
        )}
      </section>

      {stats && stats.topUsers?.length > 0 && (
        <section className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-white mb-3">{t('admin.stats.topUsers')}</h3>
          <ul className="divide-y divide-gray-700">
            {stats.topUsers.map(user => (
              <li key={user.email} className="flex items-center justify-between py-2 text-sm text-gray-200">
                <span>{user.email}</span>
                <span className="text-gray-400">{t('admin.stats.topUsersAnalyses', { count: user.analyses })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{t('admin.metrics.title')}</h3>
            <p className="text-sm text-gray-400">{t('admin.metrics.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">{t('admin.metrics.rangeLabel')}</label>
            <select
              value={metricRange}
              onChange={(e) => setMetricRange(Number(e.target.value))}
              className="bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2"
            >
              {[7, 14, 30, 60, 90].map(range => (
                <option key={range} value={range}>{t('admin.metrics.rangeOption', { days: range })}</option>
              ))}
            </select>
          </div>
        </div>
        {metricsLoading ? (
          <div className="flex justify-center py-6"><Loader /></div>
        ) : metrics && (metrics.analysisSeries.length || metrics.signupSeries.length) ? (
          <TrendChart
            analysis={metrics.analysisSeries}
            signups={metrics.signupSeries}
            analysisLabel={t('admin.metrics.analyses')}
            signupsLabel={t('admin.metrics.signups')}
            emptyText={t('admin.metrics.empty')}
          />
        ) : (
          <p className="text-sm text-gray-400">{t('admin.metrics.empty')}</p>
        )}
      </section>

      {selectedCount > 0 && (
        <div className="bg-gray-900 border border-indigo-500/40 rounded-lg p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-indigo-200 font-medium">{t('admin.bulk.selectedCount', { count: selectedCount })}</p>
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={bulkTier}
              onChange={(e) => setBulkTier(e.target.value as AdminUser['subscriptionTier'])}
              className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
            >
              {tierOptions.map(option => (
                <option key={option.value} value={option.value}>{t(`admin.tiers.${option.value}`)}</option>
              ))}
            </select>
            <button
              onClick={() => performBulkAction('setTier')}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={bulkLoading}
            >
              {t('admin.bulk.applyTier')}
            </button>
            <button
              onClick={() => performBulkAction('resetTools')}
              className="px-4 py-2 rounded-md bg-gray-800 border border-gray-600 text-gray-100 hover:border-gray-400 disabled:opacity-50"
              disabled={bulkLoading}
            >
              {t('admin.bulk.resetTools')}
            </button>
            <button
              onClick={() => performBulkAction('notify')}
              className="px-4 py-2 rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
              disabled={bulkLoading}
            >
              {t('admin.bulk.notify')}
            </button>
          </div>
          {bulkMessage && (
            <p className={`text-sm ${bulkStatus === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{bulkMessage}</p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="bg-gray-800 p-6 rounded-lg flex justify-center">
          <Loader />
        </div>
      ) : (
        <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-lg">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedUserIds(() => (isAllSelected ? new Set() : new Set(filteredUsers.map(user => user.id))));
                    }}
                    className="h-4 w-4 text-indigo-600 bg-gray-800 border-gray-600 rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {t('admin.table.email')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {t('admin.table.subscription')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {t('admin.table.analysis')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {t('admin.table.plans')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {t('admin.table.goals')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {t('admin.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-700/40 cursor-pointer" onClick={() => openUserDetails(user)}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(user.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleUserSelection(user.id)}
                      className="h-4 w-4 text-indigo-600 bg-gray-800 border-gray-600 rounded"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    <div className="flex flex-col">
                      <span className="font-semibold">{user.email}</span>
                      <span className="text-xs text-gray-400">
                        {user.firstName || t('admin.table.noName')}{user.isAdmin ? ` • ${t('admin.table.admin')}` : ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-200">
                    <select
                      value={user.subscriptionTier}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleTierChange(user.id, e.target.value as AdminUser['subscriptionTier'])}
                      className="bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white"
                      disabled={savingUserId === user.id}
                    >
                      {tierOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {t(`admin.tiers.${option.value}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-200">{user.analysisCount}</td>
                  <td className="px-4 py-3 text-sm text-gray-200">{user.planCount}</td>
                  <td className="px-4 py-3 text-sm text-gray-200">{user.goalsCompleted}</td>
                  <td className="px-4 py-3 text-sm text-gray-200">
                    {savingUserId === user.id ? t('admin.saving') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{t('admin.logs.title')}</h3>
          <p className="text-sm text-gray-400">{t('admin.logs.subtitle')}</p>
        </div>
        {logsLoading ? (
          <div className="flex justify-center py-4"><Loader /></div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-500">{t('admin.logs.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700 text-sm">
              <thead>
                <tr className="text-left text-gray-400 uppercase text-xs tracking-wide">
                  <th className="py-2 pr-4">{t('admin.logs.columns.date')}</th>
                  <th className="py-2 pr-4">{t('admin.logs.columns.admin')}</th>
                  <th className="py-2 pr-4">{t('admin.logs.columns.action')}</th>
                  <th className="py-2 pr-4">{t('admin.logs.columns.payload')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {logs.map(log => {
                  let payload: string | null = null;
                  try {
                    payload = log.payload_json ? JSON.stringify(JSON.parse(log.payload_json), null, 2) : null;
                  } catch (err) {
                    payload = log.payload_json || null;
                  }
                  return (
                    <tr key={`${log.id}-${log.createdAt}`}>
                      <td className="py-2 pr-4 whitespace-nowrap text-gray-300">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-gray-200">{log.admin_email}</td>
                      <td className="py-2 pr-4 text-gray-200 capitalize">{log.action.replace(/_/g, ' ')}</td>
                      <td className="py-2 pr-4 text-gray-400">
                        {payload ? (
                          <pre className="bg-gray-900 rounded-md p-2 text-xs whitespace-pre-wrap break-all max-w-md">{payload}</pre>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-white">{t('admin.cms.title')}</h3>
          <p className="text-sm text-gray-400">{t('admin.cms.subtitle')}</p>
        </div>
        {cmsEntries.length === 0 ? (
          <p className="text-sm text-gray-500">{t('admin.cms.empty')}</p>
        ) : (
          <div className="space-y-4">
            {cmsEntries.map(entry => (
              <div key={entry.key} className="bg-gray-900/60 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-white">{entry.key}</p>
                  {entry.updatedAt && entry.updatedBy && (
                    <p className="text-xs text-gray-500">{t('admin.cms.lastUpdated', { user: entry.updatedBy })}</p>
                  )}
                </div>
                <textarea
                  value={cmsDrafts[entry.key] ?? entry.value}
                  onChange={(e) => handleCmsValueChange(entry.key, e.target.value)}
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                />
              </div>
            ))}
          </div>
        )}
        <div className="bg-gray-900/40 border border-dashed border-gray-600 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-200">{t('admin.cms.addTitle')}</p>
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              type="text"
              value={newCmsEntry.key}
              onChange={(e) => setNewCmsEntry(prev => ({ ...prev, key: e.target.value }))}
              placeholder={t('admin.cms.addKeyPlaceholder')}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
            />
            <input
              type="text"
              value={newCmsEntry.value}
              onChange={(e) => setNewCmsEntry(prev => ({ ...prev, value: e.target.value }))}
              placeholder={t('admin.cms.addValuePlaceholder')}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => {
                const trimmedKey = newCmsEntry.key.trim();
                if (!trimmedKey) return;
                setCmsEntries(prev => {
                  if (prev.some(entry => entry.key === trimmedKey)) {
                    return prev;
                  }
                  return [...prev, { key: trimmedKey, value: newCmsEntry.value }];
                });
                setCmsDrafts(prev => ({ ...prev, [trimmedKey]: newCmsEntry.value }));
                setNewCmsEntry({ key: '', value: '' });
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              {t('admin.cms.addButton')}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {cmsMessage && <p className="text-sm text-gray-300">{cmsMessage}</p>}
          <button
            onClick={handleCmsSave}
            disabled={cmsSaving}
            className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            {cmsSaving ? t('admin.cms.saving') : t('admin.cms.save')}
          </button>
        </div>
      </section>

      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={closeDetails}>
          <div className="w-full max-w-md bg-gray-900 h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedUser.email}</h3>
                <p className="text-gray-400 text-sm">{selectedUser.firstName || t('admin.table.noName')}</p>
              </div>
              <button onClick={closeDetails} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            {detailsLoading ? (
              <div className="flex justify-center py-10"><Loader /></div>
            ) : detailsError ? (
              <p className="text-sm text-red-400">{detailsError}</p>
            ) : userDetails ? (
              <div className="space-y-6">
                <section>
                  <h4 className="text-lg font-semibold text-white mb-2">{t('admin.details.analyses')}</h4>
                  {userDetails.analyses.length === 0 ? (
                    <p className="text-sm text-gray-500">{t('admin.details.none')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {userDetails.analyses.map(analysis => (
                        <li key={analysis.id} className="bg-gray-800/70 border border-gray-700 rounded-md p-3">
                          <p className="text-sm text-gray-200 font-semibold capitalize">{analysis.type}</p>
                          <p className="text-xs text-gray-400">{analysis.exerciseName || analysis.prompt || t('admin.details.noLabel')}</p>
                          <p className="text-xs text-gray-500">{new Date(analysis.createdAt).toLocaleString()}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section>
                  <h4 className="text-lg font-semibold text-white mb-2">{t('admin.details.plans')}</h4>
                  {userDetails.plans.length === 0 ? (
                    <p className="text-sm text-gray-500">{t('admin.details.none')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {userDetails.plans.map(plan => (
                        <li key={plan.id} className="bg-gray-800/70 border border-gray-700 rounded-md p-3">
                          <p className="text-sm text-gray-200 font-semibold">{plan.plan_name}</p>
                          <p className="text-xs text-gray-500">{new Date(plan.createdAt).toLocaleString()}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section>
                  <h4 className="text-lg font-semibold text-white mb-2">{t('admin.details.goals')}</h4>
                  {userDetails.goals.length === 0 ? (
                    <p className="text-sm text-gray-500">{t('admin.details.none')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {userDetails.goals.map(goal => (
                        <li key={goal.id} className="bg-gray-800/70 border border-gray-700 rounded-md p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-200">{goal.text}</p>
                            <p className="text-xs text-gray-500">{new Date(goal.createdAt).toLocaleDateString()}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${goal.completed ? 'bg-green-700 text-green-100' : 'bg-gray-700 text-gray-300'}`}>
                            {goal.completed ? t('admin.details.completed') : t('admin.details.pending')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

const TrendChart: React.FC<{
  analysis: MetricPoint[];
  signups: MetricPoint[];
  analysisLabel: string;
  signupsLabel: string;
  emptyText: string;
}> = ({ analysis, signups, analysisLabel, signupsLabel, emptyText }) => {
  const referenceLength = Math.max(analysis.length, signups.length);
  const hasData = referenceLength > 0;
  const maxValue = Math.max(
    1,
    ...analysis.map(point => point.count),
    ...signups.map(point => point.count)
  );
  const padding = 6;
  const height = 100 - padding * 2;

  const buildPoints = (series: MetricPoint[]) => {
    if (!series.length) return '';
    const step = series.length > 1 ? 100 / (series.length - 1) : 0;
    return series
      .map((point, index) => {
        const x = step * index;
        const y = padding + (1 - point.count / maxValue) * height;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  };

  if (!hasData) {
    return <p className="text-sm text-gray-400">{emptyText}</p>;
  }

  const sampleLabels = analysis.length
    ? analysis
    : signups;

  const labelIndexes = new Set<number>();
  if (sampleLabels.length) {
    labelIndexes.add(0);
    labelIndexes.add(sampleLabels.length - 1);
    labelIndexes.add(Math.floor(sampleLabels.length / 2));
  }

  return (
    <div className="space-y-3">
      <div className="relative bg-gray-900/60 rounded-lg border border-gray-700 p-3">
        <svg viewBox="0 0 100 100" className="w-full h-56 text-white">
          <polyline
            fill="none"
            stroke="#2dd4bf"
            strokeWidth="2"
            points={buildPoints(signups)}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polyline
            fill="none"
            stroke="#6366f1"
            strokeWidth="2.5"
            points={buildPoints(analysis)}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-gray-300">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-indigo-500" />
          <span>{analysisLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-teal-400" />
          <span>{signupsLabel}</span>
        </div>
      </div>
      {sampleLabels.length > 0 && (
        <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
          {sampleLabels.map((point, idx) => (
            labelIndexes.has(idx) ? (
              <div key={point.day} className="flex flex-col">
                <span className="font-semibold text-gray-200">{point.count}</span>
                <span>{point.label}</span>
              </div>
            ) : <div key={point.day} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
