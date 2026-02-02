'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Milestone } from '@/lib/api';

type DependencyEditorProps = {
  milestones: Milestone[];
  onSuccess?: () => void;
  onCancel?: () => void;
};

const DEP_TYPES = [
  { value: 'FS', label: 'Finish → Start' },
  { value: 'SS', label: 'Start → Start' },
  { value: 'FF', label: 'Finish → Finish' },
] as const;

export function DependencyEditor({ milestones, onSuccess, onCancel }: DependencyEditorProps) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [type, setType] = useState<'FS' | 'SS' | 'FF'>('FS');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () =>
      api.dependencies.create({
        source_milestone_id: sourceId,
        target_milestone_id: targetId,
        type,
      }),
    onSuccess: () => {
      milestones.forEach((m) => queryClient.invalidateQueries({ queryKey: ['milestones', m.product_id] }));
      setSourceId('');
      setTargetId('');
      onSuccess?.();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !targetId || sourceId === targetId) return;
    createMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="font-semibold text-lg">Add dependency</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">From (source)</label>
        <select
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="input"
          required
        >
          <option value="">Select milestone</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.start_date})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">To (target)</label>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="input"
          required
        >
          <option value="">Select milestone</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.start_date})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'FS' | 'SS' | 'FF')}
          className="input"
        >
          {DEP_TYPES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
          Add dependency
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
