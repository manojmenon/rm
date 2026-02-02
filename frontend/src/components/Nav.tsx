'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { getPendingCount } from '@/lib/requestUtils';
import { GlobalSearch } from '@/components/GlobalSearch';
import { useState, useLayoutEffect, useRef, useEffect } from 'react';

export function Nav() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [hasToken, setHasToken] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const direct = localStorage.getItem('access_token');
    if (direct) {
      setHasToken(true);
      return;
    }
    try {
      const raw = localStorage.getItem('auth');
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: { accessToken?: string } };
        setHasToken(!!parsed?.state?.accessToken);
      }
    } catch {
      setHasToken(false);
    }
  }, []);

  const canFetchRequests = !!user || hasToken;

  const { data: creationRequests } = useQuery({
    queryKey: ['product-requests'],
    queryFn: () => api.requests.list(),
    enabled: canFetchRequests,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
  const { data: deletionRequests } = useQuery({
    queryKey: ['deletion-requests'],
    queryFn: () => api.deletionRequests.list(),
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  const { data: pendingProductsResult } = useQuery({
    queryKey: ['products', { status: 'pending', limit: 1, offset: 0 }],
    queryFn: () => api.products.list({ status: 'pending', limit: 1, offset: 0 }),
    enabled: canFetchRequests,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  const pendingProductsCount = pendingProductsResult?.total ?? 0;
  const pendingRequestCount =
    getPendingCount(creationRequests, deletionRequests) + pendingProductsCount;

  const { data: notifCountRes } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => api.notifications.unreadCount(),
    enabled: !!user,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
  const unreadCount = notifCountRes?.count ?? 0;

  useEffect(() => {
    if (!userMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [userMenuOpen]);

  const linkClass = (href: string) =>
    pathname === href
      ? 'bg-dhl-yellow text-dhl-red font-semibold'
      : 'text-dhl-red hover:bg-dhl-yellow/20 hover:text-dhl-red';

  const link = (href: string, label: string, badge?: number) => (
    <Link
      href={href}
      onClick={() => setMenuOpen(false)}
      className={`block px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${linkClass(href)}`}
    >
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span
          className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold text-white bg-dhl-red shrink-0"
          aria-label={`${badge} pending`}
        >
          {badge}
        </span>
      )}
    </Link>
  );

  const dropdownLink = (href: string, label: string, badge?: number) => (
    <Link
      href={href}
      onClick={() => setUserMenuOpen(false)}
      className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between gap-2 transition-colors ${linkClass(href)}`}
    >
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold text-white bg-dhl-red shrink-0">
          {badge}
        </span>
      )}
    </Link>
  );

  return (
    <nav className="border-b-2 border-dhl-red bg-white sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 flex items-center justify-between min-h-14 sm:min-h-14">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="flex items-center justify-center p-2 rounded-lg text-dhl-red hover:bg-dhl-yellow/20 shrink-0 focus:outline-none focus:ring-2 focus:ring-dhl-red focus:ring-offset-2 transition-colors"
            aria-label="Home"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </Link>
          {/* Desktop nav links: Roadmap, Products, Stats */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {link('/roadmap', 'Roadmap')}
              {link('/products', 'Products', pendingRequestCount)}
              {link('/dashboard', 'Stats')}
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center justify-end gap-2 shrink-0">
          {user ? (
            <>
              <GlobalSearch />
              <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 min-h-[2.25rem] px-2.5 py-1.5 rounded-lg text-sm font-medium text-dhl-red hover:bg-dhl-yellow/20 border border-transparent hover:border-dhl-red/30 focus:outline-none focus:ring-2 focus:ring-dhl-red focus:ring-offset-2 transition-colors"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                aria-label="User menu"
              >
                {(user as { avatar_url?: string; photo?: string }).avatar_url || (user as { avatar_url?: string; photo?: string }).photo ? (
                  <img
                    src={(user as { avatar_url?: string; photo?: string }).avatar_url || (user as { avatar_url?: string; photo?: string }).photo}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-dhl-red/30"
                    width={32}
                    height={32}
                  />
                ) : (
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-dhl-yellow/30 text-dhl-red shrink-0 ring-2 ring-dhl-red/30" aria-hidden>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                )}
                <svg className="w-4 h-4 shrink-0 text-dhl-red" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {userMenuOpen && (
                <div
                  className="absolute right-0 mt-1 w-56 rounded-xl border-2 border-dhl-red bg-white shadow-xl z-[60] overflow-hidden"
                  role="menu"
                  aria-label="User menu"
                >
                  <div className="p-2 bg-dhl-yellow/10">
                    {(user.role === 'admin' || user.role === 'superadmin') && (
                      <>
                        {dropdownLink('/groups', 'Groups')}
                        {dropdownLink('/requests', 'Requests queue', pendingRequestCount)}
                        {dropdownLink('/audit-logs', 'Audit logs')}
                        {dropdownLink('/activity-logs', 'Activity Logs')}
                        {dropdownLink('/notifications', 'Notifications', unreadCount)}
                        {dropdownLink('/admin/users', 'Users')}
                        <div className="border-t border-dhl-red/30 my-2" aria-hidden />
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => { logout(); setUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-dhl-red border-2 border-dhl-red hover:bg-dhl-red hover:text-white transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 rounded-lg text-sm font-medium text-dhl-red border-2 border-dhl-red hover:bg-dhl-yellow/20 focus:outline-none focus:ring-2 focus:ring-dhl-red focus:ring-offset-2 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-dhl-red border-2 border-dhl-red hover:bg-dhl-red/90 focus:outline-none focus:ring-2 focus:ring-dhl-yellow focus:ring-offset-2 transition-colors"
              >
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile: hamburger + optional email */}
        <div className="flex md:hidden items-center gap-2">
          {user && (
            <>
              <span className="text-xs text-dhl-red/80 truncate max-w-[100px] sm:max-w-[120px] font-medium" title={user.email}>
                {user.email}
              </span>
              <GlobalSearch />
            </>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="p-2 rounded-lg text-dhl-red hover:bg-dhl-yellow/20 focus:ring-2 focus:ring-dhl-red focus:ring-offset-2 transition-colors"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile / tablet dropdown */}
      {menuOpen && (
        <div
          className="md:hidden border-t-2 border-dhl-red/50 bg-dhl-yellow/5"
          role="dialog"
          aria-label="Navigation menu"
        >
          <div className="container mx-auto px-4 py-3 flex flex-col gap-1 max-h-[min(70vh,400px)] overflow-y-auto">
            {user ? (
              <>
                {link('/roadmap', 'Roadmap')}
                {link('/products', 'Products', pendingRequestCount)}
                {link('/dashboard', 'Stats')}
                {(user.role === 'admin' || user.role === 'superadmin') && (
                  <>
                    <div className="border-t border-dhl-red/30 mt-2 pt-2" aria-hidden />
                    {link('/groups', 'Groups')}
                    {link('/requests', 'Requests queue', pendingRequestCount)}
                    {link('/audit-logs', 'Audit logs')}
                    {link('/activity-logs', 'Activity Logs')}
                    {link('/notifications', 'Notifications', unreadCount)}
                    {link('/admin/users', 'Users')}
                  </>
                )}
                <div className="pt-2 mt-2 border-t-2 border-dhl-red/30 flex flex-col gap-2">
                  <button
                    onClick={() => { logout(); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-dhl-red border-2 border-dhl-red hover:bg-dhl-red hover:text-white transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-dhl-red border-2 border-dhl-red hover:bg-dhl-yellow/20 text-center transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-dhl-red border-2 border-dhl-red hover:bg-dhl-red/90 text-center transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
