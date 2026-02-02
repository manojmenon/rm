'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Milestone } from '@/lib/api';

function parseDate(s: string): string {
  if (!s) return '';
  try {
    const d = new Date(s);
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

type MilestoneEditorProps = {
  productId: string;
  productVersionId?: string;
  /** When set, editor is in edit mode: prefill and call update instead of create */
  milestone?: Milestone | null;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function MilestoneEditor({ productId, productVersionId, milestone, onSuccess, onCancel }: MilestoneEditorProps) {
  const isEdit = Boolean(milestone?.id);
  const [label, setLabel] = useState(milestone?.label ?? '');
  const [startDate, setStartDate] = useState(parseDate(milestone?.start_date ?? ''));
  const [endDate, setEndDate] = useState(parseDate(milestone?.end_date ?? ''));
  const [type, setType] = useState(milestone?.type ?? '');
  const [color, setColor] = useState(milestone?.color || '#3b82f6');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (milestone) {
      setLabel(milestone.label ?? '');
      setStartDate(parseDate(milestone.start_date ?? ''));
      setEndDate(parseDate(milestone.end_date ?? ''));
      setType(milestone.type ?? '');
      setColor(milestone.color || '#3b82f6');
    }
  }, [milestone]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.milestones.create({
        product_id: productId,
        product_version_id: productVersionId,
        label,
        start_date: startDate ? `${startDate}T00:00:00Z` : '',
        ...(endDate && { end_date: `${endDate}T23:59:59Z` }),
        type: type || undefined,
        color: color || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', productId] });
      setLabel('');
      setStartDate('');
      setEndDate('');
      onSuccess?.();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.milestones.update(milestone!.id, {
        label,
        start_date: startDate ? `${startDate}T00:00:00Z` : '',
        ...(endDate && { end_date: `${endDate}T23:59:59Z` }),
        type: type || undefined,
        color: color || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones', productId] });
      onSuccess?.();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !startDate) return;
    if (endDate && startDate && endDate < startDate) return; // end must be >= start
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  const endBeforeStart = Boolean(endDate && startDate && endDate < startDate);

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="font-semibold text-lg">{isEdit ? 'Edit milestone' : 'Add milestone'}</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="input"
          placeholder="e.g. Alpha, GA"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End date (optional)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input"
            min={startDate || undefined}
          />
          {endBeforeStart && (
            <p className="text-sm text-red-600 mt-1">End date must be on or after start date.</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="input"
            placeholder="alpha, beta, ga, support"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="input h-10 p-1"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending || endBeforeStart}>
          {isEdit ? 'Save changes' : 'Add milestone'}
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
