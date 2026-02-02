'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const MAX_PRODUCTS = 500;
const MAX_RESULTS_PER_SECTION = 8;

function matchQuery(s: string, q: string): boolean {
  if (!q.trim()) return true;
  return s.toLowerCase().includes(q.trim().toLowerCase());
}

export function GlobalSearch() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.groups.list(),
    enabled: !!user && open,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-search', open],
    queryFn: () => api.products.list({ limit: MAX_PRODUCTS, offset: 0 }),
    enabled: !!user && open,
  });
  const products = productsData?.items ?? [];

  const { data: usersList = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.list(),
    enabled: !!user && (user.role === 'admin' || user.role === 'superadmin') && open,
  });

  const q = query.trim();
  const matchedGroups = q
    ? groups.filter((g) => matchQuery(g.name, q) || matchQuery(g.description ?? '', q))
    : [];
  const matchedProducts = q
    ? products.filter((p) => matchQuery(p.name, q) || matchQuery(p.version ?? '', q))
    : [];
  const matchedUsers = q
    ? usersList.filter(
        (u) => matchQuery(u.name, q) || matchQuery(u.email, q)
      )
    : [];

  const hasResults =
    matchedGroups.length > 0 ||
    matchedProducts.length > 0 ||
    matchedUsers.length > 0;
  const showPanel = open && (query.length > 0 || hasResults || q === '');

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest('[data-global-search-trigger]')
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  const handleResultClick = () => {
    setOpen(false);
    setQuery('');
  };

  const groupsSlice = matchedGroups.slice(0, MAX_RESULTS_PER_SECTION);
  const usersSlice = matchedUsers.slice(0, MAX_RESULTS_PER_SECTION);
  const productsSlice = matchedProducts.slice(0, MAX_RESULTS_PER_SECTION);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        data-global-search-trigger
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center p-2 rounded-lg text-dhl-red hover:bg-dhl-yellow/20 border border-transparent hover:border-dhl-red/30 focus:outline-none focus:ring-2 focus:ring-dhl-red focus:ring-offset-2 transition-colors"
        aria-label="Search"
        aria-expanded={open}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>
      {showPanel && (
        <div
          className="absolute right-0 md:right-auto md:left-0 top-full mt-1 w-[min(400px,90vw)] rounded-xl border-2 border-dhl-red bg-white shadow-xl z-[60] overflow-hidden"
          role="dialog"
          aria-label="Search"
        >
          <div className="p-2 border-b border-slate-200">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search groups, users, products…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-dhl-red focus:border-dhl-red"
              aria-label="Search query"
            />
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {!q && (
              <p className="px-4 py-3 text-sm text-slate-500">Type to search groups, users, and products.</p>
            )}
            {q && !hasResults && (
              <p className="px-4 py-3 text-sm text-slate-500">No results.</p>
            )}
            {q && hasResults && (
              <>
                {groupsSlice.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Groups
                      </span>
                    </div>
                    <ul className="py-1">
                      {groupsSlice.map((g) => (
                        <li key={g.id}>
                          <Link
                            href="/groups"
                            onClick={handleResultClick}
                            className="block px-4 py-2.5 text-sm text-gray-900 hover:bg-dhl-yellow/20 focus:bg-dhl-yellow/20 focus:outline-none"
                          >
                            {g.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div className="border-b border-slate-200" aria-hidden />
                  </>
                )}
                {usersSlice.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Users
                      </span>
                    </div>
                    <ul className="py-1">
                      {usersSlice.map((u) => (
                        <li key={u.id}>
                          <Link
                            href={`/products?owner_id=${encodeURIComponent(u.id)}`}
                            onClick={handleResultClick}
                            className="block px-4 py-2.5 text-sm text-gray-900 hover:bg-dhl-yellow/20 focus:bg-dhl-yellow/20 focus:outline-none"
                          >
                            {u.name}
                            {u.email && (
                              <span className="text-slate-500 ml-1">({u.email})</span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div className="border-b border-slate-200" aria-hidden />
                  </>
                )}
                {productsSlice.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Products
                      </span>
                    </div>
                    <ul className="py-1">
                      {productsSlice.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/products/${p.id}`}
                            onClick={handleResultClick}
                            className="block px-4 py-2.5 text-sm text-gray-900 hover:bg-dhl-yellow/20 focus:bg-dhl-yellow/20 focus:outline-none"
                          >
                            {p.name}
                            {p.version && (
                              <span className="text-slate-500 ml-1">({p.version})</span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
