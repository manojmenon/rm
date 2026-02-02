'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '@/components/RequireAuth';
import { api, type Group, type Product } from '@/lib/api';

const DESCRIPTION_MIN_LENGTH = 11;

/** Products selector: dropdown (only unselected), selected as chips with X (remove) and Edit (show dropdown again). */
function ProductSelector({
  products,
  selectedIds,
  onSelectedIdsChange,
  showDropdown,
  onShowDropdownChange,
  disabled,
  placeholder = 'Select a product',
}: {
  products: Product[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  showDropdown: boolean;
  onShowDropdownChange: (show: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const available = products.filter((p) => !selectedIds.includes(p.id));
  const selectedProducts = products.filter((p) => selectedIds.includes(p.id));

  const addProduct = (id: string) => {
    onSelectedIdsChange([...selectedIds, id]);
    onShowDropdownChange(false);
  };
  const removeProduct = (id: string) => {
    onSelectedIdsChange(selectedIds.filter((x) => x !== id));
  };

  return (
    <div className="space-y-2">
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
        <div>
          <select
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (id) addProduct(id);
              e.target.value = '';
            }}
            disabled={disabled || available.length === 0}
            className="input w-full max-w-md"
            aria-label={placeholder}
          >
            <option value="">{available.length === 0 ? 'No more products to add' : placeholder}</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.version ? `(${p.version})` : ''}
              </option>
            ))}
          </select>
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
        <h1 className="text-3xl font-bold text-gray-900">Groups</h1>
        <div className="flex gap-2">
          <Link href="/roadmap" className="btn-secondary">
            Roadmap
          </Link>
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
            className="btn-primary"
          >
            {showNew ? 'Cancel' : 'New group'}
          </button>
        </div>
      </div>
      <p className="text-gray-600 mb-6">
        Create groups of products to view a Gantt chart for that set. Select multiple products and use &quot;View Gantt&quot; to see the roadmap for the group.
      </p>

      {showNew && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">New group</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-600">*</span></label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input w-full max-w-md"
                placeholder="Group name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-600">*</span></label>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className={`input w-full max-w-md ${!newDescriptionValid && newDescription.length > 0 ? 'border-red-500' : ''}`}
                placeholder="More than 10 characters"
              />
              {newDescription.length > 0 && !newDescriptionValid && (
                <p className="text-red-600 text-sm mt-1">Description must be more than 10 characters.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Products</label>
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
                  placeholder="Select a product"
                />
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => createMutation.mutate({ name: newName.trim(), description: newDescription.trim(), product_ids: newProductIds })}
                disabled={!newName.trim() || !newDescriptionValid || createMutation.isPending}
                className="btn-primary disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowNew(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
            {createMutation.isError && (
              <p className="text-red-600 text-sm">{createMutation.error?.message}</p>
            )}
          </div>
        </div>
      )}

      {loadingGroups ? (
        <p className="text-gray-500">Loading groups…</p>
      ) : groups.length === 0 ? (
        <div className="card text-center py-8 text-gray-500">
          No groups yet. Create a group to view a Gantt chart for a set of products.
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto -mx-px">
            <table className="w-full min-w-[520px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Description</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Products</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-b last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    {editingId === g.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input w-full max-w-xs"
                        placeholder="Name"
                      />
                    ) : (
                      <span className="font-medium">{g.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {editingId === g.id ? (
                      <div>
                        <input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className={`input w-full max-w-xs ${!editDescriptionValid && editDescription.length > 0 ? 'border-red-500' : ''}`}
                          placeholder="More than 10 characters"
                        />
                        {editDescription.length > 0 && !editDescriptionValid && (
                          <p className="text-red-600 text-xs mt-1">More than 10 characters required.</p>
                        )}
                      </div>
                    ) : (
                      g.description || '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
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
                            placeholder="Select a product"
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
                          className="btn-primary text-sm disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="btn-secondary text-sm">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-end">
                        <Link
                          href={`/roadmap?group_id=${g.id}`}
                          className="btn-primary text-sm"
                        >
                          View Gantt
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEdit(g)}
                          className="btn-secondary text-sm"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(g)}
                          className="btn-secondary text-sm text-red-600 hover:bg-red-50"
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete group?</h2>
            <p className="text-gray-600 text-sm mb-4">
              Delete &quot;{confirmDelete.name}&quot;? This does not delete the products, only the group.
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmDelete(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
            {deleteMutation.isError && (
              <p className="text-red-600 text-sm mt-2">{deleteMutation.error?.message}</p>
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
