'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { api, type Notification } from '@/lib/api';
import { getPendingCount } from '@/lib/requestUtils';
import { useState, useLayoutEffect, useRef, useEffect } from 'react';

export function Nav() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

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

  const [notifViewArchived, setNotifViewArchived] = useState(false);
  const { data: notifList, isLoading: notifLoading } = useQuery({
    queryKey: ['notifications', notifViewArchived],
    queryFn: () => api.notifications.list({ limit: 30, offset: 0, archived: notifViewArchived }),
    enabled: !!user && notifOpen,
    staleTime: 0,
  });
  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
  const markReadAllMutation = useMutation({
    mutationFn: () => api.notifications.markReadAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.notifications.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.notifications.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  useEffect(() => {
    if (!notifOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [notifOpen]);

  const linkClass = (href: string) =>
    pathname === href
      ? 'bg-dhl-yellow text-gray-900'
      : 'text-gray-700 hover:bg-gray-100';

  const link = (href: string, label: string, badge?: number) => (
    <Link
      href={href}
      onClick={() => setMenuOpen(false)}
      className={`block px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${linkClass(href)}`}
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

  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4 flex items-center justify-between min-h-14 sm:min-h-14">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/" className="font-semibold text-gray-900 shrink-0">
            Roadmap
          </Link>
          {/* Desktop nav links */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {link('/dashboard', 'Dashboard')}
              {link('/products', 'Products', pendingRequestCount)}
              {link('/roadmap', 'Roadmap')}
              {link('/groups', 'Groups')}
              {link('/requests', 'Requests queue', pendingRequestCount)}
              {link('/audit-logs', 'Audit logs')}
              {link('/notifications', 'Notifications', unreadCount)}
              {user.role === 'admin' && link('/admin', 'Admin')}
              {user.role === 'admin' && link('/admin/users', 'Users')}
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <div className="relative" ref={notifDropdownRef}>
                <button
                  type="button"
                  onClick={() => setNotifOpen((o) => !o)}
                  className="flex items-center gap-1.5 min-h-[2.25rem] px-2 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-dhl-red"
                  aria-expanded={notifOpen}
                  aria-haspopup="true"
                  aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
                >
                  <span className="truncate max-w-[140px]">{user.name || user.email}</span>
                  {unreadCount > 0 && (
                    <span
                      className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold text-white bg-dhl-red shrink-0"
                      aria-hidden
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                  <svg className="w-4 h-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {notifOpen && (
                  <div
                    className="absolute right-0 mt-1 w-[min(90vw,380px)] max-h-[min(70vh,420px)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg z-[60] flex flex-col"
                    role="menu"
                    aria-label="Notifications"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                      <span className="font-semibold text-gray-900">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => markReadAllMutation.mutate()}
                          disabled={markReadAllMutation.isPending}
                          className="text-xs font-medium text-dhl-red hover:underline disabled:opacity-50"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="flex border-b border-gray-100">
                      <button
                        type="button"
                        onClick={() => setNotifViewArchived(false)}
                        className={`flex-1 px-3 py-2 text-sm font-medium ${!notifViewArchived ? 'text-dhl-red border-b-2 border-dhl-red' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        Inbox
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifViewArchived(true)}
                        className={`flex-1 px-3 py-2 text-sm font-medium ${notifViewArchived ? 'text-dhl-red border-b-2 border-dhl-red' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        Archived
                      </button>
                    </div>
                    <div className="overflow-y-auto flex-1 min-h-0">
                      {notifLoading ? (
                        <p className="px-4 py-6 text-sm text-gray-500 text-center">Loading…</p>
                      ) : !notifList?.items?.length ? (
                        <p className="px-4 py-6 text-sm text-gray-500 text-center">
                          {notifViewArchived ? 'No archived messages.' : 'No notifications.'}
                        </p>
                      ) : (
                        <ul className="divide-y divide-gray-100">
                          {notifList.items.map((n: Notification) => (
                            <li key={n.id} className="px-4 py-3 hover:bg-gray-50">
                              <div className="flex gap-2">
                                <div className={`flex-1 min-w-0 ${!n.read_at ? 'font-medium' : ''}`}>
                                  <p className="text-sm text-gray-900">{n.title}</p>
                                  <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {new Date(n.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <div className="flex flex-col gap-1 shrink-0">
                                  {!n.read_at && (
                                    <button
                                      type="button"
                                      onClick={() => markReadMutation.mutate(n.id)}
                                      disabled={markReadMutation.isPending}
                                      className="text-xs text-gray-500 hover:text-gray-700"
                                      title="Mark as read"
                                    >
                                      Mark read
                                    </button>
                                  )}
                                  {!notifViewArchived && !n.archived_at && (
                                    <button
                                      type="button"
                                      onClick={() => archiveMutation.mutate(n.id)}
                                      disabled={archiveMutation.isPending}
                                      className="text-xs text-gray-500 hover:text-gray-700"
                                      title="Archive"
                                    >
                                      Archive
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => deleteMutation.mutate(n.id)}
                                    disabled={deleteMutation.isPending}
                                    className="text-xs text-red-600 hover:text-red-700"
                                    title="Delete"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={logout} className="btn-secondary text-sm">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary text-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary text-sm">
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile: hamburger + optional email */}
        <div className="flex md:hidden items-center gap-2">
          {user && (
            <span className="text-xs text-gray-500 truncate max-w-[100px] sm:max-w-[120px]" title={user.email}>
              {user.email}
            </span>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-dhl-red focus:ring-offset-2"
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
          className="md:hidden border-t border-gray-200 bg-white"
          role="dialog"
          aria-label="Navigation menu"
        >
          <div className="container mx-auto px-4 py-3 flex flex-col gap-1 max-h-[min(70vh,400px)] overflow-y-auto">
            {user ? (
              <>
                {link('/dashboard', 'Dashboard')}
                {link('/products', 'Products', pendingRequestCount)}
                {link('/roadmap', 'Roadmap')}
                {link('/groups', 'Groups')}
                {link('/requests', 'Requests queue', pendingRequestCount)}
                {link('/audit-logs', 'Audit logs')}
                {link('/notifications', 'Notifications', unreadCount)}
                {user.role === 'admin' && link('/admin', 'Admin')}
                {user.role === 'admin' && link('/admin/users', 'Users')}
                <div className="pt-2 mt-2 border-t border-gray-200 flex flex-col gap-2">
                  <button onClick={() => { logout(); setMenuOpen(false); }} className="btn-secondary text-sm w-full text-left px-3 py-2.5">
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-2">
                <Link href="/login" onClick={() => setMenuOpen(false)} className="btn-secondary text-sm text-center py-2.5">
                  Sign in
                </Link>
                <Link href="/register" onClick={() => setMenuOpen(false)} className="btn-primary text-sm text-center py-2.5">
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
