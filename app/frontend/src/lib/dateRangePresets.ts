/**
 * Shared date range presets for Advanced filters (Audit logs, Products, etc.).
 * Preset options: Yesterday, Today, Last 2 days, Last 3 days, Last week, Last month,
 * Last quarter, Last half year, Last year, Custom.
 */

export type DateRangePreset =
  | 'yesterday'
  | 'today'
  | 'last_2_days'
  | 'last_3_days'
  | 'last_week'
  | 'last_month'
  | 'last_quarter'
  | 'last_half_year'
  | 'last_year'
  | 'custom';

export type DateRangeFilters = { dateFrom: string; dateTo: string };

const fmt = (d: Date) => d.toISOString().slice(0, 10);

/** Default preset: yesterday to today (Last 2 days). */
export const DEFAULT_DATE_RANGE_PRESET: DateRangePreset = 'last_2_days';

/** For pages that support "All time" (e.g. Products, Audit logs). Use 'all' to skip date filter. */
export type DateRangePresetOrAll = DateRangePreset | 'all';

/** Compute dateFrom and dateTo for a preset. For "custom", pass customDateFrom/customDateTo. For "all", returns empty range (no filter). */
export function getDateRangeForPreset(
  preset: DateRangePreset | DateRangePresetOrAll,
  customDateFrom?: string,
  customDateTo?: string
): DateRangeFilters {
  if (preset === 'all') {
    return { dateFrom: '', dateTo: '' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (preset === 'custom' && customDateFrom != null && customDateTo != null) {
    return { dateFrom: customDateFrom, dateTo: customDateTo };
  }
  const addDays = (d: Date, n: number) => {
    const out = new Date(d);
    out.setDate(out.getDate() + n);
    return out;
  };
  const yesterday = addDays(today, -1);
  switch (preset) {
    case 'yesterday':
      return { dateFrom: fmt(yesterday), dateTo: fmt(yesterday) };
    case 'today':
      return { dateFrom: fmt(today), dateTo: fmt(today) };
    case 'last_2_days':
      return { dateFrom: fmt(yesterday), dateTo: fmt(today) };
    case 'last_3_days':
      return { dateFrom: fmt(addDays(today, -2)), dateTo: fmt(today) };
    case 'last_week':
      return { dateFrom: fmt(addDays(today, -6)), dateTo: fmt(today) };
    case 'last_month':
      return { dateFrom: fmt(addDays(today, -29)), dateTo: fmt(today) };
    case 'last_quarter':
      return { dateFrom: fmt(addDays(today, -89)), dateTo: fmt(today) };
    case 'last_half_year':
      return { dateFrom: fmt(addDays(today, -181)), dateTo: fmt(today) };
    case 'last_year':
      return { dateFrom: fmt(addDays(today, -364)), dateTo: fmt(today) };
    default:
      return { dateFrom: fmt(yesterday), dateTo: fmt(today) };
  }
}

/** Default date range (yesterday to today). */
export function getDefaultDateRange(): DateRangeFilters {
  return getDateRangeForPreset(DEFAULT_DATE_RANGE_PRESET);
}

export const DATE_RANGE_PRESET_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'today', label: 'Today' },
  { value: 'last_2_days', label: 'Last 2 days' },
  { value: 'last_3_days', label: 'Last 3 days' },
  { value: 'last_week', label: 'Last week' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_quarter', label: 'Last quarter' },
  { value: 'last_half_year', label: 'Last half year' },
  { value: 'last_year', label: 'Last year' },
  { value: 'custom', label: 'Custom' },
];

export const DATE_RANGE_PRESET_OPTIONS_WITH_ALL: { value: DateRangePresetOrAll; label: string }[] = [
  { value: 'all', label: 'All time' },
  ...DATE_RANGE_PRESET_OPTIONS,
];
