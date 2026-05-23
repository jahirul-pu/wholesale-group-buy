'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  ShoppingBag,
  Menu,
  X,
  LogIn,
  LogOut,
  User,
  Shield,
  ChevronDown,
  History,
  HelpCircle,
  Zap,
  LayoutDashboard,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import LoginModal from '@/components/LoginModal';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/', label: 'Active Deals', icon: Zap },
  { href: '/past-deals', label: 'Past Deals', icon: History },
  { href: '/faq', label: 'FAQ', icon: HelpCircle },
];

export default function GlobalHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  // Don't render global header on admin pages — they have their own layout
  if (pathname?.startsWith('/admin')) return null;

  const userPhone = session?.user?.phoneNumber || '';
  const userTrust = session?.user?.currentTrust ?? 0;
  const initials = userPhone ? userPhone.slice(-2).toUpperCase() : 'U';

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* ─── Left: Logo ─── */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 shadow-md shadow-emerald-600/20 transition-transform duration-200 group-hover:scale-105">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-bold tracking-tight text-slate-900">
                Wholesale
              </span>
              <span className="text-lg font-light text-emerald-600 ml-0.5">BD</span>
            </div>
          </Link>

          {/* ─── Center: Desktop Nav ─── */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[calc(100%+7px)] h-0.5 w-6 rounded-full bg-emerald-600" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ─── Right: Auth + Mobile Toggle ─── */}
          <div className="flex items-center gap-3">
            {/* Auth Area */}
            {status === 'loading' ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
            ) : session ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:shadow focus-ring cursor-pointer">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                      {initials}
                    </div>
                    <span className="hidden sm:inline max-w-[100px] truncate">
                      {userPhone}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={8}
                    className="z-[100] min-w-[220px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-200/50 animate-scale-in"
                  >
                    {/* User Info */}
                    <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                      <p className="text-sm font-semibold text-slate-900">{userPhone}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-xs font-medium text-emerald-700">
                          Trust Score: {userTrust}
                        </span>
                        <div className="ml-auto flex h-5 items-center rounded-full bg-emerald-50 px-2">
                          <span className="text-[10px] font-bold text-emerald-700 uppercase">
                            {userTrust >= 80 ? 'High' : userTrust >= 50 ? 'Medium' : 'Low'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <DropdownMenu.Item asChild>
                      <Link
                        href="/profile"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 cursor-pointer outline-none"
                      >
                        <User className="h-4 w-4 text-slate-400" />
                        My Profile
                      </Link>
                    </DropdownMenu.Item>

                    <DropdownMenu.Item asChild>
                      <Link
                        href="/admin/dashboard"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 cursor-pointer outline-none"
                      >
                        <LayoutDashboard className="h-4 w-4 text-slate-400" />
                        Admin Dashboard
                      </Link>
                    </DropdownMenu.Item>

                    <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />

                    <DropdownMenu.Item
                      onSelect={() => signOut({ callbackUrl: '/' })}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 cursor-pointer outline-none"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition-all duration-200 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/30 active:scale-[0.98] cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                Login
              </button>
            )}

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 md:hidden cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Mobile Sheet (Slide from Right) ─── */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed right-0 top-0 z-[70] h-full w-[300px] bg-white shadow-2xl animate-slide-in-right">
            <div className="flex h-full flex-col">
              {/* Sheet Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
                    <ShoppingBag className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-bold text-slate-900">WholesaleBD</span>
                </div>
                <Dialog.Close asChild>
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                    <X className="h-5 w-5" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Sheet Nav */}
              <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      )}
                    >
                      <link.icon className="h-5 w-5" />
                      {link.label}
                    </Link>
                  );
                })}

                <div className="my-3 h-px bg-slate-100" />

                <Link
                  href="/admin/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                >
                  <LayoutDashboard className="h-5 w-5" />
                  Admin Dashboard
                </Link>
              </nav>

              {/* Sheet Footer / Auth */}
              <div className="border-t border-slate-100 p-4">
                {session ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{userPhone}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Shield className="h-3 w-3 text-emerald-600" />
                          <span className="text-xs text-emerald-700">Trust: {userTrust}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        signOut({ callbackUrl: '/' });
                        setMobileOpen(false);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      setLoginOpen(true);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-700 cursor-pointer"
                  >
                    <LogIn className="h-5 w-5" />
                    Login / Register
                  </button>
                )}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Login Modal */}
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
