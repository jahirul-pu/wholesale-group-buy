import Link from 'next/link';
import { LayoutDashboard, Users, ShoppingCart, Activity, ShieldAlert, Award } from 'lucide-react';

async function getSeededCampaign() {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/campaigns', { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.[0] || null;
  } catch (err) {
    console.warn('⚠️ Could not fetch campaign from backend API. Fallback to generic route.');
    return null;
  }
}

export default async function Home() {
  const campaign = await getSeededCampaign();
  const campaignLink = campaign ? `/campaigns/${campaign.id}` : '/profile';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <main className="w-full max-w-4xl z-10 flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
            <Activity className="h-3 w-3 animate-pulse" /> Live Group Buy Platform
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            Wholesale Group Buy Portal
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-lg mx-auto">
            A high-concurrency group buy platform with real-time price drops, trust score validation, automated courier dispatches, and secure payment integrations.
          </p>
        </div>

        {/* Portal Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-12">
          {/* Card 1: Customer Campaign Page */}
          <Link
            href={campaignLink}
            className="group bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 hover:border-emerald-500/50 hover:bg-slate-900 transition-all duration-300 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2 group-hover:text-emerald-400 transition-colors">
                Customer View
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Browse group buy deals, join for ৳0, watch live MOQ price cascades, choose token advances, and secure units in payment races.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-800/40 text-xs font-semibold text-emerald-400 flex items-center gap-1">
              Enter Campaigns →
            </div>
          </Link>

          {/* Card 2: Profile Selector / Simulator */}
          <Link
            href="/profile"
            className="group bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 hover:border-amber-500/50 hover:bg-slate-900 transition-all duration-300 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2 group-hover:text-amber-400 transition-colors">
                Profile Selector
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Select between 5 seeded user profiles to simulate checkout behavior, trust scores, penalties, and payment eligibility states.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-800/40 text-xs font-semibold text-amber-400 flex items-center gap-1">
              Simulate Profiles →
            </div>
          </Link>

          {/* Card 3: Admin Operations Dashboard */}
          <Link
            href="/admin/dashboard"
            className="group bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 hover:border-indigo-500/50 hover:bg-slate-900 transition-all duration-300 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2 group-hover:text-indigo-400 transition-colors">
                Admin Dashboard
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Manage campaigns velocity, trigger force unlocks, dispatch courier batches (Pathao/RedX), liquidate orphans, and audit trust logs.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-800/40 text-xs font-semibold text-indigo-400 flex items-center gap-1">
              Open Dashboard →
            </div>
          </Link>
        </div>

        {/* Platform Status */}
        <div className="w-full max-w-md bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Backend Services Online</span>
          </div>
          <div className="h-4 w-[1px] bg-slate-800" />
          <div className="flex items-center gap-1">
            <Award className="h-3.5 w-3.5 text-slate-400" />
            <span>Prisma + Redis 5 active</span>
          </div>
        </div>
      </main>
    </div>
  );
}
