'use client';

import React, { useEffect, useState } from 'react';
import { socket } from '@/config/socket';
import { useCampaignStore } from '@/store/useCampaignStore';
import { Clock, Users, ShieldAlert, Award } from 'lucide-react';

interface LiveCampaignHeroProps {
  campaignId: string;
  initialPledgeCount: number;
  initialPrice: number;
  initialStatus: 'PENDING' | 'ACTIVE' | 'SUCCESS' | 'FAILED';
  targetVolume: number;
  endTime: string;
  title: string;
}

export default function LiveCampaignHero({
  campaignId,
  initialPledgeCount,
  initialPrice,
  initialStatus,
  targetVolume,
  endTime,
  title,
}: LiveCampaignHeroProps) {
  const { pledgeCount, currentPrice, status, setLiveState } = useCampaignStore();
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  // Hydrate store on mount with server data
  useEffect(() => {
    setLiveState({
      pledgeCount: initialPledgeCount,
      currentPrice: initialPrice,
      status: initialStatus,
    });
  }, [initialPledgeCount, initialPrice, initialStatus, setLiveState]);

  // Setup live websocket connection
  useEffect(() => {
    const handleCampaignUpdate = (data: any) => {
      if (data.campaignId === campaignId) {
        console.log('⚡ Live Campaign update received:', data);
        setLiveState({
          pledgeCount: data.pledgeCount,
          currentPrice: data.currentPrice,
        });
      }
    };

    socket.on('CAMPAIGN_UPDATED', handleCampaignUpdate);
    return () => {
      socket.off('CAMPAIGN_UPDATED', handleCampaignUpdate);
    };
  }, [campaignId, setLiveState]);

  // Countdown timer calculations
  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = +new Date(endTime) - +new Date();
      if (difference <= 0) {
        return { hours: 0, minutes: 0, seconds: 0 };
      }
      return {
        hours: Math.floor(difference / (1000 * 60 * 60)),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  const progressPercent = Math.min(100, Math.round((pledgeCount / targetVolume) * 100));
  const isExpired = timeLeft && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-slate-700">
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
      
      {/* Top Banner Info */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-950 text-emerald-400 border border-emerald-500/10 mb-3">
            <Award className="h-3.5 w-3.5" /> Live Group Buy
          </span>
          <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
            {title}
          </h1>
        </div>

        {/* Status Badge */}
        <span
          className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
            status === 'SUCCESS'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : status === 'ACTIVE'
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}
        >
          {status}
        </span>
      </div>

      {/* Main Panel grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pt-4 border-t border-slate-800/80">
        
        {/* Real-time Pricing display */}
        <div className="bg-slate-950/40 rounded-2xl p-5 border border-slate-850 flex flex-col justify-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
            Current Unlocked Price
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-black text-emerald-400 tracking-tight">
              ৳{currentPrice}
            </span>
            <span className="text-sm text-slate-500 line-through">
              ৳{initialPrice}
            </span>
          </div>
        </div>

        {/* Pledgers Counter */}
        <div className="bg-slate-950/40 rounded-2xl p-5 border border-slate-850 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Users className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wider block">
              Active Pledgers
            </span>
          </div>
          <span className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {pledgeCount} / {targetVolume}
          </span>
        </div>

        {/* Live Countdown Timer */}
        <div className="bg-slate-950/40 rounded-2xl p-5 border border-slate-850 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Clock className="h-4 w-4 text-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider block">
              Time Left in Phase
            </span>
          </div>
          {timeLeft ? (
            isExpired ? (
              <span className="text-xl font-bold text-red-500 uppercase tracking-wider">
                Deal Concluded
              </span>
            ) : (
              <div className="flex items-baseline gap-1 font-mono text-2xl md:text-3xl font-extrabold text-white">
                <span>{String(timeLeft.hours).padStart(2, '0')}</span>
                <span className="text-slate-600 text-xl font-sans">:</span>
                <span>{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span className="text-slate-600 text-xl font-sans">:</span>
                <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
              </div>
            )
          ) : (
            <span className="text-slate-400">Loading...</span>
          )}
        </div>
      </div>

      {/* MOQ Progress indicator */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs md:text-sm font-semibold">
          <span className="text-slate-400">Target Minimum Order Quantity (MOQ)</span>
          <span className="text-emerald-400">{progressPercent}% Unlocked</span>
        </div>
        
        {/* Custom Progress Bar */}
        <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 relative">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              status === 'SUCCESS'
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-gradient-to-r from-blue-600 to-blue-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        <p className="text-xs text-slate-500">
          Once the group pledges reach {targetVolume} orders, the group buy pricing drops permanently for everyone!
        </p>
      </div>
    </div>
  );
}
