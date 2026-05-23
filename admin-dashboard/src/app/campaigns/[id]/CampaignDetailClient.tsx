'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import LiveCampaignHero from '@/components/LiveCampaignHero';
import CascadingPriceCurve from '@/components/CascadingPriceCurve';
import PledgeStateMachine from '@/components/PledgeStateMachine';
import { useCampaignStore } from '@/store/useCampaignStore';
import { useUserStore } from '@/store/useUserStore';
import { Layers, ClipboardList } from 'lucide-react';
import { useSession } from 'next-auth/react';

// Simple markdown-to-HTML parser
function parseMarkdown(md: string) {
  if (!md) return '';
  let html = md;
  
  // Escape HTML characters
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  // Headings
  html = html.replace(/^### (.*$)/gim, '<h4 class="text-sm font-bold text-emerald-700 mt-3 mb-1">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="text-base font-bold text-emerald-700 mt-4 mb-2 border-b border-slate-200 pb-1">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="text-lg font-bold text-emerald-700 mt-5 mb-3 border-b border-slate-200 pb-1.5">$1</h2>');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\//g, '<strong>$1</strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-slate-100 p-3 rounded-lg border border-slate-200 my-2 font-mono text-[10px] text-slate-600 overflow-x-auto">$1</pre>');
  
  // Bullet lists
  html = html.replace(/^\* (.*$)/gim, '<li class="list-disc ml-5 my-1 text-slate-600">$1</li>');
  
  // Paragraphs
  html = html.split('\n\n').map(p => {
    if (p.trim().startsWith('<h') || p.trim().startsWith('<li') || p.trim().startsWith('<pre')) {
      return p;
    }
    return `<p class="my-2 leading-relaxed text-slate-600 text-xs">${p.replace(/\n/g, '<br />')}</p>`;
  }).join('\n');
  
  return html;
}

interface CampaignDetailClientProps {
  initialCampaign: any;
}

export default function CampaignDetailClient({ initialCampaign }: CampaignDetailClientProps) {
  const { setLiveState } = useCampaignStore();
  const { data: session } = useSession();
  const { setCurrentUser } = useUserStore();
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Sync NextAuth session with simulated user store so downstream components react
  useEffect(() => {
    if (session?.user?.id && session?.user?.phoneNumber && session?.user?.currentTrust !== undefined) {
      setCurrentUser({
        id: session.user.id,
        phoneNumber: session.user.phoneNumber,
        currentTrust: session.user.currentTrust,
      });
    }
  }, [session, setCurrentUser]);

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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col gap-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Main Campaign details (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery Carousel */}
            {campaign.images && campaign.images.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm relative group h-[260px] sm:h-[360px] md:h-[420px] transition-all duration-300 hover:shadow-md">
                <div className="w-full h-full relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={campaign.images[activeImageIndex]}
                    alt={`${campaign.title} image #${activeImageIndex + 1}`}
                    className="w-full h-full object-cover select-none"
                  />
                </div>

                {campaign.images.length > 1 && (
                  <>
                    <button
                      onClick={() => setActiveImageIndex((prev) => (prev - 1 + campaign.images.length) % campaign.images.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-xl bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-white hover:scale-105 transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-sm"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setActiveImageIndex((prev) => (prev + 1) % campaign.images.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-xl bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-white hover:scale-105 transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-sm"
                    >
                      →
                    </button>
                  </>
                )}

                {campaign.images.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                    {campaign.images.map((_: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                          idx === activeImageIndex ? 'w-5 bg-emerald-500' : 'w-2 bg-slate-300 hover:bg-slate-400'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <LiveCampaignHero
              campaignId={campaign.id}
              initialPledgeCount={campaign.pledgeCount}
              initialPrice={campaign.basePrice}
              initialStatus={campaign.status}
              targetVolume={campaign.targetVolume}
              endTime={campaign.endTime}
              title={campaign.title}
            />

            {campaign.shortDescription && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-800 text-sm italic leading-relaxed">
                &ldquo;{campaign.shortDescription}&rdquo;
              </div>
            )}

            <CascadingPriceCurve
              basePrice={campaign.basePrice}
            />

            {/* Campaign Product Pitch and Dynamic Specifications */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-8">
              {/* Product Pitch Details */}
              {campaign.richContent ? (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-700 mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-600" />
                    Product Description
                  </h3>
                  <div
                    className="text-xs text-slate-600 space-y-4 leading-relaxed select-none"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(campaign.richContent) }}
                  />
                </div>
              ) : (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-700 mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-600" />
                    Product Description
                  </h3>
                  <p className="text-xs text-slate-400 italic">No detailed description has been uploaded for this campaign.</p>
                </div>
              )}

              {/* Dynamic Spec Sheet */}
              {campaign.specifications && Object.keys(campaign.specifications).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-700 mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-emerald-600" />
                    Technical Specifications
                  </h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-w-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <tbody className="divide-y divide-slate-100">
                        {Object.entries(campaign.specifications).map(([key, val]) => (
                          <tr key={key} className="hover:bg-slate-50">
                            <td className="p-3.5 font-bold text-slate-500 w-1/3 bg-slate-50 border-r border-slate-100">
                              {key}
                            </td>
                            <td className="p-3.5 text-slate-800">
                              {String(val)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
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
