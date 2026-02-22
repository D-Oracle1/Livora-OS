'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Search, Loader2, User, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700',
  POST: 'bg-green-100 text-green-700',
  PUT: 'bg-yellow-100 text-yellow-700',
  PATCH: 'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-700',
};

export default function GOAuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      const res: any = await api.get(`/audit?${params}`);
      const inner = res?.data ?? res;
      const arr = Array.isArray(inner) ? inner : (inner?.data ?? []);
      setLogs(arr);
      setTotal(inner?.meta?.total ?? arr.length);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Complete record of all platform actions</p>
        </div>
        <Badge variant="outline" className="px-3 py-1">{total} entries</Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Activity Log
          </CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">No audit logs found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="pb-3 font-medium">Time</th>
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Action</th>
                      <th className="pb-3 font-medium">Method</th>
                      <th className="pb-3 font-medium">Endpoint</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.map((log: any, i: number) => (
                      <tr key={log.id ?? i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                          </div>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs">
                              {log.user ? `${log.user.firstName} ${log.user.lastName}` : (log.userId ?? 'System')}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 font-medium text-xs max-w-[200px] truncate" title={log.action ?? log.description}>
                          {log.action ?? log.description ?? '—'}
                        </td>
                        <td className="py-2.5">
                          {log.method && (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${METHOD_COLORS[log.method] ?? 'bg-gray-100 text-gray-700'}`}>
                              {log.method}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground font-mono max-w-[220px] truncate" title={log.url ?? log.endpoint}>
                          {log.url ?? log.endpoint ?? '—'}
                        </td>
                        <td className="py-2.5">
                          {log.statusCode != null && (
                            <Badge className={`text-xs ${log.statusCode < 400 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {log.statusCode}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 border rounded text-sm disabled:opacity-40 hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 border rounded text-sm disabled:opacity-40 hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
