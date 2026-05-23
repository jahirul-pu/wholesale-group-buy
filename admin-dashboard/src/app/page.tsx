import React from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  TrendingDown,
  Users,
  Shield,
  Zap,
  ArrowRight,
  Clock,
  Package,
  BadgeCheck,
  Star,
} from 'lucide-react';

interface Campaign {
  id: string;
  title: string;
  basePrice: number;
  currentPrice: number;
  pledgeCount: number;
  targetVolume: number;
  status: string;
  shortDescription: string;
  images: string[];
  startTime: string;
  endTime: string;
  tiers: {
    id: string;
    targetVolume: number;
    unlockedPrice: number;
    isUnlocked: boolean;
  }[];
}

async function getCampaigns(): Promise<Campaign[]> {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/campaigns', {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const campaigns = await getCampaigns();
  const activeCampaigns = campaigns.filter(
    (c) => c.status === 'ACTIVE' || c.status === 'PENDING'
  );
  const completedCampaigns = campaigns.filter(
    (c) => c.status === 'SUCCESS' || c.status === 'FAILED'
  );

  return (
    <div className="min-h-screen">
      {/* ═══════════════════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 h-72 w-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-emerald-300 blur-3xl" />
        </div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC41IiBzdHJva2Utb3BhY2l0eT0iMC4wNSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-40" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-emerald-100 mb-6 border border-white/10">
              <Zap className="h-4 w-4 text-yellow-300" />
              Live Group Buy Platform — Bangladesh
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
              Buy Together,{' '}
              <span className="relative">
                <span className="text-emerald-200">Save More</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                  <path d="M1 5.5C47 2 153 2 199 5.5" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            </h1>

            <p className="text-lg text-emerald-100/90 leading-relaxed mb-8 max-w-2xl">
              Join group buy deals for ৳0. Watch prices cascade as more buyers pledge. 
              Secure authentic products at wholesale rates with trust-verified delivery.
            </p>

            <div className="flex flex-wrap gap-3">
              {activeCampaigns.length > 0 ? (
                <Link
                  href={`/campaigns/${activeCampaigns[0].id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-emerald-700 shadow-lg shadow-black/10 transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Browse Active Deals
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-6 py-3 text-sm font-bold text-white">
                  <Clock className="h-4 w-4" />
                  No Active Deals Right Now
                </span>
              )}
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 backdrop-blur-sm px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/20"
              >
                <Users className="h-4 w-4" />
                Profile Selector
              </Link>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { value: `${campaigns.length}`, label: 'Total Campaigns', icon: Package },
              { value: `${activeCampaigns.length}`, label: 'Active Deals', icon: Zap },
              { value: '৳0', label: 'Joining Fee', icon: BadgeCheck },
              { value: '100%', label: 'Trust Verified', icon: Shield },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-4 text-center"
              >
                <stat.icon className="h-5 w-5 text-emerald-300 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-emerald-200/80 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          ACTIVE CAMPAIGNS SECTION
          ═══════════════════════════════════════════════════════════ */}
      {activeCampaigns.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  Live Now
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Active Deals
              </h2>
            </div>
            <Link
              href="/past-deals"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-emerald-600 transition-colors"
            >
              View Past Deals
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          PAST CAMPAIGNS SECTION
          ═══════════════════════════════════════════════════════════ */}
      {completedCampaigns.length > 0 && (
        <section className="bg-white border-t border-slate-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Past Deals
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Previously completed group buy campaigns
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} completed />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          HOW IT WORKS SECTION
          ═══════════════════════════════════════════════════════════ */}
      <section className="bg-slate-50 border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
              How Group Buy Works
            </h2>
            <p className="text-slate-500 max-w-lg mx-auto">
              Join for free, watch prices drop, and only pay when the deal is locked in.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Browse Deals',
                desc: 'Find products you want at wholesale prices. New deals go live regularly.',
                icon: ShoppingBag,
                color: 'emerald',
              },
              {
                step: '02',
                title: 'Pledge for ৳0',
                desc: 'Join a group buy with zero upfront cost. Your pledge helps unlock lower prices.',
                icon: Users,
                color: 'blue',
              },
              {
                step: '03',
                title: 'Price Cascades',
                desc: 'As more buyers join, price tiers unlock automatically. Everyone saves more.',
                icon: TrendingDown,
                color: 'violet',
              },
              {
                step: '04',
                title: 'Secure & Deliver',
                desc: 'Pay via bKash/Nagad when the deal locks. Trust-verified delivery to your door.',
                icon: Shield,
                color: 'amber',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative rounded-2xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow group"
              >
                <span className="absolute top-4 right-4 text-4xl font-extrabold text-slate-100 group-hover:text-slate-200 transition-colors select-none">
                  {item.step}
                </span>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl mb-4 ${
                    item.color === 'emerald'
                      ? 'bg-emerald-100 text-emerald-600'
                      : item.color === 'blue'
                      ? 'bg-blue-100 text-blue-600'
                      : item.color === 'violet'
                      ? 'bg-violet-100 text-violet-600'
                      : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── Campaign Card Component ─── */
function CampaignCard({
  campaign,
  completed = false,
}: {
  campaign: Campaign;
  completed?: boolean;
}) {
  const progress = Math.min(
    Math.round((campaign.pledgeCount / campaign.targetVolume) * 100),
    100
  );
  const lowestPrice =
    campaign.tiers.length > 0
      ? Math.min(...campaign.tiers.map((t) => t.unlockedPrice))
      : campaign.basePrice;
  const savings = Math.round(
    ((campaign.basePrice - lowestPrice) / campaign.basePrice) * 100
  );

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:border-emerald-200 transition-all duration-300 overflow-hidden"
    >
      {/* Card Header / Image Area */}
      <div className="relative h-48 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center overflow-hidden">
        {campaign.images && campaign.images.length > 0 ? (
          <img
            src={campaign.images[0]}
            alt={campaign.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <Package className="h-16 w-16 text-slate-300" />
        )}

        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          {completed ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                campaign.status === 'SUCCESS'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              <Star className="h-3 w-3" />
              {campaign.status === 'SUCCESS' ? 'Completed' : 'Ended'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
              <Zap className="h-3 w-3" />
              Live
            </span>
          )}
        </div>

        {/* Savings Badge */}
        {savings > 0 && (
          <div className="absolute top-3 right-3 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg shadow-red-500/30">
            Save {savings}%
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold text-slate-900 mb-1 group-hover:text-emerald-700 transition-colors line-clamp-1">
          {campaign.title}
        </h3>
        {campaign.shortDescription && (
          <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">
            {campaign.shortDescription}
          </p>
        )}

        {/* Price Display */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-xl font-extrabold text-emerald-700">
            ৳{campaign.currentPrice.toLocaleString()}
          </span>
          {campaign.currentPrice < campaign.basePrice && (
            <span className="text-sm text-slate-400 line-through">
              ৳{campaign.basePrice.toLocaleString()}
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-auto">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-slate-600">
              {campaign.pledgeCount} / {campaign.targetVolume} pledges
            </span>
            <span className="font-bold text-emerald-600">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {campaign.tiers.length} price tiers
        </span>
        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 group-hover:gap-2 transition-all">
          View Deal
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
