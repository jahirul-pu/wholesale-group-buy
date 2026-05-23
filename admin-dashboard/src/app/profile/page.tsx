'use client';

import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserStore, SimulatedUser } from '@/store/useUserStore';
import { signIn, useSession } from 'next-auth/react';
import { ShieldCheck, ShieldAlert, Award, ArrowLeft, RefreshCw, LogIn, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { currentUser, setCurrentUser } = useUserStore();
  const { data: session } = useSession();

  // 1. Fetch all seeded users for simulation selection
  const { data: usersResponse, isLoading: isUsersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('http://127.0.0.1:3000/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });
  const users = usersResponse?.data || [];

  // 2. Fetch full details for the currently active simulated user
  const { data: activeUserResponse, isLoading: isActiveUserLoading, refetch: refetchActiveUser } = useQuery({
    queryKey: ['activeUserDetail', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const res = await fetch(`http://127.0.0.1:3000/api/users/${currentUser.id}`);
      if (!res.ok) throw new Error('Failed to fetch active user details');
      return res.json();
    },
    enabled: !!currentUser?.id,
  });
  const activeUserDetail = activeUserResponse?.data;

  // Hydrate simulated user from NextAuth session or localStorage on mount
  useEffect(() => {
    if (session?.user && users.length > 0) {
      const found = users.find((u: SimulatedUser) => u.phoneNumber === session.user.phoneNumber);
      if (found) {
        setCurrentUser(found);
      }
    } else if (typeof window !== 'undefined' && !session?.user) {
      const storedId = localStorage.getItem('simulated_user_id');
      if (storedId && !currentUser && users.length > 0) {
        const found = users.find((u: SimulatedUser) => u.id === storedId);
        if (found) {
          setCurrentUser(found);
        }
      }
    }
  }, [users, session, currentUser, setCurrentUser]);

  // Keep the Zustand store updated when details change
  useEffect(() => {
    if (activeUserDetail) {
      setCurrentUser({
        id: activeUserDetail.id,
        phoneNumber: activeUserDetail.phoneNumber,
        currentTrust: activeUserDetail.currentTrust,
      });
    }
  }, [activeUserDetail, setCurrentUser]);

  const getTrustStatus = (score: number) => {
    if (score >= 80) return { label: 'Healthy', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', desc: 'Full account access. COD & ৳0 pledges active.' };
    if (score >= 50) return { label: 'Restricted', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', desc: 'Locked COD options. Upfront payments forced.' };
    return { label: 'Shadowbanned', color: 'text-red-400 bg-red-500/10 border-red-500/20', desc: 'Pledging disabled. Severe score penalty restrictions.' };
  };

  const handleUserSelect = async (user: SimulatedUser) => {
    setCurrentUser(user);
    try {
      await signIn('credentials', {
        phoneNumber: user.phoneNumber,
        otp: '123456',
        redirect: false,
      });
      queryClient.invalidateQueries();
    } catch (err) {
      console.error('Auto login failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header */}
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
              User Trust & Simulation Hub
            </span>
          </div>
          <button
            onClick={() => {
              refetchUsers();
              if (currentUser?.id) refetchActiveUser();
            }}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all hover:rotate-180 duration-500"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Content grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Simulation Profile Selector (1 col) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-400" />
              Simulated Users
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Switch profiles instantly to test the platform behavior (e.g., test restricted users getting locked out of COD payments).
            </p>

            {isUsersLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-emerald-500" />
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user: SimulatedUser) => {
                  const status = getTrustStatus(user.currentTrust);
                  const isActive = currentUser?.id === user.id;

                  return (
                    <button
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between ${
                        isActive
                          ? 'bg-slate-950 border-emerald-500 text-white shadow-lg shadow-emerald-500/5'
                          : 'bg-slate-950/40 border-slate-850 hover:border-slate-850 hover:bg-slate-900/50 text-slate-300'
                      }`}
                    >
                      <div>
                        <span className="text-sm font-bold block mb-1">{user.phoneNumber}</span>
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold border ${status.color}`}>
                          {status.label} ({user.currentTrust})
                        </span>
                      </div>
                      <LogIn className={`h-4.5 w-4.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Columns: User Profile Detail (2 cols) */}
        <div className="lg:col-span-2 space-y-8">
          {currentUser ? (
            isActiveUserLoading ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500" />
              </div>
            ) : activeUserDetail ? (
              <>
                {/* Visual score status gauge card */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Active Simulation Session
                      </span>
                      <h2 className="text-2xl md:text-3xl font-extrabold text-white">
                        {activeUserDetail.phoneNumber}
                      </h2>
                    </div>

                    <div className="text-left md:text-right">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Trust score
                      </span>
                      <span className="text-3xl md:text-4xl font-black text-white">
                        {activeUserDetail.currentTrust} <span className="text-lg text-slate-500">/ 100</span>
                      </span>
                    </div>
                  </div>

                  {/* Trust indicator badge bar */}
                  <div className="bg-slate-950/65 rounded-2xl p-5 border border-slate-850 flex items-start gap-4">
                    {activeUserDetail.currentTrust >= 80 ? (
                      <ShieldCheck className="h-10 w-10 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <ShieldAlert className="h-10 w-10 text-amber-500 flex-shrink-0" />
                    )}
                    <div>
                      <span className="font-bold text-white block">
                        Account Health: {getTrustStatus(activeUserDetail.currentTrust).label}
                      </span>
                      <p className="text-xs text-slate-400 mt-1">
                        {getTrustStatus(activeUserDetail.currentTrust).desc}
                      </p>
                    </div>
                  </div>
                </div>

                {/* User Joined Campaigns Pledges list */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
                  <h3 className="text-lg font-bold text-white mb-6">
                    My Pledges & Active Deals
                  </h3>

                  {!activeUserDetail.pledges || activeUserDetail.pledges.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
                      You haven't joined any group buy deals yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeUserDetail.pledges.map((pledge: any) => (
                        <div
                          key={pledge.id}
                          className="bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-2xl p-5 transition-all duration-300 flex flex-wrap justify-between items-center gap-4"
                        >
                          <div>
                            <span className="text-xs text-slate-500 font-bold block mb-1">
                              PLEDGE ID: {pledge.id.substring(0, 8)}
                            </span>
                            <span className="text-sm font-extrabold text-white block">
                              Locked Price: ৳{Number(pledge.lockedPrice)}
                            </span>
                          </div>

                          <div className="flex items-center gap-4">
                            <span
                              className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase border ${
                                pledge.status === 'CONFIRMED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : pledge.status === 'PENDING_PAYMENT'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                                  : pledge.status === 'PLEDGED'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}
                            >
                              {pledge.status}
                            </span>
                            
                            <Link
                              href={`/campaigns/${pledge.campaignId}`}
                              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
                            >
                              View Campaign
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* User Trust score Logs */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
                  <h3 className="text-lg font-bold text-white mb-6">
                    Trust Log Audit Trail
                  </h3>

                  {!activeUserDetail.trustLogs || activeUserDetail.trustLogs.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
                      No trust log history found. Score remains healthy.
                    </div>
                  ) : (
                    <div className="border border-slate-850 rounded-2xl overflow-hidden bg-slate-950/20">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-850 bg-slate-950/50 text-slate-400 uppercase font-bold tracking-wider">
                              <th className="p-4">Timestamp</th>
                              <th className="p-4">Score Delta</th>
                              <th className="p-4">New Total</th>
                              <th className="p-4">Reason / Audit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850">
                            {activeUserDetail.trustLogs.map((log: any) => (
                              <tr key={log.id} className="hover:bg-slate-900/20">
                                <td className="p-4 text-slate-500 whitespace-nowrap">
                                  {new Date(log.createdAt).toLocaleString()}
                                </td>
                                <td className={`p-4 font-bold ${log.deltaScore > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {log.deltaScore > 0 ? `+${log.deltaScore}` : log.deltaScore}
                                </td>
                                <td className="p-4 font-bold text-white">
                                  {log.newTotalScore}
                                </td>
                                <td className="p-4 text-slate-400 min-w-[200px]">
                                  {log.reason}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-500">
                Failed to load profile details.
              </div>
            )
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 py-20 text-center flex flex-col justify-center items-center shadow-2xl">
              <ShieldAlert className="h-14 w-14 text-slate-700 mb-4" />
              <h3 className="text-white font-extrabold text-xl mb-2">No Active Simulation Profile</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Select a user from the simulated users panel on the left to activate your group buy simulation profile.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
