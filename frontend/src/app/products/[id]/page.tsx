'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { RequireAuth } from '@/components/RequireAuth';
import { MilestoneEditor } from '@/components/MilestoneEditor';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const LIFECYCLE_LABELS: Record<string, string> = {
  active: 'Active',
  not_active: 'Not Active',
  suspend: 'Suspended',
  end_of_roadmap: 'End of roadmap',
};

function LifecycleBadge({ status }: { status: string }) {
  const label = LIFECYCLE_LABELS[status] ?? status;
  const color =
    status === 'active'
      ? 'bg-green-100 text-green-800'
      : status === 'not_active'
        ? 'bg-gray-100 text-gray-700'
        : status === 'suspend'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function ProductDetailContent() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showMilestoneEditor, setShowMilestoneEditor] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [showAddVersion, setShowAddVersion] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState<{ versionId: string; version: string } | null>(null);
  const [confirmDeleteProductNameTyped, setConfirmDeleteProductNameTyped] = useState('');
  const [confirmDeleteVersionTyped, setConfirmDeleteVersionTyped] = useState('');
  const [confirmRequestDeletionProductName, setConfirmRequestDeletionProductName] = useState<string | null>(null);
  const [confirmRequestDeletionTyped, setConfirmRequestDeletionTyped] = useState('');
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingVersionValue, setEditingVersionValue] = useState('');
  const [hoveredVersionId, setHoveredVersionId] = useState<string | null>(null);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [hoveredMilestoneId, setHoveredMilestoneId] = useState<string | null>(null);
  const [confirmDeleteMilestone, setConfirmDeleteMilestone] = useState<{ id: string; label: string } | null>(null);
  const [addingDepVersionId, setAddingDepVersionId] = useState<string | null>(null);
  const [newDepTargetProductId, setNewDepTargetProductId] = useState('');
  const [newDepTargetVersionId, setNewDepTargetVersionId] = useState('');
  const [newDepRequiredStatus, setNewDepRequiredStatus] = useState('');
  const [category1, setCategory1] = useState('');
  const [category2, setCategory2] = useState('');
  const [category3, setCategory3] = useState('');

  const isAdmin = (user?.role ?? '').toLowerCase() === 'admin';
  const canEditProduct = (product: { lifecycle_status?: string; owner_id?: string | null; owner?: { id?: string } }) => {
    if (isAdmin) return true;
    if (!user?.id) return false;
    const lifecycle = (product.lifecycle_status ?? '').toString().toLowerCase();
    const isActive = lifecycle === 'active';
    const ownerId = (product.owner_id ?? product.owner?.id ?? '').toString().trim();
    const userId = (user.id ?? '').toString().trim();
    if (!isActive || !ownerId || !userId) return false;
    return ownerId.toLowerCase() === userId.toLowerCase();
  };
  /** Only the product owner (not admin) can edit categories. */
  const canEditCategories = (product: { owner_id?: string | null; owner?: { id?: string } }) => {
    if (!user?.id) return false;
    const ownerId = (product.owner_id ?? product.owner?.id ?? '').toString().trim();
    const userId = (user.id ?? '').toString().trim();
    return ownerId !== '' && ownerId.toLowerCase() === userId.toLowerCase();
  };
  /** Product owner can request deletion; if product has no owner assigned, any authenticated user can request. */
  const canRequestDeletion = (product: { owner_id?: string | null; owner?: { id?: string } }) => {
    if (!user?.id) return false;
    const ownerId = (product.owner_id ?? product.owner?.id ?? '').toString().trim();
    const userId = (user.id ?? '').toString().trim();
    if (!ownerId) return true; // no owner assigned: allow any logged-in user to request deletion
    return ownerId.toLowerCase() === userId.toLowerCase();
  };

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.products.get(id),
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (product) {
      setCategory1(product.category_1 ?? '');
      setCategory2(product.category_2 ?? '');
      setCategory3(product.category_3 ?? '');
    }
  }, [product?.id, product?.category_1, product?.category_2, product?.category_3]);

  const { data: versions = [] } = useQuery({
    queryKey: ['product-versions', id],
    queryFn: () => api.productVersions.listByProduct(id),
    enabled: !!id,
    staleTime: 0,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', id],
    queryFn: () => api.milestones.listByProduct(id),
    enabled: !!id,
    staleTime: 0,
  });

  const versionDepsQueries = useQueries({
    queries: (versions ?? []).map((v) => ({
      queryKey: ['version-dependencies', v.id],
      queryFn: () => api.productVersionDependencies.listByProductVersion(v.id),
      enabled: !!v.id,
    })),
  });
  const versionDepsByVersionId: Record<string, ProductVersionDependency[]> = {};
  versions.forEach((v, idx) => {
    const data = versionDepsQueries[idx]?.data;
    if (data) versionDepsByVersionId[v.id] = data;
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ['products', 'all', { limit: 200 }],
    queryFn: () => api.products.list({ limit: 200, offset: 0 }).then((r) => r.items),
    enabled: !!id && versions.length > 0,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.list(),
    enabled: isAdmin,
    staleTime: 0,
  });

  const requestDeletionMutation = useMutation({
    mutationFn: () => api.products.requestDeletion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
      setConfirmRequestDeletionProductName(null);
      setConfirmRequestDeletionTyped('');
    },
  });

  const openConfirmRequestDeletion = () => {
    if (product) {
      setConfirmRequestDeletionProductName(product.name);
      setConfirmRequestDeletionTyped('');
    }
  };
  const closeConfirmRequestDeletion = () => {
    setConfirmRequestDeletionProductName(null);
    setConfirmRequestDeletionTyped('');
  };
  const handleConfirmRequestDeletion = () => {
    if (!isRequestDeletionConfirmValid || requestDeletionMutation.isPending) return;
    requestDeletionMutation.mutate();
  };
  const isRequestDeletionConfirmValid =
    !!confirmRequestDeletionProductName &&
    confirmRequestDeletionTyped.trim() === (confirmRequestDeletionProductName ?? '').trim();

  const addVersionMutation = useMutation({
    mutationFn: () => api.productVersions.create({ product_id: id, version: newVersionName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-versions', id] });
      setNewVersionName('');
      setShowAddVersion(false);
    },
  });

  const updateVersionMutation = useMutation({
    mutationFn: ({ versionId, version }: { versionId: string; version: string }) =>
      api.productVersions.update(versionId, { version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-versions', id] });
      setEditingVersionId(null);
      setEditingVersionValue('');
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: (versionId: string) => api.productVersions.delete(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-versions', id] });
      queryClient.invalidateQueries({ queryKey: ['milestones', id] });
      setConfirmDeleteVersion(null);
      setConfirmDeleteProductNameTyped('');
      setConfirmDeleteVersionTyped('');
    },
  });

  const addVersionDepMutation = useMutation({
    mutationFn: (body: { source_product_version_id: string; target_product_id: string; target_product_version_id?: string; required_status: string }) =>
      api.productVersionDependencies.create(body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['version-dependencies', variables.source_product_version_id] });
      setAddingDepVersionId(null);
      setNewDepTargetProductId('');
      setNewDepTargetVersionId('');
      setNewDepRequiredStatus('');
    },
  });
  const deleteVersionDepMutation = useMutation({
    mutationFn: (depId: string) => api.productVersionDependencies.delete(depId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['version-dependencies'] });
    },
  });

  const { data: targetProductVersions = [] } = useQuery({
    queryKey: ['product-versions', newDepTargetProductId],
    queryFn: () => api.productVersions.listByProduct(newDepTargetProductId),
    enabled: !!newDepTargetProductId && !!addingDepVersionId,
  });

  const closeConfirmDeleteVersion = () => {
    setConfirmDeleteVersion(null);
    setConfirmDeleteProductNameTyped('');
    setConfirmDeleteVersionTyped('');
  };

  const handleConfirmDeleteVersion = () => {
    if (!confirmDeleteVersion || !product) return;
    if (
      confirmDeleteProductNameTyped.trim() !== product.name ||
      confirmDeleteVersionTyped.trim() !== confirmDeleteVersion.version
    )
      return;
    deleteVersionMutation.mutate(confirmDeleteVersion.versionId);
  };

  const updateLifecycleMutation = useMutation({
    mutationFn: (lifecycle_status: string) =>
      api.products.update(id, { lifecycle_status }),
    onSuccess: (data) => {
      if (data) queryClient.setQueryData(['product', id], data);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.products.update(id, { status }),
    onSuccess: (data) => {
      if (data) queryClient.setQueryData(['product', id], data);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const updateOwnerMutation = useMutation({
    mutationFn: (owner_id: string | null) =>
      api.products.update(id, owner_id === null ? { clear_owner: true } : { owner_id }),
    onSuccess: (data) => {
      queryClient.setQueryData(['product', id], data);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const updateCategoriesMutation = useMutation({
    mutationFn: (body: { category_1?: string; category_2?: string; category_3?: string }) =>
      api.products.update(id, body),
    onSuccess: (data) => {
      if (data) queryClient.setQueryData(['product', id], data);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: (milestoneId: string) => api.milestones.delete(milestoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', id] });
      setConfirmDeleteMilestone(null);
    },
  });

  if (isLoading || !product) {
    return <p className="text-gray-500">Loading...</p>;
  }

  const hasPendingDeletion = Boolean(product.pending_deletion_request);
  const canEdit = canEditProduct(product) && !hasPendingDeletion;
  const milestonesByVersion = new Map<string | 'product', typeof milestones>();
  milestones.forEach((m) => {
    const key = m.product_version_id ?? 'product';
    if (!milestonesByVersion.has(key)) milestonesByVersion.set(key, []);
    milestonesByVersion.get(key)!.push(m);
  });

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
            <LifecycleBadge status={product.lifecycle_status} />
            {hasPendingDeletion && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                Requested for deletion
              </span>
            )}
          </div>
          <p className="text-gray-600 mt-1">
            <span className="text-gray-500">Version:</span>{' '}
            <span className="font-medium text-gray-700">{product.version || '—'}</span>
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 flex-wrap items-center">
            <Link href={`/roadmap?product=${product.id}`} className="btn-primary">
              Roadmap
            </Link>
            {canRequestDeletion(product) && (
              <>
                <button
                  type="button"
                  onClick={openConfirmRequestDeletion}
                  disabled={requestDeletionMutation.isPending || hasPendingDeletion}
                  className={
                    hasPendingDeletion
                      ? 'btn-secondary opacity-60 cursor-not-allowed text-gray-500 border-gray-300'
                      : 'btn-secondary text-red-600 border-red-200 hover:bg-red-50'
                  }
                  title={
                    hasPendingDeletion
                      ? 'Deletion already requested'
                      : 'Request product deletion'
                  }
                >
                  {hasPendingDeletion
                    ? 'Deletion requested'
                    : requestDeletionMutation.isPending
                      ? 'Requesting…'
                      : 'Request deletion'}
                </button>
                {requestDeletionMutation.isError && (
                  <p className="text-sm text-red-600" role="alert">
                    {requestDeletionMutation.error?.message ?? 'Request failed'}
                  </p>
                )}
                {requestDeletionMutation.isSuccess && (
                  <p className="text-sm text-green-600" role="status">
                    Deletion request submitted. An admin will review it.
                  </p>
                )}
              </>
            )}
          </div>
          {isAdmin && (
            <div className="card bg-slate-50 border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-3">Admin controls</h3>
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 shrink-0">Status</label>
                  <select
                    value={
                      (product.status ?? '').toLowerCase() === 'approved'
                        ? 'approved'
                        : (product.status ?? '').toLowerCase() === 'archived'
                          ? 'archived'
                          : 'pending'
                    }
                    onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                    className="input w-auto"
                    title="Product status (pending / approved / archived)"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 shrink-0">Lifecycle</label>
                  <select
                    value={product.lifecycle_status}
                    onChange={(e) => updateLifecycleMutation.mutate(e.target.value)}
                    className="input w-auto"
                    title="Lifecycle (Active / Not Active / Suspend / End of roadmap)"
                  >
                    <option value="active">Active</option>
                    <option value="not_active">Not Active</option>
                    <option value="suspend">Suspend</option>
                    <option value="end_of_roadmap">End of roadmap</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 shrink-0">Owner</label>
                  <select
                    value={product.owner_id ?? 'none'}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateOwnerMutation.mutate(v === 'none' ? null : v);
                    }}
                    className="input w-auto min-w-[140px]"
                    disabled={updateOwnerMutation.isPending}
                    title="Assign product owner (admin)"
                  >
                    <option value="none">No owner</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {hasPendingDeletion && !isAdmin && (
        <div className="text-sm text-amber-700 mb-2 bg-amber-50 p-3 rounded space-y-1">
          <p>This product has a pending deletion request. Editing is disabled until an admin approves or rejects the request.</p>
          {versions.length > 0 && (
            <p>Delete all versions before the product can be deleted.</p>
          )}
        </div>
      )}
      <div className="card mb-6">
        <h3 className="font-semibold mb-2">Product description</h3>
        <p className="text-gray-600 whitespace-pre-wrap">{product.description || 'No description.'}</p>
        <p className="mt-4 text-sm text-gray-500">
          Version: {product.version || '—'} · Status: {product.status} · Owner: {product.owner?.name ?? '—'}
        </p>
      </div>
      {canEditCategories(product) && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-3">Categories</h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category 1</label>
              <input
                type="text"
                value={category1}
                onChange={(e) => setCategory1(e.target.value)}
                className="input w-40"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category 2</label>
              <input
                type="text"
                value={category2}
                onChange={(e) => setCategory2(e.target.value)}
                className="input w-40"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category 3</label>
              <input
                type="text"
                value={category3}
                onChange={(e) => setCategory3(e.target.value)}
                className="input w-40"
                placeholder="Optional"
              />
            </div>
            {(category1 !== (product.category_1 ?? '') || category2 !== (product.category_2 ?? '') || category3 !== (product.category_3 ?? '')) && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    updateCategoriesMutation.mutate({
                      category_1: category1.trim(),
                      category_2: category2.trim(),
                      category_3: category3.trim(),
                    });
                  }}
                  disabled={updateCategoriesMutation.isPending}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {updateCategoriesMutation.isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategory1(product.category_1 ?? '');
                    setCategory2(product.category_2 ?? '');
                    setCategory3(product.category_3 ?? '');
                  }}
                  disabled={updateCategoriesMutation.isPending}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-2">Used for filtering in Products and Roadmap. Change values then click Save or Cancel.</p>
        </div>
      )}
      {!canEditCategories(product) && (product.category_1 || product.category_2 || product.category_3) && (
        <div className="card mb-6">
          <h3 className="font-semibold mb-2">Categories</h3>
          <p className="text-sm text-gray-500">
            Category 1: {product.category_1 || '—'} · Category 2: {product.category_2 || '—'} · Category 3: {product.category_3 || '—'}
          </p>
        </div>
      )}

      {/* Product versions */}
      <div className="card mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Product versions</h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAddVersion((v) => !v)}
              className="btn-secondary text-sm"
            >
              {showAddVersion ? 'Cancel' : 'Add version'}
            </button>
          )}
        </div>
        {showAddVersion && (
          <div className="flex gap-2 mb-4">
            <input
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              className="input flex-1"
              placeholder="e.g. 1.0, 2.0"
            />
            <button
              type="button"
              onClick={() => addVersionMutation.mutate()}
              disabled={!newVersionName.trim() || addVersionMutation.isPending}
              className="btn-primary"
            >
              Add
            </button>
          </div>
        )}
        {versions.length === 0 && !showAddVersion ? (
          <p className="text-gray-500">No versions. Add a version to attach milestones to it.</p>
        ) : (
          <ul className="space-y-2">
            {versions.map((v) => {
              const isEditingThis = editingVersionId === v.id;
              const showRowActions = canEdit && (hoveredVersionId === v.id || isEditingThis);
              return (
              <li
                key={v.id}
                className="flex items-center justify-between gap-2 py-2 border-b last:border-0 hover:bg-gray-50 rounded px-2 -mx-2"
                onMouseEnter={() => canEdit && setHoveredVersionId(v.id)}
                onMouseLeave={() => canEdit && setHoveredVersionId(null)}
                onClick={() => canEdit && !isEditingThis && setHoveredVersionId((prev) => (prev === v.id ? prev : v.id))}
              >
                {isEditingThis ? (
                  <>
                    <input
                      value={editingVersionValue}
                      onChange={(e) => setEditingVersionValue(e.target.value)}
                      className="input flex-1 max-w-xs"
                      placeholder="e.g. 1.0, 2.0"
                      aria-label="Version name"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          if (editingVersionValue.trim()) {
                            updateVersionMutation.mutate({ versionId: v.id, version: editingVersionValue.trim() });
                          }
                        }}
                        disabled={!editingVersionValue.trim() || updateVersionMutation.isPending}
                        className="btn-primary text-sm"
                      >
                        {updateVersionMutation.isPending ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVersionId(null);
                          setEditingVersionValue('');
                        }}
                        className="btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span>
                      <span className="text-gray-500 text-sm">Version </span>
                      <span className="font-medium">{v.version}</span>
                    </span>
                    {showRowActions && (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVersionId(v.id);
                            setEditingVersionValue(v.version);
                          }}
                          className="text-indigo-600 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50"
                          aria-label="Edit version"
                          title="Edit version"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteVersion({ versionId: v.id, version: v.version });
                            setConfirmDeleteProductNameTyped('');
                            setConfirmDeleteVersionTyped('');
                          }}
                          disabled={deleteVersionMutation.isPending}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Delete version
                        </button>
                      </div>
                    )}
                  </>
                )}
                {/* Version-level dependencies */}
                {!editingVersionId && (
                  <div className="ml-4 mt-2 pl-2 border-l-2 border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-1">Depends on</p>
                    {(versionDepsByVersionId[v.id] ?? []).length === 0 && addingDepVersionId !== v.id && (
                      <p className="text-sm text-gray-400">No dependencies. This version can depend on another product (and version) having a required status.</p>
                    )}
                    <ul className="space-y-1 mb-2">
                      {(versionDepsByVersionId[v.id] ?? []).map((d) => (
                        <li key={d.id} className="flex items-center gap-2 text-sm">
                          <span className="text-gray-700">
                            <strong>{d.target_product_name || d.target_product_id}</strong>
                            {d.target_product_version ? ` (v${d.target_product_version})` : ''} must have status &quot;{d.required_status}&quot;
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => deleteVersionDepMutation.mutate(d.id)}
                              disabled={deleteVersionDepMutation.isPending}
                              className="text-red-600 hover:underline text-xs"
                            >
                              Remove
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {canEdit && (
                      <>
                        {addingDepVersionId === v.id ? (
                          <div className="p-2 bg-gray-50 rounded text-sm space-y-2 max-w-md">
                            <label className="block font-medium text-gray-700">Target product</label>
                            <select
                              value={newDepTargetProductId}
                              onChange={(e) => { setNewDepTargetProductId(e.target.value); setNewDepTargetVersionId(''); }}
                              className="input w-full"
                            >
                              <option value="">Select product</option>
                              {allProducts.filter((p) => p.id !== id).map((p) => (
                                <option key={p.id} value={p.id}>{p.name} {p.version ? `(${p.version})` : ''}</option>
                              ))}
                            </select>
                            <label className="block font-medium text-gray-700">Target version (optional)</label>
                            <select
                              value={newDepTargetVersionId}
                              onChange={(e) => setNewDepTargetVersionId(e.target.value)}
                              className="input w-full"
                            >
                              <option value="">Any version</option>
                              {targetProductVersions.map((pv) => (
                                <option key={pv.id} value={pv.id}>{pv.version}</option>
                              ))}
                            </select>
                            <label className="block font-medium text-gray-700">Required status</label>
                            <input
                              value={newDepRequiredStatus}
                              onChange={(e) => setNewDepRequiredStatus(e.target.value)}
                              className="input w-full"
                              placeholder="e.g. Pricing Committee Approval, approved"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => addVersionDepMutation.mutate({
                                  source_product_version_id: v.id,
                                  target_product_id: newDepTargetProductId,
                                  target_product_version_id: newDepTargetVersionId || undefined,
                                  required_status: newDepRequiredStatus.trim(),
                                })}
                                disabled={!newDepTargetProductId || !newDepRequiredStatus.trim() || addVersionDepMutation.isPending}
                                className="btn-primary text-sm disabled:opacity-50"
                              >
                                {addVersionDepMutation.isPending ? 'Adding…' : 'Add'}
                              </button>
                              <button type="button" onClick={() => { setAddingDepVersionId(null); setNewDepTargetProductId(''); setNewDepTargetVersionId(''); setNewDepRequiredStatus(''); }} className="btn-secondary text-sm">
                                Cancel
                              </button>
                            </div>
                            {addVersionDepMutation.isError && (
                              <p className="text-red-600 text-xs">{addVersionDepMutation.error?.message}</p>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAddingDepVersionId(v.id)}
                            className="text-sm text-dhl-red hover:underline"
                          >
                            Add dependency
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Milestones */}
      <div className="card mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Milestones</h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setShowMilestoneEditor((x) => !x);
                setSelectedVersionId(null);
              }}
              className="btn-secondary text-sm"
            >
              {showMilestoneEditor ? 'Hide' : 'Add milestone'}
            </button>
          )}
        </div>
        {showMilestoneEditor && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Add to product or to a version:</p>
            <select
              value={selectedVersionId ?? ''}
              onChange={(e) => setSelectedVersionId(e.target.value || null)}
              className="input mb-2 w-full max-w-xs"
            >
              <option value="">Product (no version)</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version}
                </option>
              ))}
            </select>
            <MilestoneEditor
              productId={product.id}
              productVersionId={selectedVersionId ?? undefined}
              onSuccess={() => setShowMilestoneEditor(false)}
              onCancel={() => setShowMilestoneEditor(false)}
            />
          </div>
        )}
        <MilestonesList
          productId={id}
          milestones={milestones}
          versions={versions}
          canEdit={canEdit}
          editingMilestoneId={editingMilestoneId}
          setEditingMilestoneId={setEditingMilestoneId}
          hoveredMilestoneId={hoveredMilestoneId}
          setHoveredMilestoneId={setHoveredMilestoneId}
          confirmDeleteMilestone={confirmDeleteMilestone}
          setConfirmDeleteMilestone={setConfirmDeleteMilestone}
          onMilestoneUpdated={() => queryClient.invalidateQueries({ queryKey: ['milestones', id] })}
        />
      </div>

      {/* Double confirmation modal: type product name to request deletion */}
      {confirmRequestDeletionProductName != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-request-deletion-title"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 id="confirm-request-deletion-title" className="text-lg font-semibold text-gray-900 mb-2">
              Confirm request deletion
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              To request deletion of this product, type the product name below.
            </p>
            <p className="text-sm text-gray-500 mb-2">
              Product: <strong>{confirmRequestDeletionProductName}</strong>
            </p>
            <label className="block text-gray-700 text-sm font-medium mb-1">Type product name to confirm</label>
            <input
              type="text"
              value={confirmRequestDeletionTyped}
              onChange={(e) => setConfirmRequestDeletionTyped(e.target.value)}
              className="input mb-4"
              placeholder="Type the product name"
              aria-label="Product name"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={closeConfirmRequestDeletion} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRequestDeletion}
                disabled={!isRequestDeletionConfirmValid || requestDeletionMutation.isPending}
                className="btn-primary disabled:opacity-50 text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
              >
                {requestDeletionMutation.isPending ? 'Requesting…' : 'Request deletion'}
              </button>
            </div>
            {requestDeletionMutation.isError && (
              <p className="text-red-600 text-sm mt-2" role="alert">
                {requestDeletionMutation.error?.message ?? 'Request failed'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Confirm delete milestone */}
      {confirmDeleteMilestone && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-milestone-title"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 id="confirm-delete-milestone-title" className="text-lg font-semibold text-gray-900 mb-2">
              Delete milestone
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Delete milestone <strong>{confirmDeleteMilestone.label}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDeleteMilestone(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteMilestoneMutation.mutate(confirmDeleteMilestone.id);
                }}
                disabled={deleteMilestoneMutation.isPending}
                className="btn-primary disabled:opacity-50 text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
              >
                {deleteMilestoneMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
            {deleteMilestoneMutation.isError && (
              <p className="text-red-600 text-sm mt-2" role="alert">
                {deleteMilestoneMutation.error?.message ?? 'Delete failed'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Double confirmation modal: product name + version to delete a version */}
      {confirmDeleteVersion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-version-title"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 id="confirm-delete-version-title" className="text-lg font-semibold text-gray-900 mb-2">
              Confirm delete version
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              To permanently delete version <strong>{confirmDeleteVersion.version}</strong>, type the{' '}
              <strong>product name</strong> and the <strong>version</strong> below.
            </p>
            <label className="block text-gray-700 text-sm font-medium mb-1">Product name</label>
            <input
              type="text"
              value={confirmDeleteProductNameTyped}
              onChange={(e) => setConfirmDeleteProductNameTyped(e.target.value)}
              className="input mb-4"
              placeholder="Type the product name"
              aria-label="Product name"
            />
            <label className="block text-gray-700 text-sm font-medium mb-1">Version</label>
            <input
              type="text"
              value={confirmDeleteVersionTyped}
              onChange={(e) => setConfirmDeleteVersionTyped(e.target.value)}
              className="input mb-4"
              placeholder="Type the version"
              aria-label="Version"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={closeConfirmDeleteVersion} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteVersion}
                disabled={
                  confirmDeleteProductNameTyped.trim() !== product?.name ||
                  confirmDeleteVersionTyped.trim() !== confirmDeleteVersion.version ||
                  deleteVersionMutation.isPending
                }
                className="btn-primary disabled:opacity-50 text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
              >
                {deleteVersionMutation.isPending ? 'Deleting…' : 'Delete version'}
              </button>
            </div>
            {deleteVersionMutation.isError && (
              <p className="text-red-600 text-sm mt-2" role="alert">
                {deleteVersionMutation.error?.message ?? 'Delete failed'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MilestonesList({
  productId,
  milestones,
  versions,
  canEdit,
  editingMilestoneId,
  setEditingMilestoneId,
  hoveredMilestoneId,
  setHoveredMilestoneId,
  confirmDeleteMilestone,
  setConfirmDeleteMilestone,
  onMilestoneUpdated,
}: {
  productId: string;
  milestones: Array<{ id: string; label: string; start_date: string; end_date?: string; type: string; color: string; product_version_id?: string }>;
  versions: Array<{ id: string; version: string }>;
  canEdit: boolean;
  editingMilestoneId: string | null;
  setEditingMilestoneId: (id: string | null) => void;
  hoveredMilestoneId: string | null;
  setHoveredMilestoneId: (id: string | null) => void;
  confirmDeleteMilestone: { id: string; label: string } | null;
  setConfirmDeleteMilestone: (m: { id: string; label: string } | null) => void;
  onMilestoneUpdated: () => void;
}) {
  const byVersion = new Map<string | 'product', typeof milestones>();
  milestones.forEach((m) => {
    const key = m.product_version_id ?? 'product';
    if (!byVersion.has(key)) byVersion.set(key, []);
    byVersion.get(key)!.push(m);
  });

  const sections: Array<{ key: string; title: string; items: typeof milestones }> = [];
  if (byVersion.has('product')) {
    sections.push({ key: 'product', title: 'Product (no version)', items: byVersion.get('product')! });
  }
  versions.forEach((v) => {
    if (byVersion.has(v.id)) {
      sections.push({ key: v.id, title: `Version ${v.version}`, items: byVersion.get(v.id)! });
    }
  });

  if (milestones.length === 0) {
    return (
      <p className="text-gray-500">
        No milestones. Use &quot;Add milestone&quot; to add one (to the product or to a version).
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map(({ key, title, items }) => (
        <div
          key={key}
          className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-200 bg-white/80">
            <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
          </div>
          <ul className="divide-y divide-slate-200">
            {items.map((m) => {
              const isEditingThis = editingMilestoneId === m.id;
              const showRowActions = canEdit && (hoveredMilestoneId === m.id || isEditingThis);
              return (
              <li
                key={m.id}
                className="px-4 py-3 bg-white hover:bg-slate-50/50"
                onMouseEnter={() => canEdit && setHoveredMilestoneId(m.id)}
                onMouseLeave={() => canEdit && setHoveredMilestoneId(null)}
                onClick={() => canEdit && !isEditingThis && setHoveredMilestoneId((prev) => (prev === m.id ? prev : m.id))}
              >
                {isEditingThis ? (
                  <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                    <MilestoneEditor
                      productId={productId}
                      productVersionId={m.product_version_id ?? undefined}
                      milestone={m}
                      onSuccess={() => {
                        setEditingMilestoneId(null);
                        onMilestoneUpdated();
                      }}
                      onCancel={() => setEditingMilestoneId(null)}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-4 flex-wrap">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: m.color || '#6b7280' }}
                    />
                    <span className="font-medium text-gray-900">{m.label}</span>
                    <span className="text-sm text-gray-500">
                      {m.start_date} → {m.end_date ?? '—'}
                    </span>
                    {m.type && (
                      <span className="text-sm bg-gray-100 px-2 py-0.5 rounded">{m.type}</span>
                    )}
                    {showRowActions && (
                      <div className="flex gap-2 ml-auto" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setEditingMilestoneId(m.id)}
                          className="text-indigo-600 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50"
                          aria-label="Edit milestone"
                          title="Edit milestone"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMilestone({ id: m.id, label: m.label })}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <RequireAuth>
      <ProductDetailContent />
    </RequireAuth>
  );
}
