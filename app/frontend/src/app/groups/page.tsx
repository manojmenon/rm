'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '@/components/RequireAuth';
import { api, type Group, type Product } from '@/lib/api';

const DESCRIPTION_MIN_LENGTH = 11;

/** Checkbox icon: unchecked (empty) or checked (tick in DHL red on DHL yellow background). */
function ProductCheckbox({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded border-2 w-5 h-5 transition-colors ${
        checked
          ? 'border-dhl-red bg-dhl-yellow text-dhl-red'
          : 'border-slate-300 bg-white'
      } ${disabled ? 'opacity-50' : ''}`}
      aria-hidden
    >
      {checked && (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}

/** Magnifying glass icon for search input. */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

/** Products selector: modal-style dropdown with title, search, checkboxes, Select All, Cancel & Save. */
function ProductSelector({
  products,
  selectedIds,
  onSelectedIdsChange,
  showDropdown,
  onShowDropdownChange,
  disabled,
  placeholder = 'Select products',
}: {
  products: Product[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  showDropdown: boolean;
  onShowDropdownChange: (show: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProducts = products.filter((p) => selectedIds.includes(p.id));

  const filteredProducts = searchQuery.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.version ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  const filteredIds = new Set(filteredProducts.map((p) => p.id));
  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every((p) => pendingIds.includes(p.id));

  useEffect(() => {
    if (showDropdown) {
      setPendingIds([...selectedIds]);
      setSearchQuery('');
    }
  }, [showDropdown, selectedIds]);

  const toggleProduct = (id: string) => {
    if (pendingIds.includes(id)) {
      setPendingIds(pendingIds.filter((x) => x !== id));
    } else {
      setPendingIds([...pendingIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setPendingIds(pendingIds.filter((id) => !filteredIds.has(id)));
    } else {
      const added = new Set(pendingIds);
      filteredProducts.forEach((p) => added.add(p.id));
      setPendingIds(Array.from(added));
    }
  };

  const handleSave = () => {
    onSelectedIdsChange(pendingIds);
    onShowDropdownChange(false);
    setSearchQuery('');
  };

  const handleCancel = () => {
    onShowDropdownChange(false);
    setSearchQuery('');
  };

  const removeProduct = (id: string) => {
    onSelectedIdsChange(selectedIds.filter((x) => x !== id));
  };

  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleCancel();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  return (
    <div className="space-y-2" ref={containerRef}>
      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedProducts.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm"
            >
              <span className="font-medium text-gray-800">{p.name}</span>
              <button
                type="button"
                onClick={() => removeProduct(p.id)}
                disabled={disabled}
                className="rounded p-0.5 text-red-600 hover:bg-red-100 disabled:opacity-50"
                title="Remove product"
                aria-label={`Remove ${p.name}`}
              >
                <span className="text-sm font-bold">×</span>
              </button>
              <button
                type="button"
                onClick={() => onShowDropdownChange(true)}
                disabled={disabled}
                className="rounded px-1 py-0.5 text-sm text-dhl-red hover:bg-dhl-yellow/50 disabled:opacity-50"
                title="Add or change products"
              >
                Edit
              </button>
            </span>
          ))}
        </div>
      )}
      {(showDropdown || selectedProducts.length === 0) && (
        <div className="relative w-full max-w-md">
          <button
            type="button"
            onClick={() => onShowDropdownChange(!showDropdown)}
            disabled={disabled || products.length === 0}
            className="input w-full text-left flex items-center justify-between gap-2"
            aria-expanded={showDropdown}
            aria-haspopup="dialog"
            aria-label={placeholder}
          >
            <span className={selectedProducts.length === 0 ? 'text-gray-500' : ''}>
              {selectedProducts.length === 0
                ? placeholder
                : `${selectedProducts.length} product${selectedProducts.length === 1 ? '' : 's'} selected`}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`shrink-0 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showDropdown && (
            <div
              className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl flex flex-col overflow-hidden"
              role="dialog"
              aria-labelledby="product-select-title"
            >
              <h3 id="product-select-title" className="text-base font-semibold text-gray-900 px-4 pt-4 pb-2">
                Select
              </h3>
              <div className="px-4 pb-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <SearchIcon />
                  </span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search"
                    className="input w-full text-sm pl-9 pr-3"
                    aria-label="Search products"
                    autoFocus
                  />
                </div>
              </div>
              <ul className="overflow-y-auto border-t border-slate-100 py-1 max-h-64 flex-1 min-h-0" role="listbox">
                {filteredProducts.length === 0 ? (
                  <li className="px-4 py-6 text-sm text-gray-500 text-center">
                    {searchQuery.trim() ? 'No products match your search.' : 'No products.'}
                  </li>
                ) : (
                  filteredProducts.map((p) => {
                    const isSelected = pendingIds.includes(p.id);
                    return (
                      <li
                        key={p.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => !disabled && toggleProduct(p.id)}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm select-none ${
                          isSelected ? 'bg-dhl-yellow/20' : 'hover:bg-slate-50'
                        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <ProductCheckbox checked={isSelected} disabled={disabled} />
                        <span className="font-medium text-gray-800">{p.name}</span>
                        {p.version && (
                          <span className="text-gray-500 ml-auto">({p.version})</span>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/80">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={allFilteredSelected}
                  onClick={() => !disabled && filteredProducts.length > 0 && toggleSelectAll()}
                  disabled={disabled || filteredProducts.length === 0}
                  className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-dhl-red focus:ring-offset-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ProductCheckbox
                    checked={allFilteredSelected}
                    disabled={disabled || filteredProducts.length === 0}
                  />
                  Select All
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={disabled}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={disabled}
                    className="px-4 py-2 text-sm font-medium text-white bg-dhl-red border border-dhl-red rounded-lg hover:opacity-90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-dhl-red focus:ring-offset-1"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupsContent() {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newProductIds, setNewProductIds] = useState<string[]>([]);
  const [newShowProductDropdown, setNewShowProductDropdown] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editProductIds, setEditProductIds] = useState<string[]>([]);
  const [editShowProductDropdown, setEditShowProductDropdown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Group | null>(null);

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.groups.list(),
    staleTime: 60 * 1000,
  });
  const { data: productsResult } = useQuery({
    queryKey: ['products', { limit: 200 }],
    queryFn: () => api.products.list({ limit: 200, offset: 0 }),
    staleTime: 60 * 1000,
  });
  const products = productsResult?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description?: string; product_ids: string[] }) =>
      api.groups.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowNew(false);
      setNewName('');
      setNewDescription('');
      setNewProductIds([]);
      setNewShowProductDropdown(true);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; description?: string; product_ids?: string[] } }) =>
      api.groups.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setEditingId(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.groups.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setConfirmDelete(null);
    },
  });

  const openEdit = (g: Group) => {
    setEditingId(g.id);
    setEditName(g.name);
    setEditDescription(g.description ?? '');
    setEditProductIds(g.product_ids ?? []);
    setEditShowProductDropdown((g.product_ids?.length ?? 0) === 0);
  };

  const newDescriptionValid = newDescription.trim().length >= DESCRIPTION_MIN_LENGTH;
  const editDescriptionValid = editDescription.trim().length >= DESCRIPTION_MIN_LENGTH;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Groups</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (showNew) {
                setShowNew(false);
              } else {
                setNewShowProductDropdown(true);
                setShowNew(true);
              }
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-dhl-red hover:opacity-90 focus:ring-2 focus:ring-dhl-yellow focus:ring-offset-2"
          >
            {showNew ? 'Cancel' : 'New group'}
          </button>
        </div>
      </div>
      <p className="text-slate-600 mb-6">
        Create groups of products to view a Gantt chart for that set. Select multiple products and use &quot;View Gantt&quot; to see the roadmap for the group.
      </p>

      {showNew && (
        <div className="rounded-xl border-2 border-dhl-red/30 bg-white shadow-sm p-6 mb-6">
          <h2 className="font-semibold mb-4 text-dhl-red">New group</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-dhl-red">*</span></label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input w-full max-w-md border-dhl-red/40 focus:ring-dhl-red focus:border-dhl-red"
                placeholder="Group name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-dhl-red">*</span></label>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className={`input w-full max-w-md border-dhl-red/40 focus:ring-dhl-red focus:border-dhl-red ${!newDescriptionValid && newDescription.length > 0 ? 'border-red-500' : ''}`}
                placeholder="More than 10 characters"
              />
              {newDescription.length > 0 && !newDescriptionValid && (
                <p className="text-dhl-red text-sm mt-1">Description must be more than 10 characters.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Products</label>
              {products.length === 0 ? (
                <p className="text-sm text-gray-500">No products yet.</p>
              ) : (
                <ProductSelector
                  products={products}
                  selectedIds={newProductIds}
                  onSelectedIdsChange={setNewProductIds}
                  showDropdown={newShowProductDropdown}
                  onShowDropdownChange={setNewShowProductDropdown}
                  disabled={createMutation.isPending}
                  placeholder="Select products"
                />
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => createMutation.mutate({ name: newName.trim(), description: newDescription.trim(), product_ids: newProductIds })}
                disabled={!newName.trim() || !newDescriptionValid || createMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-dhl-red hover:opacity-90 focus:ring-2 focus:ring-dhl-yellow focus:ring-offset-2 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-dhl-red border-2 border-dhl-red hover:bg-dhl-yellow/20">
                Cancel
              </button>
            </div>
            {createMutation.isError && (
              <p className="text-dhl-red text-sm">{createMutation.error?.message}</p>
            )}
          </div>
        </div>
      )}

      {loadingGroups ? (
        <p className="text-gray-500">Loading groups…</p>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border-2 border-dhl-red/30 bg-white shadow-sm text-center py-8 text-slate-500">
          No groups yet. Create a group to view a Gantt chart for a set of products.
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dhl-red/30 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-px">
            <table className="w-full min-w-[520px]">
            <thead className="bg-dhl-yellow/25 border-b-2 border-dhl-red/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-dhl-red w-12">#</th>
                <th className="text-left px-4 py-3 font-medium text-dhl-red">Name</th>
                <th className="text-left px-4 py-3 font-medium text-dhl-red">Description</th>
                <th className="text-left px-4 py-3 font-medium text-dhl-red">Products</th>
                <th className="text-right px-4 py-3 font-medium text-dhl-red">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dhl-red/20">
              {groups.map((g, index) => (
                <tr key={g.id} className="hover:bg-dhl-yellow/10">
                  <td className="px-4 py-3 text-slate-500 tabular-nums">{index + 1}</td>
                  <td className="px-4 py-3">
                    {editingId === g.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input w-full max-w-xs border-dhl-red/40 focus:ring-dhl-red focus:border-dhl-red"
                        placeholder="Name"
                      />
                    ) : (
                      <span className="font-medium text-slate-800">{g.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {editingId === g.id ? (
                      <div>
                        <input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className={`input w-full max-w-xs border-dhl-red/40 focus:ring-dhl-red focus:border-dhl-red ${!editDescriptionValid && editDescription.length > 0 ? 'border-red-500' : ''}`}
                          placeholder="More than 10 characters"
                        />
                        {editDescription.length > 0 && !editDescriptionValid && (
                          <p className="text-dhl-red text-xs mt-1">More than 10 characters required.</p>
                        )}
                      </div>
                    ) : (
                      g.description || '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {editingId === g.id ? (
                      <div className="min-w-[200px] max-w-md">
                        {products.length === 0 ? (
                          <p className="text-xs text-gray-500">No products.</p>
                        ) : (
                          <ProductSelector
                            products={products}
                            selectedIds={editProductIds}
                            onSelectedIdsChange={setEditProductIds}
                            showDropdown={editShowProductDropdown}
                            onShowDropdownChange={setEditShowProductDropdown}
                            disabled={updateMutation.isPending}
                            placeholder="Select products"
                          />
                        )}
                      </div>
                    ) : (
                      g.product_count
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === g.id ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => updateMutation.mutate({ id: g.id, body: { name: editName.trim(), description: editDescription.trim(), product_ids: editProductIds } })}
                          disabled={!editName.trim() || !editDescriptionValid || updateMutation.isPending}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-dhl-red hover:opacity-90 focus:ring-2 focus:ring-dhl-yellow focus:ring-offset-1 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-sm font-medium text-dhl-red border-2 border-dhl-red hover:bg-dhl-yellow/20">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-end">
                        <Link
                          href={`/roadmap?group_id=${g.id}`}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-dhl-red hover:opacity-90 focus:ring-2 focus:ring-dhl-yellow focus:ring-offset-1"
                        >
                          View Gantt
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEdit(g)}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium text-dhl-red border-2 border-dhl-red hover:bg-dhl-yellow/20"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(g)}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium text-dhl-red border-2 border-dhl-red hover:bg-dhl-yellow/20"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl border-2 border-dhl-red/30 shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Delete group?</h2>
            <p className="text-slate-600 text-sm mb-4">
              Delete &quot;{confirmDelete.name}&quot;? This does not delete the products, only the group.
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-dhl-red border-2 border-dhl-red hover:bg-dhl-yellow/20">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-dhl-red hover:opacity-90 disabled:opacity-50 focus:ring-2 focus:ring-dhl-yellow focus:ring-offset-2"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
            {deleteMutation.isError && (
              <p className="text-dhl-red text-sm mt-2">{deleteMutation.error?.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GroupsPage() {
  return (
    <RequireAuth>
      <GroupsContent />
    </RequireAuth>
  );
}
