'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueries } from '@tanstack/react-query';
import { api, type Dependency, type Milestone, type Product, type ProductVersion } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export type RoadmapFilters = {
  lifecycle_status?: string;
  owner_id?: string;
  status?: string;
  category_1?: string;
  category_2?: string;
  category_3?: string;
  group_id?: string;
};

type RoadmapViewProps = {
  productId?: string;
  /** When set, products list is filtered (for dashboard → products/roadmap with filter). */
  filters?: RoadmapFilters;
};

/** Product owner (owner_id matches user) or admin can edit. Used for product page / milestone edits (requires active lifecycle on that page). */
function canEditProduct(
  product: { lifecycle_status?: string; owner_id?: string | null; owner?: { id?: string } },
  user: { id: string; role: string } | null
) {
  if (!user) return false;
  const isAdmin = (user.role ?? '').toLowerCase() === 'admin';
  if (isAdmin) return true;
  const lifecycle = (product.lifecycle_status ?? '').toString().toLowerCase();
  const isActive = lifecycle === 'active';
  const ownerId = (product.owner_id ?? product.owner?.id ?? '').toString().trim();
  const userId = (user.id ?? '').toString().trim();
  if (!isActive || !ownerId || !userId) return false;
  return ownerId.toLowerCase() === userId.toLowerCase();
}

/** Show "Edit roadmap" for product owner or admin whenever they own/have access (no lifecycle check on roadmap). */
function canEditRoadmap(
  product: { owner_id?: string | null; owner?: { id?: string } },
  user: { id: string; role: string } | null
) {
  if (!user) return false;
  const isAdmin = (user.role ?? '').toLowerCase() === 'admin';
  if (isAdmin) return true;
  const ownerId = (product.owner_id ?? product.owner?.id ?? '').toString().trim();
  const userId = (user.id ?? '').toString().trim();
  if (!ownerId || !userId) return false;
  return ownerId.toLowerCase() === userId.toLowerCase();
}

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return s;
  }
}

/** Distinct background colors for version sections (readable, soft tints). */
const VERSION_SECTION_BGS = [
  'bg-slate-50/80',           // Product-level
  'bg-blue-50/80',
  'bg-emerald-50/80',
  'bg-amber-50/80',
  'bg-violet-50/80',
  'bg-rose-50/80',
  'bg-sky-50/80',
  'bg-teal-50/80',
  'bg-orange-50/80',
  'bg-fuchsia-50/80',
] as const;

/** Left border accent colors for version sections (match tint). */
const VERSION_SECTION_BORDERS = [
  'border-l-indigo-400',      // Product-level
  'border-l-blue-400',
  'border-l-emerald-400',
  'border-l-amber-400',
  'border-l-violet-400',
  'border-l-rose-400',
  'border-l-sky-400',
  'border-l-teal-400',
  'border-l-orange-400',
  'border-l-fuchsia-400',
] as const;

function getVersionSectionBg(index: number): string {
  return VERSION_SECTION_BGS[index % VERSION_SECTION_BGS.length];
}

function getVersionSectionBorder(index: number): string {
  return VERSION_SECTION_BORDERS[index % VERSION_SECTION_BORDERS.length];
}

const BAR_HEIGHT = 28;
const ROW_GAP = 8;
const LABEL_WIDTH = 200;
const ROW_HEIGHT = BAR_HEIGHT + ROW_GAP;

/** Position of a milestone bar for dependency lines (percent 0–100, section index). */
type MilestonePos = { sectionIndex: number; leftPct: number; rightPct: number };

