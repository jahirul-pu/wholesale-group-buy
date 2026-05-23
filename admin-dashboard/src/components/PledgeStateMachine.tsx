'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '@/store/useUserStore';
import { useCampaignStore } from '@/store/useCampaignStore';
import { CheckCircle2, ShieldAlert, Zap, Lock, CreditCard, ShoppingBag, Truck } from 'lucide-react';

interface PledgeStateMachineProps {
  campaignId: string;
}

export default function PledgeStateMachine({ campaignId }: PledgeStateMachineProps) {
  const queryClient = useQueryClient();
  const { currentUser } = useUserStore();
  const { status: campaignStatus, pledgeCount } = useCampaignStore();

  const [paymentOption, setPaymentOption] = useState<'PARTIAL' | 'FULL'>('FULL');
  const [payCountdown, setPayCountdown] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  // 1. Fetch user detail & pledges
  const { data: userDetails, isLoading: isUserLoading, refetch: refetchUser } = useQuery({
    queryKey: ['user', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const res = await fetch(`http://127.0.0.1:3000/api/users/${currentUser.id}`);
      if (!res.ok) throw new Error('Failed to fetch user profile');
      const json = await res.json();
      return json.data;
    },
    enabled: !!currentUser?.id,
  });

  const userPledge = userDetails?.pledges?.find((p: any) => p.campaignId === campaignId);
  const isRestricted = currentUser ? currentUser.currentTrust < 80 : false;

  // Force Option B (Full Payment) if restricted
  useEffect(() => {
    if (isRestricted) {
      setPaymentOption('FULL');
    }
  }, [isRestricted]);

  // Calculate partial payment = half of locked price
  const partialAmount = userPledge ? Math.ceil(Number(userPledge.lockedPrice) / 2) : 0;
  const remainingCod = userPledge ? Number(userPledge.lockedPrice) - partialAmount : 0;

  // 2. Pledge Mutation (Zero Taka Pledge)
  const pledgeMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) throw new Error('No user selected');
      const res = await fetch(`http://127.0.0.1:3000/api/campaigns/${campaignId}/pledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
        credentials: 'include',
      });
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || 'Failed to place pledge');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  // 3. Payment Mutation (Secure Unit)
  const paymentMutation = useMutation({
    mutationFn: async (pledgeId: string) => {
      const res = await fetch(`http://127.0.0.1:3000/api/pledges/${pledgeId}/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentType: paymentOption }),
      });
      if (!res.ok) throw new Error('Failed to confirm payment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  // 4. Countdown Timer for Checkout Window
  useEffect(() => {
    if (userPledge?.status !== 'PENDING_PAYMENT' || !userPledge.checkoutWindowExpiresAt) {
      setPayCountdown(null);
      return;
    }

    const calculateTimeLeft = () => {
      const difference = +new Date(userPledge.checkoutWindowExpiresAt) - +new Date();
      if (difference <= 0) {
        return { hours: 0, minutes: 0, seconds: 0 };
      }
      return {
        hours: Math.floor(difference / (1000 * 60 * 60)),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setPayCountdown(calculateTimeLeft());
    const interval = setInterval(() => {
      setPayCountdown(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [userPledge]);

  if (!currentUser) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
        <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-white font-bold text-lg mb-2">Simulated Profile Required</h3>
        <p className="text-sm text-slate-400 mb-4">
          To join deals or pay, you must select a simulated user profile first.
        </p>
        <a
          href="/profile"
          className="inline-flex justify-center items-center py-2 px-5 rounded-xl text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-600 transition-colors"
        >
          Select Simulated User
        </a>
      </div>
    );
  }

  if (isUserLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex justify-center py-10">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-emerald-500"></div>
      </div>
    );
  }

  // --- Render State 1: User has NOT pledged yet ---
  if (!userPledge) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-emerald-400" />
          Zero-Friction Pledge
        </h3>

        {isRestricted ? (
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-4 mb-5 text-xs text-amber-400 flex gap-3 items-start">
            <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Restricted Account Options</p>
              <p>
                Due to your trust score ({currentUser.currentTrust}), partial payment and COD options are locked. You must complete a <strong>Full Upfront Payment</strong> once the MOQ deal is unlocked.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 mb-5">
            Pledge today for ৳0! Your payment details are not requested until the group campaign achieves MOQ target price drops.
          </p>
        )}

        <button
          onClick={() => pledgeMutation.mutate()}
          disabled={isRestricted || pledgeMutation.isPending || campaignStatus !== 'ACTIVE'}
          className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
            isRestricted
              ? 'bg-slate-850 text-slate-500 cursor-not-allowed border border-slate-800'
              : campaignStatus !== 'ACTIVE'
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/10'
          }`}
        >
          {pledgeMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-slate-950" />
              Placing Pledge...
            </>
          ) : (
            <>
              <ShoppingBag className="h-4.5 w-4.5" />
              Join Deal for ৳0
            </>
          )}
        </button>

        {pledgeMutation.isError && (
          <p className="text-xs text-red-400 mt-2 text-center">
            {pledgeMutation.error.message}
          </p>
        )}
      </div>
    );
  }

  // --- Render State 2: User has pledged and is waiting for unlocks ---
  if (userPledge.status === 'PLEDGED') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
        <h3 className="text-white font-bold text-lg mb-2">Pledged for ৳0 Successfully</h3>
        <p className="text-sm text-slate-400 mb-4">
          You are in the group deal! Locked price: <strong>৳{Number(userPledge.lockedPrice)}</strong>.
        </p>
        <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-850 inline-block text-xs text-slate-400">
          Waiting for target MOQ to be met to unlock checkout window.
        </div>
      </div>
    );
  }

  // --- Render State 3: PAYMENT RACE (PENDING_PAYMENT) ---
  if (userPledge.status === 'PENDING_PAYMENT') {
    const isExpired = !!(payCountdown && payCountdown.hours === 0 && payCountdown.minutes === 0 && payCountdown.seconds === 0);

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Glow border effect */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-red-500" />
        
        <h3 className="text-white font-black text-lg mb-2 text-amber-400 flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-400 animate-bounce" />
          Deal Unlocked! Secure Your Unit
        </h3>

        {/* Urgency checkout countdown */}
        {payCountdown && (
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-400 flex justify-between items-center mb-5 font-mono">
            <span>Checkout Window Timer:</span>
            <span className="font-bold text-sm">
              {isExpired ? (
                'EXPIRED'
              ) : (
                `${String(payCountdown.hours).padStart(2, '0')}:${String(payCountdown.minutes).padStart(2, '0')}:${String(payCountdown.seconds).padStart(2, '0')}`
              )}
            </span>
          </div>
        )}

        {/* Restricted payment warning */}
        {isRestricted && (
          <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 mb-4 flex gap-2 items-center">
            <ShieldAlert className="h-4.5 w-4.5 flex-shrink-0" />
            <span>Low trust score: COD option locked. Upfront payment forced.</span>
          </div>
        )}

        {/* Radio Option Selector */}
        <div className="space-y-3 mb-6">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
            Payment Options
          </span>

          {/* Option A: Pay Partial Payment (Half of Product Value) */}
          <label
            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
              isRestricted
                ? 'opacity-40 cursor-not-allowed border-slate-800'
                : paymentOption === 'PARTIAL'
                ? 'bg-slate-950 border-emerald-500 text-white'
                : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="payment"
                disabled={isRestricted}
                checked={paymentOption === 'PARTIAL'}
                onChange={() => setPaymentOption('PARTIAL')}
                className="accent-emerald-500 h-4 w-4"
              />
              <div>
                <span className="text-sm font-bold block">Pay Partial Payment (Half of Product Value)</span>
                <span className="text-[11px] text-slate-500">Pay ৳{partialAmount} now, remaining ৳{remainingCod} cash on delivery</span>
              </div>
            </div>
            <Truck className="h-4.5 w-4.5 text-slate-500" />
          </label>

          {/* Option B: Full Upfront Payment */}
          <label
            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
              paymentOption === 'FULL'
                ? 'bg-slate-950 border-emerald-500 text-white'
                : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="payment"
                checked={paymentOption === 'FULL'}
                onChange={() => setPaymentOption('FULL')}
                className="accent-emerald-500 h-4 w-4"
              />
              <div>
                <span className="text-sm font-bold block">Full Upfront Payment</span>
                <span className="text-[11px] text-slate-500">Pay ৳{Number(userPledge.lockedPrice)} instantly online</span>
              </div>
            </div>
            <CreditCard className="h-4.5 w-4.5 text-slate-500" />
          </label>
        </div>

        {/* Action button */}
        <button
          onClick={() => paymentMutation.mutate(userPledge.id)}
          disabled={paymentMutation.isPending || isExpired}
          className="w-full py-3.5 px-4 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 transition-all duration-300"
        >
          {paymentMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-slate-950" />
              Completing Payment...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4.5 w-4.5" />
              Complete Payment
            </>
          )}
        </button>
      </div>
    );
  }

  // --- Render State 4: CONFIRMED ---
  if (userPledge.status === 'CONFIRMED') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
        <h3 className="text-white font-extrabold text-lg mb-2">Order Confirmed!</h3>
        <p className="text-sm text-slate-400 mb-4">
          Your payment has been received. Your unit is secured and your parcel is queued for physical courier dispatch.
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Status: CONFIRMED
        </div>
      </div>
    );
  }

  // --- Render State 5: DEFAULTED ---
  if (userPledge.status === 'DEFAULTED') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
        <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-white font-bold text-lg mb-2">Pledge Defaulted</h3>
        <p className="text-sm text-slate-400 mb-4">
          You missed the checkout window for this campaign. A penalty was applied to your trust score.
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
          Status: DEFAULTED
        </div>
      </div>
    );
  }

  // --- Render State 6: REJECTED_AT_DOOR ---
  if (userPledge.status === 'REJECTED_AT_DOOR') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
        <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-white font-bold text-lg mb-2">Delivery Rejected</h3>
        <p className="text-sm text-slate-400 mb-4">
          This order was returned by the courier because it was rejected at the doorstep.
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
          Status: REJECTED_AT_DOOR
        </div>
      </div>
    );
  }

  return null;
}
