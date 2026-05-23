import React from 'react';
import { Metadata } from 'next';
import CampaignDetailClient from './CampaignDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(`http://127.0.0.1:3000/api/campaigns/${id}`, {
      next: { revalidate: 10 },
    });
    if (!res.ok) throw new Error('Fetch failed');
    const json = await res.json();
    const campaign = json.data;

    return {
      title: `${campaign.title} | Group Buy Deal`,
      description: `Unlock massive price drops down to ৳${campaign.tiers[campaign.tiers.length - 1]?.unlockedPrice || campaign.basePrice}. Join the zero-friction group buy now!`,
      openGraph: {
        title: campaign.title,
        description: `MOQ Goal: ${campaign.targetVolume} orders. Base price: ৳${campaign.basePrice}. Join the pledge deal to drop the price for all buyers!`,
        type: 'website',
        url: `http://localhost:3001/campaigns/${id}`,
        siteName: 'Wholesale Group Buy',
      },
    };
  } catch (e) {
    return {
      title: 'Group Buy Campaign Detail',
      description: 'Unlock massive group buy discount keyboard deals.',
    };
  }
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  const res = await fetch(`http://127.0.0.1:3000/api/campaigns/${id}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex justify-center items-center">
        <div className="text-center space-y-4">
          <p className="text-red-500 font-bold text-lg">Failed to load campaign detail</p>
          <p className="text-sm text-slate-500">ID: {id}</p>
        </div>
      </div>
    );
  }

  const json = await res.json();
  const campaign = json.data;

  return <CampaignDetailClient initialCampaign={campaign} />;
}