/** Gantt chart: one row per version, every milestone with full text; optional dependency lines (including across products/versions). Click a bar to show milestone details. */
function ProductGanttChart({
  sections,
  getVersionSectionBg,
  dependencies = [],
}: {
  sections: Array<{ key: string; title: string; milestones: Milestone[] }>;
  getVersionSectionBg: (index: number) => string;
  dependencies?: Dependency[];
}) {
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const allMilestones = sections.flatMap((s) => s.milestones);
  if (allMilestones.length === 0) return null;

  const allStarts = allMilestones.map((m) => new Date(m.start_date).getTime());
  const allEnds = allMilestones.map((m) =>
    m.end_date ? new Date(m.end_date).getTime() : new Date(m.start_date).getTime()
  );
  const minTime = Math.min(...allStarts);
  const maxTime = Math.max(...allEnds);
  const padding = (maxTime - minTime) * 0.05 || 30 * 24 * 60 * 60 * 1000;
  const rangeStart = minTime - padding;
  const rangeEnd = maxTime + padding;
  const rangeTotal = rangeEnd - rangeStart;

  const yearLabels: Array<{ t: number; label: string }> = [];
  const startYear = new Date(rangeStart).getFullYear();
  const endYear = new Date(rangeEnd).getFullYear();
  for (let y = startYear; y <= endYear; y++) {
    const jan1 = new Date(y, 0, 1).getTime();
    if (jan1 >= rangeStart && jan1 <= rangeEnd) {
      yearLabels.push({ t: jan1, label: String(y) });
    }
  }

  const milestonePos = new Map<string, MilestonePos>();
  sections.forEach((section, sectionIndex) => {
    section.milestones.forEach((m) => {
      const start = new Date(m.start_date).getTime();
      const end = m.end_date ? new Date(m.end_date).getTime() : start;
      const leftPct = ((start - rangeStart) / rangeTotal) * 100;
      const rightPct = ((end - rangeStart) / rangeTotal) * 100;
      milestonePos.set(m.id, { sectionIndex, leftPct, rightPct });
    });
  });

  const drawableDeps = dependencies.filter(
    (d) => milestonePos.has(d.source_milestone_id) && milestonePos.has(d.target_milestone_id)
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Time axis */}
        <div className="flex border-b border-slate-200" style={{ marginLeft: LABEL_WIDTH }}>
          <div className="flex-1 relative h-8">
            {yearLabels.map(({ t, label }) => {
              const x = ((t - rangeStart) / rangeTotal) * 100;
              return (
                <div
                  key={t}
                  className="absolute text-xs text-slate-500 -translate-x-1/2"
                  style={{ left: `${x}%`, top: 4 }}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </div>
        {/* Rows wrapper for SVG overlay */}
        <div className="relative">
          {/* One row per version — every milestone with full text */}
          {sections.map((section, index) => (
            <div
              key={section.key}
              className={`flex items-stretch border-b border-slate-100 ${getVersionSectionBg(index)}`}
              style={{ minHeight: ROW_HEIGHT }}
            >
              <div
                className={`shrink-0 py-2 px-3 text-sm border-r border-slate-200 ${
                  section.milestones.length === 0 ? 'font-bold text-slate-800' : 'font-medium text-slate-700'
                }`}
                style={{ width: LABEL_WIDTH }}
              >
                {section.title}
              </div>
              <div className="flex-1 relative py-2 px-1" style={{ minWidth: 400 }}>
                {section.milestones.map((m) => {
                  const start = new Date(m.start_date).getTime();
                  const end = m.end_date ? new Date(m.end_date).getTime() : start;
                  const left = ((start - rangeStart) / rangeTotal) * 100;
                  const width = (Math.max(end - start, 0) / rangeTotal) * 100;
                  const color = m.color || '#6366f1';
                  const noEndDate = !m.end_date;
                  const isSelected = selectedMilestone?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMilestone((prev) => (prev?.id === m.id ? null : m))}
                      className={`absolute flex items-center justify-center rounded-md shadow-sm border cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 ${isSelected ? 'ring-2 ring-offset-1 ring-indigo-500' : 'border-white/80'}`}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 2)}%`,
                        minWidth: 90,
                        top: ROW_GAP / 2,
                        height: BAR_HEIGHT,
                        backgroundColor: noEndDate ? 'transparent' : color,
                        borderColor: noEndDate ? '#cbd5e1' : undefined,
                      }}
                      title={noEndDate ? `${m.label}: ${formatDate(m.start_date)} (no end date). Click for details.` : `${m.label}: ${formatDate(m.start_date)} – ${formatDate(m.end_date!)}. Click for details.`}
                    >
                      <span className={`text-xs font-medium leading-relaxed whitespace-nowrap overflow-visible px-1 text-center ${noEndDate ? 'text-black' : 'text-white'}`}>
                        {m.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {/* Dependency lines overlay (only when both source and target are in this chart) */}
          {drawableDeps.length > 0 && (
            <svg
              className="absolute top-0 pointer-events-none"
              style={{ left: LABEL_WIDTH, right: 0, height: sections.length * ROW_HEIGHT }}
              viewBox={`0 0 100 ${sections.length * ROW_HEIGHT}`}
              preserveAspectRatio="none"
            >
              {drawableDeps.map((dep) => {
                const src = milestonePos.get(dep.source_milestone_id)!;
                const tgt = milestonePos.get(dep.target_milestone_id)!;
                const rowH = ROW_HEIGHT;
                const srcX = src.rightPct;
                const srcY = src.sectionIndex * rowH + rowH / 2;
                const tgtX = tgt.leftPct;
                const tgtY = tgt.sectionIndex * rowH + rowH / 2;
                const midX = (srcX + tgtX) / 2;
                const path = `M ${srcX} ${srcY} L ${midX} ${srcY} L ${midX} ${tgtY} L ${tgtX} ${tgtY}`;
                return (
                  <path
                    key={dep.id}
                    d={path}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                  />
                );
              })}
            </svg>
          )}
        </div>
      </div>
      {selectedMilestone && (
        <MilestoneDetailModal
          milestone={selectedMilestone}
          onClose={() => setSelectedMilestone(null)}
        />
      )}
    </div>
  );
}

function MilestoneDetailModal({
  milestone,
  onClose,
}: {
  milestone: Milestone;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-modal-title"
    >
      <div
        className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-4 border-b border-slate-200">
          <h3 id="milestone-modal-title" className="text-lg font-semibold text-slate-800 pr-8">
            {milestone.label}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-slate-600 sm:grid-cols-3">
            <div>
              <dt className="font-medium text-slate-500">Start</dt>
              <dd>{formatDate(milestone.start_date)}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">End</dt>
              <dd>{milestone.end_date ? formatDate(milestone.end_date) : '—'}</dd>
            </div>
            {milestone.type && (
              <div>
                <dt className="font-medium text-slate-500">Type</dt>
                <dd>{milestone.type}</dd>
              </div>
            )}
          </dl>
          <div className="mt-5 pt-4 border-t border-slate-100">
            <Link
              href={`/products/${milestone.product_id}`}
              className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View product →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RoadmapView({ productId, filters }: RoadmapViewProps) {
  const { user } = useAuthStore();
  const listParams = {
    limit: 100,
    offset: 0,
    ...(filters?.lifecycle_status && { lifecycle_status: filters.lifecycle_status }),
    ...(filters?.owner_id && { owner_id: filters.owner_id }),
    ...(filters?.status && { status: filters.status }),
    ...(filters?.category_1 && { category_1: filters.category_1 }),
    ...(filters?.category_2 && { category_2: filters.category_2 }),
    ...(filters?.category_3 && { category_3: filters.category_3 }),
    ...(filters?.group_id && { group_id: filters.group_id }),
  };
  const { data: productsResult } = useQuery({
    queryKey: ['products', listParams],
    queryFn: () => api.products.list(listParams),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const products = productsResult?.items ?? [];

  const productIds = productId ? [productId] : products.map((p) => p.id);
  const hasAny = productIds.length > 0;

  const { data: dependencies = [] } = useQuery({
    queryKey: ['dependencies', productId ?? 'all'],
    queryFn: () => api.dependencies.list(productId ? { product_id: productId } : {}),
    enabled: hasAny,
  });

  const showUnifiedGantt = !productId && productIds.length > 1;
  const milestonesQueries = useQueries({
    queries: showUnifiedGantt
      ? productIds.map((id) => ({
          queryKey: ['milestones', id],
          queryFn: () => api.milestones.listByProduct(id),
        }))
      : [],
  });
  const versionsQueries = useQueries({
    queries: showUnifiedGantt
      ? productIds.map((id) => ({
          queryKey: ['product-versions', id],
          queryFn: () => api.productVersions.listByProduct(id),
        }))
      : [],
  });

  const unifiedSections: Array<{ key: string; title: string; milestones: Milestone[] }> = [];
  if (showUnifiedGantt) {
    productIds.forEach((id, idx) => {
      const product = products.find((p) => p.id === id);
      if (!product) return;
      const milestones = milestonesQueries[idx]?.data ?? [];
      const versions = versionsQueries[idx]?.data ?? [];
      const byVersion = new Map<string | 'product', Milestone[]>();
      milestones.forEach((m) => {
        const key = m.product_version_id ?? 'product';
        if (!byVersion.has(key)) byVersion.set(key, []);
        byVersion.get(key)!.push(m);
      });
      // Product name on its own line
      unifiedSections.push({
        key: `${id}-header`,
        title: product.name,
        milestones: [],
      });
      // Each version on subsequent lines (indented)
      if (byVersion.has('product')) {
        unifiedSections.push({
          key: `${id}-product`,
          title: '  Product-level',
          milestones: byVersion.get('product')!,
        });
      }
      versions.forEach((v) => {
        if (byVersion.has(v.id)) {
          unifiedSections.push({
            key: `${id}-${v.id}`,
            title: `  Version ${v.version}`,
            milestones: byVersion.get(v.id)!,
          });
        }
      });
    });
  }
  const unifiedGanttLoading = showUnifiedGantt && milestonesQueries.some((q) => q.isLoading);

  if (!hasAny) {
    return (
      <div className="rounded-2xl bg-white/80 backdrop-blur border border-slate-200/80 shadow-sm text-center py-16 px-6">
        <p className="text-slate-500 text-lg">No products yet.</p>
        <p className="text-slate-400 mt-1 text-sm">Create a product and add milestones to see the roadmap.</p>
      </div>
    );
  }

  const penIconSvg = (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );

  return (
    <div className="space-y-10">
      {/* Single Gantt for all products — clear Product → Gantt separation */}
      {showUnifiedGantt && (
        <div className="rounded-2xl overflow-hidden border border-slate-200/80 shadow-md bg-white/95 backdrop-blur">
          <header className="relative bg-gradient-to-br from-indigo-50/90 via-slate-50 to-slate-100/90 border-b-2 border-slate-200 px-6 py-5 border-l-4 border-l-indigo-500">
            <span className="absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-widest text-indigo-600/80">
              All products
            </span>
            <h2 className="text-lg font-bold text-slate-800 pt-2">Unified Gantt</h2>
            <p className="text-slate-600 text-sm mt-0.5">One timeline for all products, versions, and dependencies.</p>
          </header>
          <div className="border-b-2 border-slate-200 bg-gradient-to-b from-sky-50/60 to-slate-50/40">
            <div className="px-6 pt-5 pb-2 flex items-center gap-2">
              <span className="flex h-8 w-1 rounded-full bg-sky-500" aria-hidden />
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Gantt chart
              </h3>
            </div>
            <div className="px-6 pb-6">
              {unifiedGanttLoading ? (
                <p className="text-slate-500 text-center py-8">Loading unified Gantt…</p>
              ) : unifiedSections.length > 0 ? (
                <ProductGanttChart
                  sections={unifiedSections}
                  getVersionSectionBg={getVersionSectionBg}
                  dependencies={dependencies}
                />
              ) : (
                <p className="text-slate-500 text-center py-8">No milestones in the selected products.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {productIds.map((id) => {
        const product = products.find((p) => p.id === id);
        return product ? (
          <ProductRoadmapSection
            key={id}
            productId={id}
            product={product}
            canEdit={canEditRoadmap(product, user)}
            showDescription={!!productId && productId === id}
            dependencies={dependencies}
            penIconSvg={penIconSvg}
          />
        ) : null;
      })}
    </div>
  );
}

function ProductRoadmapSection({
  productId,
  product,
  canEdit,
  showDescription,
  dependencies = [],
  penIconSvg,
}: {
  productId: string;
  product: Product;
  canEdit: boolean;
  showDescription: boolean;
  dependencies?: Dependency[];
  penIconSvg: React.ReactNode;
}) {
  const { data: versions = [] } = useQuery({
    queryKey: ['product-versions', productId],
    queryFn: () => api.productVersions.listByProduct(productId),
  });
  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['milestones', productId],
    queryFn: () => api.milestones.listByProduct(productId),
  });

  const byVersion = new Map<string | 'product', Milestone[]>();
  milestones.forEach((m) => {
    const key = m.product_version_id ?? 'product';
    if (!byVersion.has(key)) byVersion.set(key, []);
    byVersion.get(key)!.push(m);
  });

  const sections: Array<{ key: string; title: string; version?: ProductVersion; milestones: Milestone[] }> = [];
  // Product name on its own line
  sections.push({
    key: 'header',
    title: product.name,
    milestones: [],
  });
  // Each version on subsequent lines (indented)
  if (byVersion.has('product')) {
    sections.push({
      key: 'product',
      title: '  Product-level',
      milestones: byVersion.get('product')!,
    });
  }
  versions.forEach((v) => {
    if (byVersion.has(v.id)) {
      sections.push({
        key: v.id,
        title: `  Version ${v.version}`,
        version: v,
        milestones: byVersion.get(v.id)!,
      });
    }
  });

  const minYear = new Date().getFullYear() - 1;
  const maxYear = new Date().getFullYear() + 10;
  const timelineMin = new Date(minYear, 0, 1).getTime();
  const timelineMax = new Date(maxYear, 11, 31).getTime();
  const timelineTotal = timelineMax - timelineMin;

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white/80 backdrop-blur border border-slate-200/80 shadow-sm p-8 text-center">
        <p className="text-slate-500">Loading roadmap…</p>
      </div>
    );
  }

  return (
    <article className="rounded-2xl overflow-hidden border border-slate-200/80 shadow-md bg-white/95 backdrop-blur">
      {/* 1. Product — clear block with left accent */}
      <header className="group/product-header relative bg-gradient-to-br from-indigo-50/90 via-slate-50 to-slate-100/90 border-b-2 border-slate-200 px-6 py-6 border-l-4 border-l-indigo-500">
        <span className="absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-widest text-indigo-600/80">
          Product
        </span>
        <div className="flex flex-wrap items-start justify-between gap-4 pt-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              {canEdit && (
                <Link
                  href={`/products/${productId}`}
                  className="opacity-0 group-hover/product-header:opacity-100 group-focus-within/product-header:opacity-100 transition-opacity text-indigo-600 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50"
                  aria-label="Edit roadmap"
                  title="Edit roadmap (add or change milestones)"
                >
                  {penIconSvg}
                </Link>
              )}
              {product.name}
            </h2>
            {product.version && (
              <p className="text-slate-500 text-sm mt-0.5">Product version: {product.version}</p>
            )}
            {showDescription && product.description && (
              <p className="text-slate-600 mt-3 max-w-2xl leading-relaxed">{product.description}</p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  product.lifecycle_status === 'active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : product.lifecycle_status === 'not_active'
                      ? 'bg-slate-100 text-slate-600'
                      : product.lifecycle_status === 'suspend'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600'
                }`}
              >
                {product.lifecycle_status === 'active'
                  ? 'Active'
                  : product.lifecycle_status === 'not_active'
                    ? 'Not Active'
                    : product.lifecycle_status === 'suspend'
                      ? 'Suspended'
                      : 'End of roadmap'}
              </span>
              {product.owner?.name && (
                <span className="text-slate-500 text-sm">Owner: {product.owner.name}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. Gantt chart — distinct panel with sky tint */}
      {sections.length > 0 && (
        <div className="border-b-2 border-slate-200 bg-gradient-to-b from-sky-50/60 to-slate-50/40">
          <div className="px-6 pt-5 pb-2 flex items-center gap-2">
            <span className="flex h-8 w-1 rounded-full bg-sky-500" aria-hidden />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Gantt chart
            </h3>
          </div>
          <div className="px-6 pb-6">
            <ProductGanttChart
              sections={sections.map((s) => ({ key: s.key, title: s.title, milestones: s.milestones }))}
              getVersionSectionBg={getVersionSectionBg}
              dependencies={dependencies}
            />
          </div>
        </div>
      )}

      {/* 3. Versions & 4. Milestones — section label then version blocks with left borders */}
      <div className="bg-slate-50/30">
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center gap-2">
          <span className="flex h-6 w-1 rounded-full bg-violet-500" aria-hidden />
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Versions &amp; milestones
          </h3>
        </div>
        {sections.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500">
            No milestones yet. Add milestones from the product page to build the roadmap.
          </div>
        ) : (
          <div className="divide-y-2 divide-slate-200/80">
            {sections.map((section, index) => (
              <section
                key={section.key}
                className={`group/version-section border-l-4 pl-6 pr-6 py-6 ${getVersionSectionBg(index)} ${getVersionSectionBorder(index)}`}
              >
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  {canEdit && (
                    <Link
                      href={`/products/${productId}`}
                      className="opacity-0 group-hover/version-section:opacity-100 group-focus-within/version-section:opacity-100 transition-opacity text-indigo-600 hover:text-indigo-700 p-0.5 rounded hover:bg-indigo-50"
                      aria-label="Edit roadmap"
                      title="Edit roadmap"
                    >
                      {penIconSvg}
                    </Link>
                  )}
                  {section.title.trim()}
                </h4>
                <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mb-4">
                  Milestones
                </p>
                <div className="space-y-4">
                  {section.milestones.map((m) => (
                    <MilestoneCard
                      key={m.id}
                      milestone={m}
                      timelineMin={timelineMin}
                      timelineTotal={timelineTotal}
                      canEdit={canEdit}
                      editHref={`/products/${productId}`}
                      penIconSvg={penIconSvg}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function MilestoneCard({
  milestone,
  timelineMin,
  timelineTotal,
  canEdit,
  editHref,
  penIconSvg,
}: {
  milestone: Milestone;
  timelineMin: number;
  timelineTotal: number;
  canEdit?: boolean;
  editHref?: string;
  penIconSvg?: React.ReactNode;
}) {
  const start = new Date(milestone.start_date).getTime();
  const end = milestone.end_date ? new Date(milestone.end_date).getTime() : start;
  const left = ((start - timelineMin) / timelineTotal) * 100;
  const width = ((end - start) / timelineTotal) * 100;
  const color = milestone.color || '#6366f1';
  const noEndDate = !milestone.end_date;

  return (
    <div
      className="group/milestone-card rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all border-l-4"
      style={{ borderLeftColor: color }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white shadow"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0 flex items-center gap-2">
            {canEdit && editHref && penIconSvg && (
              <Link
                href={editHref}
                className="opacity-0 group-hover/milestone-card:opacity-100 group-focus-within/milestone-card:opacity-100 transition-opacity text-indigo-600 hover:text-indigo-700 p-0.5 rounded hover:bg-indigo-50 shrink-0"
                aria-label="Edit milestone"
                title="Edit milestone"
              >
                {penIconSvg}
              </Link>
            )}
            <p className={`font-semibold ${noEndDate ? 'text-black' : 'text-slate-800'}`}>{milestone.label}</p>
            {milestone.type && (
              <p className="text-xs text-slate-500 mt-0.5">{milestone.type}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-600 shrink-0">
          <span>{formatDate(milestone.start_date)}</span>
          <span className="text-slate-400">→</span>
          <span>{milestone.end_date ? formatDate(milestone.end_date) : '—'}</span>
        </div>
      </div>
      <div className="mt-3">
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              marginLeft: `${left}%`,
              width: `${Math.max(width, 2)}%`,
              backgroundColor: color,
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>Timeline</span>
        </div>
      </div>
    </div>
  );
}
