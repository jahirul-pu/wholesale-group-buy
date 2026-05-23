'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingBag,
  Mail,
  Phone,
  MapPin,
  Globe,
  PlayCircle,
} from 'lucide-react';

const quickLinks = [
  { href: '/', label: 'Home' },
  { href: '/', label: 'Active Deals' },
  { href: '/past-deals', label: 'Past Deals' },
  { href: '/profile', label: 'My Profile' },
];

const legalLinks = [
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/refund', label: 'Refund Policy' },
  { href: '/faq', label: 'FAQ' },
];

/* ─── Inline SVG Payment Icons ─── */
function BkashIcon() {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
      <div className="flex h-6 w-6 items-center justify-center rounded bg-pink-600">
        <span className="text-[10px] font-extrabold text-white">b</span>
      </div>
      <span className="text-xs font-bold text-pink-700">bKash</span>
    </div>
  );
}

function NagadIcon() {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
      <div className="flex h-6 w-6 items-center justify-center rounded bg-orange-500">
        <span className="text-[10px] font-extrabold text-white">N</span>
      </div>
      <span className="text-xs font-bold text-orange-600">Nagad</span>
    </div>
  );
}

function VisaIcon() {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
      <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-700">
        <span className="text-[9px] font-extrabold text-white italic">V</span>
      </div>
      <span className="text-xs font-bold text-blue-700">Visa</span>
    </div>
  );
}

function MastercardIcon() {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
      <div className="relative flex h-6 w-6 items-center justify-center">
        <div className="absolute left-0 h-4 w-4 rounded-full bg-red-500 opacity-90" />
        <div className="absolute right-0 h-4 w-4 rounded-full bg-amber-500 opacity-90" />
      </div>
      <span className="text-xs font-bold text-slate-700 ml-1">MC</span>
    </div>
  );
}

export default function GlobalFooter() {
  const pathname = usePathname();

  // Don't render footer on admin pages
  if (pathname?.startsWith('/admin')) return null;

  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      {/* Main Footer Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-md shadow-emerald-600/20 transition-transform group-hover:scale-105">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  Wholesale
                </span>
                <span className="text-xl font-light text-emerald-600 ml-0.5">BD</span>
              </div>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-slate-500 max-w-xs">
              Bangladesh&apos;s most trusted group buy platform. Join deals for ৳0, watch prices 
              cascade as more buyers pledge, and get authentic products delivered to your door.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-all hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50"
                aria-label="Facebook"
              >
                <Globe className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-all hover:border-red-300 hover:text-red-600 hover:bg-red-50"
                aria-label="YouTube"
              >
                <PlayCircle className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition-colors hover:text-emerald-600"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Legal
            </h3>
            <ul className="space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition-colors hover:text-emerald-600"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Contact & Support
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <span className="text-sm text-slate-500">support@wholesalebd.com</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <span className="text-sm text-slate-500">+880 1XXX-XXXXXX</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <span className="text-sm text-slate-500">
                  Savar, Dhaka<br />
                  Bangladesh
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Banner */}
      <div className="border-t border-slate-100 bg-slate-50/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Payment Partners */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-xs font-medium text-slate-400 mr-2">Payment Partners</span>
            <BkashIcon />
            <NagadIcon />
            <VisaIcon />
            <MastercardIcon />
          </div>

          {/* Copyright */}
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} WholesaleBD. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
