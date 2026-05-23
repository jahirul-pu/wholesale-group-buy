'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, UserX, AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react';

interface TrustLog {
  id: string;
  userId: string;
  deltaScore: number;
  newTotalScore: number;
  reason: string;
  createdAt: string;
}

export default function EcosystemHealth() {
  // Fetch trust score logs
  const { data: logs = [], isLoading, error } = useQuery<TrustLog[]>({
    queryKey: ['trust-logs'],
    queryFn: async () => {
      const res = await fetch('http://127.0.0.1:3000/api/trust-logs');
      if (!res.ok) throw new Error('Failed to fetch trust logs');
      const json = await res.json();
      return json.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex gap-3 bg-red-950/30 border border-red-500/20 text-red-400 p-4 rounded-xl items-center">
        <AlertTriangle className="h-5 w-5" />
        <p>Error loading trust logs: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
              Default Penalties
            </span>
            <span className="text-2xl font-bold text-white mt-1">
              {logs.filter((l) => l.deltaScore === -30).length} cases
            </span>
          </div>
          <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20">
            <UserX className="h-6 w-6 text-red-400" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
              Minor Trust Deductions
            </span>
            <span className="text-2xl font-bold text-white mt-1">
              {logs.filter((l) => l.deltaScore === -5).length} cases
            </span>
          </div>
          <div className="bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
              Ecosystem Status
            </span>
            <span className="text-2xl font-bold text-emerald-400 mt-1">
              Healthy
            </span>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Trust Logs Audit Feed Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
          <h3 className="font-semibold text-lg text-white">Trust Score Penalty Logs</h3>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400">
                <th className="p-4 font-semibold">User ID</th>
                <th className="p-4 font-semibold">Change</th>
                <th className="p-4 font-semibold">New Total</th>
                <th className="p-4 font-semibold">Reason</th>
                <th className="p-4 font-semibold">Logged At</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No trust score entries recorded.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isPenalty = log.deltaScore < 0;

                  return (
                    <tr key={log.id} className="border-b border-slate-800/80 hover:bg-slate-900/30 text-slate-300">
                      <td className="p-4 font-mono text-xs text-slate-400">{log.userId}</td>
                      <td className="p-4">
                        <span
                          className={`flex items-center gap-1 font-semibold text-xs px-2 py-0.5 rounded w-max ${
                            isPenalty
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {isPenalty ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUp className="h-3 w-3" />
                          )}
                          {log.deltaScore}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-200">{log.newTotalScore}</td>
                      <td className="p-4 text-xs max-w-sm break-words">{log.reason}</td>
                      <td className="p-4 text-xs text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
