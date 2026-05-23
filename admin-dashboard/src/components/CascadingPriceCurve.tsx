'use client';

import React from 'react';
import { useCampaignStore } from '@/store/useCampaignStore';
import { Lock, Unlock, Check } from 'lucide-react';

interface CascadingPriceCurveProps {
  basePrice: number;
}

export default function CascadingPriceCurve({ basePrice }: CascadingPriceCurveProps) {
  const { tiers, pledgeCount } = useCampaignStore();

  // Find the currently active tier
  let activeTierId = '';
  let highestUnlockedVolume = 0;
  for (const tier of tiers) {
    if (tier.isUnlocked || pledgeCount >= tier.targetVolume) {
      if (tier.targetVolume > highestUnlockedVolume) {
        highestUnlockedVolume = tier.targetVolume;
        activeTierId = tier.id;
      }
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative">
      <h2 className="text-xl font-bold text-white mb-6 tracking-wide flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
        Cascading Price Drops
      </h2>

      {/* Stepper Grid */}
      <div className="flex flex-col md:flex-row items-stretch gap-6 relative">
        
        {/* Base price starting step */}
        <div className="flex-1 bg-slate-950/40 border border-slate-800 rounded-2xl p-5 relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-700" />
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block mb-1">
            Retail Start
          </span>
          <div className="text-2xl font-black text-slate-400">৳{basePrice}</div>
          <p className="text-xs text-slate-500 mt-2">
            Base price before MOQ targets are hit.
          </p>
        </div>

        {/* Tiers rendering */}
        {tiers.map((tier, idx) => {
          const isUnlocked = tier.isUnlocked || pledgeCount >= tier.targetVolume;
          const isActive = tier.id === activeTierId;
          const progressPercent = Math.min(100, Math.round((pledgeCount / tier.targetVolume) * 100));

          return (
            <div
              key={tier.id}
              className={`flex-1 rounded-2xl p-5 relative overflow-hidden transition-all duration-500 border ${
                isActive
                  ? 'bg-emerald-950/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.08)] scale-102 z-10'
                  : isUnlocked
                  ? 'bg-slate-950/20 border-emerald-500/10'
                  : 'bg-slate-950/40 border-slate-850 opacity-60'
              }`}
            >
              {/* Top border colored line */}
              <div
                className={`absolute top-0 left-0 w-1.5 h-full transition-all duration-500 ${
                  isActive
                    ? 'bg-emerald-500'
                    : isUnlocked
                    ? 'bg-emerald-600/50'
                    : 'bg-slate-800'
                }`}
              />

              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Tier {idx + 1}
                </span>

                {/* Lock icon */}
                <div
                  className={`p-1 rounded-lg ${
                    isUnlocked
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isUnlocked ? (
                    <Unlock className="h-3.5 w-3.5" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                </div>
              </div>

              {/* Price target */}
              <div className="mb-2">
                <span className="text-xs text-slate-500 block">Target Price</span>
                <span
                  className={`text-2xl font-black transition-colors duration-500 ${
                    isActive || isUnlocked ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  ৳{tier.unlockedPrice}
                </span>
              </div>

              {/* Target volume */}
              <div className="text-xs font-semibold text-slate-400 mb-4">
                Target: {tier.targetVolume} orders
              </div>

              {/* Micro-Progress Bar for this tier */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                  <span>Progress</span>
                  <span>{pledgeCount} / {tier.targetVolume}</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-850">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isUnlocked ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Active Pricing tag — inline below progress bar */}
              {isActive && (
                <div className="mt-3 flex justify-end">
                  <div className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">
                    <Check className="h-2.5 w-2.5" /> Active Pricing
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
