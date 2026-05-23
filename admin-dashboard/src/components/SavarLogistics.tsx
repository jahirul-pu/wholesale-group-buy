'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, CheckSquare, AlertCircle, ShoppingCart } from 'lucide-react';

interface Delivery {
  id: string;
  pledgeId: string;
  courier: 'PATHAO' | 'REDX' | 'STEADFAST';
  trackingId: string | null;
  status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED' | 'FAILED';
  codAmount: number;
  createdAt: string;
}

interface OrphanInventory {
  id: string;
  campaignId: string;
  pledgeId: string | null;
  status: 'PENDING_INSPECTION' | 'FLASH_STOCK' | 'SOLD';
  createdAt: string;
  campaign: {
    title: string;
  };
}

export default function SavarLogistics() {
  const queryClient = useQueryClient();

  // 1. Fetch physical deliveries
  const { data: deliveries = [], isLoading: isDeliveriesLoading } = useQuery<Delivery[]>({
    queryKey: ['deliveries'],
    queryFn: async () => {
      const res = await fetch('http://127.0.0.1:3000/api/deliveries');
      if (!res.ok) throw new Error('Failed to fetch deliveries');
      const json = await res.json();
      return json.data;
    },
  });

  // 2. Fetch orphan inventory items (status PENDING_INSPECTION)
  const { data: orphans = [], isLoading: isOrphansLoading, refetch: refetchOrphans } = useQuery<OrphanInventory[]>({
    queryKey: ['orphans'],
    queryFn: async () => {
      const res = await fetch('http://127.0.0.1:3000/api/orphans');
      if (!res.ok) throw new Error('Failed to fetch orphans');
      const json = await res.json();
      return json.data;
    },
  });

  // 3. Clear Orphan to Flash Stock mutation
  const clearOrphanMutation = useMutation({
    mutationFn: async (orphanId: string) => {
      const res = await fetch(`http://127.0.0.1:3000/api/orphans/${orphanId}/clear`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to clear orphan to flash stock');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orphans'] });
    },
  });

  const isLoading = isDeliveriesLoading || isOrphansLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Deliveries Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <Truck className="h-6 w-6 text-emerald-400" />
          <h3 className="font-semibold text-lg text-white">Physical Courier Deliveries</h3>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400">
                <th className="p-4 font-semibold">Pledge ID</th>
                <th className="p-4 font-semibold">Courier</th>
                <th className="p-4 font-semibold">Tracking ID</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">COD Amount</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No physical deliveries found.
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery) => (
                  <tr key={delivery.id} className="border-b border-slate-800/80 hover:bg-slate-900/30 text-slate-300">
                    <td className="p-4 font-mono text-xs text-slate-400">{delivery.pledgeId}</td>
                    <td className="p-4">
                      <span className="bg-slate-800 text-slate-200 border border-slate-700 text-xs px-2 py-0.5 rounded">
                        {delivery.courier}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs">{delivery.trackingId || 'N/A'}</td>
                    <td className="p-4">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          delivery.status === 'DELIVERED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : delivery.status === 'IN_TRANSIT'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                        }`}
                      >
                        {delivery.status}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-200">${delivery.codAmount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Orphan Queue (PENDING_INSPECTION) */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-yellow-500" />
            <h3 className="font-semibold text-lg text-white">Orphan Queue (Inspection Pending)</h3>
          </div>
          <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {orphans.length} units
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orphans.length === 0 ? (
            <div className="col-span-2 text-center text-slate-500 py-8 border border-dashed border-slate-800 rounded-xl">
              No rejected COD items waiting for inspection.
            </div>
          ) : (
            orphans.map((orphan) => (
              <div
                key={orphan.id}
                className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-800 transition-all duration-300"
              >
                <div className="mb-4">
                  <span className="text-xs text-slate-500 block">Source Campaign</span>
                  <span className="text-sm font-semibold text-slate-200 block truncate">
                    {orphan.campaign.title}
                  </span>
                  <span className="text-xs text-slate-500 block mt-2">Originated from Pledge</span>
                  <span className="text-xs font-mono text-slate-400 block truncate">{orphan.pledgeId || 'N/A'}</span>
                </div>

                <button
                  onClick={() => clearOrphanMutation.mutate(orphan.id)}
                  disabled={clearOrphanMutation.isPending}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-slate-950 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-md shadow-yellow-500/5 hover:shadow-yellow-500/10"
                >
                  {clearOrphanMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-slate-950"></div>
                      Liquidating...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Clear to Flash Stock
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
