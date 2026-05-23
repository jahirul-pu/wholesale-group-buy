'use client';

import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import LiveCampaignHero from '@/components/LiveCampaignHero';
import CascadingPriceCurve from '@/components/CascadingPriceCurve';
import PledgeStateMachine from '@/components/PledgeStateMachine';
import { useCampaignStore } from '@/store/useCampaignStore';
import { ArrowLeft, UserCircle } from 'lucide-react';
import Link from 'next/link';

interface CampaignDetailClientProps {
  initialCampaign: any;
}

export default function CampaignDetailClient({ initialCampaign }: CampaignDetailClientProps) {
  const { setLiveState } = useCampaignStore();

  // TanStack Query sync as fallback helper
  const { data: campaign = initialCampaign } = useQuery({
    queryKey: ['campaign', initialCampaign.id],
    queryFn: async () => {
      const res = await fetch(`http://127.0.0.1:3000/api/campaigns/${initialCampaign.id}`);
      if (!res.ok) throw new Error('Failed to fetch campaign details');
      const json = await res.json();
      return json.data;
    },
    initialData: initialCampaign,
    refetchInterval: 10000, 
  });

  // Hydrate the Zustand store with tiers + live data so CascadingPriceCurve works
  useEffect(() => {
    if (campaign) {
      setLiveState({
        pledgeCount: campaign.pledgeCount ?? 0,
        currentPrice: campaign.currentPrice ?? campaign.basePrice,
        status: campaign.status ?? 'ACTIVE',
        tiers: campaign.tiers ?? [],
      });
    }
  }, [campaign, setLiveState]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Premium Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/dashboard"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-sm font-semibold tracking-wide uppercase text-emerald-400">
              Zero-Friction Pledge Hub
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/profile"
              className="flex items-center gap-2 py-2 px-4 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-xs font-semibold text-slate-300 transition-colors"
            >
              <UserCircle className="h-4.5 w-4.5 text-emerald-400" />
              Simulate Profiles
            </Link>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col gap-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Main Campaign details (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-8">
            <LiveCampaignHero
              campaignId={campaign.id}
              initialPledgeCount={campaign.pledgeCount}
              initialPrice={campaign.basePrice}
              initialStatus={campaign.status}
              targetVolume={campaign.targetVolume}
              endTime={campaign.endTime}
              title={campaign.title}
            />

            <CascadingPriceCurve
              basePrice={campaign.basePrice}
            />
          </div>

          {/* Sidebar Pledge Controller (Right col) */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <PledgeStateMachine campaignId={campaign.id} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
