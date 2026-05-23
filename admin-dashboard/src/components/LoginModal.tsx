'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useUserStore } from '@/store/useUserStore';
import { X, Send, KeyRound, Loader2, Phone, Sparkles, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const queryClient = useQueryClient();
  const { setCurrentUser } = useUserStore();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setErrorMsg('Phone number is required');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('http://127.0.0.1:3000/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to send OTP');
      }

      setSuccessMsg('OTP has been successfully sent to the console!');
      setStep('otp');
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.length !== 6) {
      setErrorMsg('Please enter a valid 6-digit OTP');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // Sign in using NextAuth Credentials Provider
      const result = await signIn('credentials', {
        phoneNumber,
        otp,
        redirect: false,
      });

      if (result?.error) {
        throw new Error('Invalid OTP code or verification failed');
      }

      // Fetch the newly created session
      const sessionRes = await fetch('/api/auth/session');
      if (sessionRes.ok) {
        const session = await sessionRes.json();
        if (session?.user) {
          // Sync with the simulation Zustand store so client views update immediately
          setCurrentUser({
            id: session.user.id,
            phoneNumber: session.user.phoneNumber,
            currentTrust: session.user.currentTrust,
          });
        }
      }

      // Trigger cache invalidation to fetch updated user state
      queryClient.invalidateQueries();
      onClose();
      // Clean modal state
      setStep('phone');
      setPhoneNumber('');
      setOtp('');
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Login failed. Please verify your OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Decorative gradient bar */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 w-full" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Platform Login</h2>
              <p className="text-xs text-slate-400">Secure OTP authentication gate</p>
            </div>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/30 border border-red-500/25 text-red-400 text-xs">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/25 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 'phone' ? (
            /* STEP 1: ENTER PHONE NUMBER */
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="phone" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-500" />
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="e.g. +8801700000001"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-750 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition-all"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Verification Code
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: ENTER OTP */
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="otp" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                  Enter 6-Digit OTP
                </label>
                <input
                  id="otp"
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-750 tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition-all"
                  disabled={isLoading}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="w-1/3 px-4 py-3 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition duration-200"
                  disabled={isLoading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Login'
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-800 text-[10px] text-center text-slate-500 leading-relaxed">
            * Note: This is a local verification environment. Verify OTP logs in your console to login instantly. New users start with 100 Trust.
          </div>
        </div>
      </div>
    </div>
  );
}
