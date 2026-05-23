'use client';

import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socket } from '@/config/socket';
import { Play, CheckCircle2, Lock, Unlock, AlertTriangle } from 'lucide-react';

interface Tier {
  id: string;
  targetVolume: number;
  unlockedPrice: number;
  isUnlocked: boolean;
}

interface Campaign {
  id: string;
  title: string;
  basePrice: number;
  targetVolume: number;
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'ACTIVE' | 'SUCCESS' | 'FAILED';
  pledgeCount: number;
  currentPrice: number;
  tiers: Tier[];
}

export default function CampaignVelocity() {
  const queryClient = useQueryClient();

  // 1. Fetch campaigns using TanStack Query
  const { data: campaigns = [], isLoading, error, refetch } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await fetch('http://127.0.0.1:3000/api/campaigns');
      if (!res.ok) throw new Error('Network response was not ok');
      const json = await res.json();
      return json.data;
    },
  });

  // 2. Setup Socket.io real-time listener
  useEffect(() => {
    socket.on('CAMPAIGN_UPDATED', (data: any) => {
      console.log('🔌 WebSocket event received [CAMPAIGN_UPDATED]:', data);
      // Invalidate the cache to trigger a fresh refetch in TanStack Query
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    });

    return () => {
      socket.off('CAMPAIGN_UPDATED');
    };
  }, [queryClient]);

  // 3. Force Unlock mutation
  const forceUnlockMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(`http://127.0.0.1:3000/api/campaigns/${campaignId}/force-unlock`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to force unlock');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
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
        <p>Error loading campaigns: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {campaigns.length === 0 ? (
        <div className="col-span-2 text-center text-slate-500 py-12 border border-dashed border-slate-800 rounded-xl">
          No campaigns found in system.
        </div>
      ) : (
        campaigns.map((campaign) => {
          const progressPercent = Math.min(100, Math.round((campaign.pledgeCount / campaign.targetVolume) * 100));
          const isSuccess = campaign.status === 'SUCCESS';
          const isActive = campaign.status === 'ACTIVE';

          return (
            <div
              key={campaign.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden transition-all duration-300 hover:border-slate-700"
            >
              {/* Top Row: Title and Status */}
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold text-lg text-white tracking-wide truncate max-w-[200px]">
                    {campaign.title}
                  </h3>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      isSuccess
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : isActive
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {campaign.status}
                  </span>
                </div>

                {/* Pricing detail info */}
                <div className="grid grid-cols-2 gap-4 bg-slate-950/50 rounded-lg p-3 mb-5 border border-slate-800/50">
                  <div>
                    <span className="text-xs text-slate-500 block">Base Price</span>
                    <span className="text-sm font-semibold text-slate-300">${campaign.basePrice}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Current Price</span>
                    <span className="text-sm font-bold text-emerald-400">${campaign.currentPrice}</span>
                  </div>
                </div>

                {/* Progress bar towards MOQ */}
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-400">Pledge Count</span>
                    <span className="text-white">
                      {campaign.pledgeCount} / {campaign.targetVolume} ({progressPercent}%)
                    </span>
                  </div>
                  {/* Custom Progress Bar matching shadcn progress */}
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isSuccess ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Tiers status list */}
                <div className="space-y-2 mb-6">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
                    Volume Price Drops
                  </span>
                  <div className="space-y-1.5">
                    {campaign.tiers.map((tier) => (
                      <div
                        key={tier.id}
                        className={`flex justify-between items-center text-xs p-2 rounded border ${
                          tier.isUnlocked
                            ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                            : 'bg-slate-950/20 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {tier.isUnlocked ? (
                            <Unlock className="h-3.5 w-3.5" />
                          ) : (
                            <Lock className="h-3.5 w-3.5" />
                          )}
                          <span>Target: {tier.targetVolume} orders</span>
                        </div>
                        <span className="font-semibold">${tier.unlockedPrice}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button: Force Unlock */}
              <div className="mt-4 pt-4 border-t border-slate-800/80">
                <button
                  onClick={() => forceUnlockMutation.mutate(campaign.id)}
                  disabled={isSuccess || forceUnlockMutation.isPending}
                  className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 ${
                    isSuccess
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20'
                  }`}
                >
                  {isSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Campaign Succeeded
                    </>
                  ) : forceUnlockMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-slate-950"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Force Unlock (Succeed Campaign)
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
