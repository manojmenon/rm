'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { RequireAuth } from '@/components/RequireAuth';
import { api } from '@/lib/api';

function NewProductContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const [category1, setCategory1] = useState('');
  const [category2, setCategory2] = useState('');
  const [category3, setCategory3] = useState('');

  const createMutation = useMutation({
    mutationFn: (body: { name: string; version?: string; description?: string; category_1?: string; category_2?: string; category_3?: string }) =>
      api.products.create(body),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      router.push(`/products/${product.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      version: version || undefined,
      description: description || undefined,
      category_1: category1 || undefined,
      category_2: category2 || undefined,
      category_3: category3 || undefined,
    });
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">New product</h1>
      <form onSubmit={handleSubmit} className="card max-w-lg space-y-4">
        {createMutation.isError && (
          <p className="text-red-600 text-sm bg-red-50 p-2 rounded">
            {createMutation.error?.message}
          </p>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category 1</label>
          <input value={category1} onChange={(e) => setCategory1(e.target.value)} className="input" placeholder="Optional" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category 2</label>
          <input value={category2} onChange={(e) => setCategory2(e.target.value)} className="input" placeholder="Optional" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category 3</label>
          <input value={category3} onChange={(e) => setCategory3(e.target.value)} className="input" placeholder="Optional" />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
            Create
          </button>
          <Link href="/products" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NewProductPage() {
  return (
    <RequireAuth>
      <NewProductContent />
    </RequireAuth>
  );
}
