'use client';

import React from 'react';
import { useDashboardStore, DashboardView } from '@/store/useDashboardStore';
import { BarChart3, Truck, Activity, ShieldAlert } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { activeView, setActiveView } = useDashboardStore();

  const navigationItems = [
    {
      id: 'campaign-velocity' as DashboardView,
      name: 'Campaign Velocity',
      icon: BarChart3,
    },
    {
      id: 'savar-logistics' as DashboardView,
      name: 'Savar Logistics',
      icon: Truck,
    },
    {
      id: 'ecosystem-health' as DashboardView,
      name: 'Ecosystem Health',
      icon: Activity,
    },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col justify-between p-4">
        <div>
          {/* Dashboard Title / Logo */}
          <div className="flex items-center gap-3 px-2 py-4 mb-6">
            <ShieldAlert className="h-8 w-8 text-emerald-400 animate-pulse" />
            <div>
              <h1 className="font-bold text-lg tracking-wider text-emerald-400">Antigravity</h1>
              <p className="text-xs text-slate-400">Group Buy Admin</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-300 group ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Icon className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${
                    isActive ? 'text-emerald-400' : 'text-slate-400'
                  }`} />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 px-2 text-xs text-slate-500">
          <p>© 2026 Antigravity Logistics</p>
          <p className="text-[10px] text-slate-600 mt-1">Status: Operational</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-8">
        {children}
      </main>
    </div>
  );
}
