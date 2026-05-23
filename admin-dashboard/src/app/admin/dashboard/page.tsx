'use client';

import React from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import CampaignVelocity from '@/components/CampaignVelocity';
import SavarLogistics from '@/components/SavarLogistics';
import EcosystemHealth from '@/components/EcosystemHealth';

export default function DashboardPage() {
  const { activeView } = useDashboardStore();

  const renderActiveView = () => {
    switch (activeView) {
      case 'campaign-velocity':
        return <CampaignVelocity />;
      case 'savar-logistics':
        return <SavarLogistics />;
      case 'ecosystem-health':
        return <EcosystemHealth />;
      default:
        return <CampaignVelocity />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-1 pb-4 border-b border-slate-800">
        <h2 className="text-2xl font-bold tracking-tight text-white capitalize">
          {activeView.replace('-', ' ')}
        </h2>
        <p className="text-sm text-slate-400">
          Real-time operations control and analytics panel
        </p>
      </header>

      {/* Main View Container */}
      <div className="flex-1">
        {renderActiveView()}
      </div>
    </div>
  );
}
