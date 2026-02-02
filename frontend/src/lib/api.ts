const API_BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const direct = localStorage.getItem('access_token');
  if (direct) return direct;
  // Fallback: read from Zustand persist storage so token is available before Providers sync
  try {
    const raw = localStorage.getItem('auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { accessToken?: string } };
    return parsed?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    const text = await res.text();
    let message = res.statusText;
    try {
      const err = JSON.parse(text) as { error?: string; message?: string; msg?: string };
      message = err?.error ?? err?.message ?? err?.msg ?? message;
    } catch {
      if (text && text.length < 200) message = text;
      else if (res.status === 502 || res.status === 500) message = 'Backend may be down. Ensure the Go server is running on port 8080 and Postgres is up.';
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export type User = { id: string; name: string; email: string; role: string; team_id?: string; direct_manager_id?: string };
export type HoldingCompany = { id: string; name: string; description?: string; created_at: string };
export type Company = { id: string; holding_company_id: string; name: string; created_at: string };
export type OrgFunction = { id: string; company_id: string; name: string; created_at: string };
export type Department = { id: string; function_id: string; name: string; created_at: string };
export type Team = { id: string; department_id: string; name: string; manager_id?: string; created_at: string };
export type UserDottedLineManager = { id: string; user_id: string; manager_id: string; manager?: User; created_at: string };
export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_entity_type?: string;
  related_entity_id?: string;
  read_at?: string;
  archived_at?: string;
  created_at: string;
};
export type ProductDeletionRequest = {
  id: string;
  product_id: string;
  requested_by: string;
  requester?: User;
  status: string;
  created_at: string;
};
export type Product = {
  id: string;
  name: string;
  version: string;
  description: string;
  owner_id?: string;
  owner?: User;
  status: string;
  lifecycle_status: string;
  category_1?: string;
  category_2?: string;
  category_3?: string;
  pending_deletion_request?: ProductDeletionRequest;
  metadata?: Record<string, unknown>;
  created_at: string;
};
export type Group = {
  id: string;
  name: string;
  description: string;
  created_by?: string;
  product_ids: string[];
  product_count: number;
  created_at: string;
};
export type ProductVersion = {
  id: string;
  product_id: string;
  version: string;
  created_at: string;
};
export type Milestone = {
  id: string;
  product_id: string;
  product_version_id?: string;
  label: string;
  start_date: string;
  end_date?: string; // optional; when set must be >= start_date
  type: string;
  color: string;
  extra?: Record<string, unknown>;
  created_at: string;
};
export type Dependency = {
  id: string;
  source_milestone_id: string;
  target_milestone_id: string;
  type: string;
  created_at: string;
};
export type ProductVersionDependency = {
  id: string;
  source_product_version_id: string;
  target_product_id: string;
  target_product_version_id?: string;
  required_status: string;
  created_at: string;
  target_product_name?: string;
  target_product_version?: string;
};
export type ProductRequest = {
  id: string;
  requested_by: string;
  requester?: User;
  name: string;
  description: string;
  status: string;
  created_at: string;
};
export type AuditLog = {
  id: string;
  timestamp: string;
  user_id?: string;
  user?: User;
  action: string;
  entity_type: string;
  entity_id: string;
  product_name?: string;
  product_version?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  trace_id: string;
};

export type ActivityLog = {
  id: string;
  timestamp: string;
  user_id?: string;
  user?: User;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  ip_address: string;
  user_agent: string;
};

export type PageResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export const api = {
  auth: {
    login: (body: { email: string; password: string }) =>
      fetchApi<{ access_token: string; refresh_token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    register: (body: { name: string; email: string; password: string }) =>
      fetchApi<{ access_token: string; refresh_token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    logout: () =>
      fetchApi<{ message: string }>('/auth/logout', { method: 'POST' }),
  },
  products: {
    list: (params?: { owner_id?: string; status?: string; lifecycle_status?: string; category_1?: string; category_2?: string; category_3?: string; group_id?: string; ungrouped_only?: boolean; date_from?: string; date_to?: string; sort_by?: string; order?: string; limit?: number; offset?: number }) => {
      const p = params ?? {};
      const q = new URLSearchParams();
      if (p.owner_id) q.set('owner_id', p.owner_id);
      if (p.status) q.set('status', p.status);
      if (p.lifecycle_status) q.set('lifecycle_status', p.lifecycle_status);
      if (p.category_1) q.set('category_1', p.category_1);
      if (p.category_2) q.set('category_2', p.category_2);
      if (p.category_3) q.set('category_3', p.category_3);
      if (p.group_id) q.set('group_id', p.group_id);
      if (p.ungrouped_only === true) q.set('ungrouped_only', 'true');
      if (p.date_from) q.set('date_from', p.date_from);
      if (p.date_to) q.set('date_to', p.date_to);
      if (p.sort_by) q.set('sort_by', p.sort_by);
      if (p.order) q.set('order', p.order);
      if (p.limit != null) q.set('limit', String(p.limit));
      if (p.offset != null) q.set('offset', String(p.offset));
      const s = q.toString();
      return fetchApi<PageResult<Product>>(`/products${s ? `?${s}` : ''}`);
    },
    get: (id: string) => fetchApi<Product>(`/products/${id}`),
    create: (body: { name: string; version?: string; description?: string; category_1?: string; category_2?: string; category_3?: string; metadata?: Record<string, unknown> }) =>
      fetchApi<Product>('/products', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<{ name: string; version: string; description: string; status: string; lifecycle_status: string; category_1: string; category_2: string; category_3: string; owner_id: string; clear_owner: boolean }>) =>
      fetchApi<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => fetchApi<void>(`/products/${id}`, { method: 'DELETE' }),
    requestDeletion: (id: string) =>
      fetchApi<ProductDeletionRequest>(`/products/${id}/request-deletion`, { method: 'POST' }),
  },
  productVersions: {
    listByProduct: (productId: string) =>
      fetchApi<ProductVersion[]>(`/products/${productId}/versions`),
    create: (body: { product_id: string; version: string }) =>
      fetchApi<ProductVersion>('/product-versions', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { version: string }) =>
      fetchApi<ProductVersion>(`/product-versions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => fetchApi<void>(`/product-versions/${id}`, { method: 'DELETE' }),
  },
  productVersionDependencies: {
    listByProductVersion: (versionId: string) =>
      fetchApi<ProductVersionDependency[]>(`/product-versions/${versionId}/dependencies`),
    create: (body: { source_product_version_id: string; target_product_id: string; target_product_version_id?: string; required_status: string }) =>
      fetchApi<ProductVersionDependency>('/product-version-dependencies', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) => fetchApi<void>(`/product-version-dependencies/${id}`, { method: 'DELETE' }),
  },
  deletionRequests: {
    list: (params?: { status?: string; from_date?: string; to_date?: string; owner_id?: string }) => {
      const p = params ?? {};
      const q = new URLSearchParams();
      if (p.status != null && p.status !== '') q.set('status', p.status);
      if (p.from_date) q.set('from_date', p.from_date);
      if (p.to_date) q.set('to_date', p.to_date);
      if (p.owner_id) q.set('owner_id', p.owner_id);
      const qs = q.toString();
      return fetchApi<ProductDeletionRequest[]>(`/product-deletion-requests${qs ? `?${qs}` : ''}`);
    },
    approve: (id: string, body: { approved: boolean }) =>
      fetchApi<ProductDeletionRequest>(`/product-deletion-requests/${id}/approve`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  milestones: {
    listByProduct: (productId: string) =>
      fetchApi<Milestone[]>(`/products/${productId}/milestones`),
    create: (body: {
      product_id: string;
      product_version_id?: string;
      label: string;
      start_date: string;
      end_date?: string;
      type?: string;
      color?: string;
      extra?: Record<string, unknown>;
    }) => fetchApi<Milestone>('/milestones', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<{ label: string; start_date: string; end_date?: string; type: string; color: string }>) =>
      fetchApi<Milestone>(`/milestones/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => fetchApi<void>(`/milestones/${id}`, { method: 'DELETE' }),
  },
  dependencies: {
    list: (params?: { product_id?: string }) => {
      const q = params?.product_id ? `?product_id=${encodeURIComponent(params.product_id)}` : '';
      return fetchApi<Dependency[]>(`/dependencies${q}`);
    },
    create: (body: { source_milestone_id: string; target_milestone_id: string; type: string }) =>
      fetchApi<Dependency>('/dependencies', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) => fetchApi<void>(`/dependencies/${id}`, { method: 'DELETE' }),
  },
  users: {
    list: (params?: { team_id?: string; direct_manager_id?: string }) => {
      const p = params ?? {};
      const q = new URLSearchParams();
      if (p.team_id) q.set('team_id', p.team_id);
      if (p.direct_manager_id) q.set('direct_manager_id', p.direct_manager_id);
      const s = q.toString();
      return fetchApi<User[]>(`/users${s ? `?${s}` : ''}`);
    },
    get: (id: string) => fetchApi<User>(`/users/${id}`),
    update: (id: string, body: { name?: string; role?: string; team_id?: string; direct_manager_id?: string }) =>
      fetchApi<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => fetchApi<void>(`/users/${id}`, { method: 'DELETE' }),
    removeFromProducts: (id: string) =>
      fetchApi<void>(`/users/${id}/remove-from-products`, { method: 'PUT' }),
    listDottedLineManagers: (id: string) => fetchApi<UserDottedLineManager[]>(`/users/${id}/dotted-line-managers`),
    addDottedLineManager: (id: string, manager_id: string) =>
      fetchApi<UserDottedLineManager>(`/users/${id}/dotted-line-managers`, { method: 'POST', body: JSON.stringify({ manager_id }) }),
    removeDottedLineManager: (id: string, managerId: string) =>
      fetchApi<void>(`/users/${id}/dotted-line-managers/${managerId}`, { method: 'DELETE' }),
  },
  holdingCompanies: {
    list: () => fetchApi<HoldingCompany[]>('/holding-companies'),
    get: (id: string) => fetchApi<HoldingCompany>(`/holding-companies/${id}`),
    create: (body: { name: string; description?: string }) =>
      fetchApi<HoldingCompany>('/holding-companies', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { name?: string; description?: string }) =>
      fetchApi<HoldingCompany>(`/holding-companies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => fetchApi<void>(`/holding-companies/${id}`, { method: 'DELETE' }),
  },
  companies: {
    list: (params?: { holding_company_id?: string }) => {
      const q = params?.holding_company_id ? `?holding_company_id=${params.holding_company_id}` : '';
      return fetchApi<Company[]>(`/companies${q}`);
    },
    get: (id: string) => fetchApi<Company>(`/companies/${id}`),
    create: (body: { holding_company_id: string; name: string }) =>
      fetchApi<Company>('/companies', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { holding_company_id?: string; name?: string }) =>
      fetchApi<Company>(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => fetchApi<void>(`/companies/${id}`, { method: 'DELETE' }),
  },
  functions: {
    list: (params?: { company_id?: string }) => {
      const q = params?.company_id ? `?company_id=${params.company_id}` : '';
      return fetchApi<OrgFunction[]>(`/functions${q}`);
    },
    get: (id: string) => fetchApi<OrgFunction>(`/functions/${id}`),
    create: (body: { company_id: string; name: string }) =>
      fetchApi<OrgFunction>('/functions', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { company_id?: string; name?: string }) =>
      fetchApi<OrgFunction>(`/functions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => fetchApi<void>(`/functions/${id}`, { method: 'DELETE' }),
  },
  departments: {
    list: (params?: { function_id?: string }) => {
      const q = params?.function_id ? `?function_id=${params.function_id}` : '';
      return fetchApi<Department[]>(`/departments${q}`);
    },
    get: (id: string) => fetchApi<Department>(`/departments/${id}`),
    create: (body: { function_id: string; name: string }) =>
      fetchApi<Department>('/departments', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { function_id?: string; name?: string }) =>
      fetchApi<Department>(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => fetchApi<void>(`/departments/${id}`, { method: 'DELETE' }),
  },
  teams: {
    list: (params?: { department_id?: string }) => {
      const q = params?.department_id ? `?department_id=${params.department_id}` : '';
      return fetchApi<Team[]>(`/teams${q}`);
    },
    get: (id: string) => fetchApi<Team>(`/teams/${id}`),
    create: (body: { department_id: string; name: string; manager_id?: string }) =>
      fetchApi<Team>('/teams', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { department_id?: string; name?: string; manager_id?: string }) =>
      fetchApi<Team>(`/teams/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => fetchApi<void>(`/teams/${id}`, { method: 'DELETE' }),
  },
  requests: {
    list: (params?: { status?: string; from_date?: string; to_date?: string; owner_id?: string }) => {
      const p = params ?? {};
      const q = new URLSearchParams();
      if (p.status != null && p.status !== '') q.set('status', p.status);
      if (p.from_date) q.set('from_date', p.from_date);
      if (p.to_date) q.set('to_date', p.to_date);
      if (p.owner_id) q.set('owner_id', p.owner_id);
      const qs = q.toString();
      return fetchApi<ProductRequest[]>(`/product-requests${qs ? `?${qs}` : ''}`);
    },
    create: (body: { name: string; description?: string }) =>
      fetchApi<ProductRequest>('/product-requests', { method: 'POST', body: JSON.stringify(body) }),
    approve: (id: string, body: { approved: boolean; owner_id?: string }) =>
      fetchApi<ProductRequest>(`/product-requests/${id}/approve`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  groups: {
    list: () => fetchApi<Group[]>('/groups'),
    get: (id: string) => fetchApi<Group>(`/groups/${id}`),
    create: (body: { name: string; description?: string; product_ids: string[] }) =>
      fetchApi<Group>('/groups', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { name?: string; description?: string; product_ids?: string[] }) =>
      fetchApi<Group>(`/groups/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => fetchApi<void>(`/groups/${id}`, { method: 'DELETE' }),
  },
  notifications: {
    list: (params?: { limit?: number; offset?: number; archived?: boolean }) => {
      const p = params ?? {};
      const q = new URLSearchParams();
      if (p.limit != null) q.set('limit', String(p.limit));
      if (p.offset != null) q.set('offset', String(p.offset));
      if (p.archived !== undefined) q.set('archived', String(p.archived));
      const s = q.toString();
      return fetchApi<{ items: Notification[]; total: number; offset: number; limit: number }>(`/notifications${s ? `?${s}` : ''}`);
    },
    unreadCount: () =>
      fetchApi<{ count: number }>('/notifications/unread-count'),
    markRead: (id: string) =>
      fetchApi<void>(`/notifications/${id}/read`, { method: 'PUT' }),
    markReadAll: () =>
      fetchApi<void>('/notifications/read-all', { method: 'PUT' }),
    archive: (id: string) =>
      fetchApi<void>(`/notifications/${id}/archive`, { method: 'PUT' }),
    delete: (id: string) =>
      fetchApi<void>(`/notifications/${id}`, { method: 'DELETE' }),
  },
  auditLogs: {
    list: (params?: { limit?: number; offset?: number; entity_type?: string; action?: string; date_from?: string; date_to?: string; sort_by?: string; order?: string; archived?: boolean }) => {
      const p = params ?? {};
      const q = new URLSearchParams();
      if (p.limit != null) q.set('limit', String(p.limit));
      if (p.offset != null) q.set('offset', String(p.offset));
      if (p.entity_type) q.set('entity_type', p.entity_type);
      if (p.action) q.set('action', p.action);
      if (p.date_from) q.set('date_from', p.date_from);
      if (p.date_to) q.set('date_to', p.date_to);
      if (p.sort_by) q.set('sort_by', p.sort_by);
      if (p.order) q.set('order', p.order);
      if (p.archived !== undefined) q.set('archived', String(p.archived));
      const s = q.toString();
      return fetchApi<PageResult<AuditLog>>(`/audit-logs${s ? `?${s}` : ''}`);
    },
    archive: (ids: string[]) =>
      fetchApi<{ archived: number }>('/audit-logs/archive', { method: 'POST', body: JSON.stringify({ ids }) }),
    deleteArchived: (ids: string[], password: string) =>
      fetchApi<{ deleted: number }>('/audit-logs/archive/delete', { method: 'POST', body: JSON.stringify({ ids, password }) }),
  },
  activityLogs: {
    list: (params?: { limit?: number; offset?: number; action?: string; date_from?: string; date_to?: string; sort_by?: string; order?: string }) => {
      const p = params ?? {};
      const q = new URLSearchParams();
      if (p.limit != null) q.set('limit', String(p.limit));
      if (p.offset != null) q.set('offset', String(p.offset));
      if (p.action) q.set('action', p.action);
      if (p.date_from) q.set('date_from', p.date_from);
      if (p.date_to) q.set('date_to', p.date_to);
      if (p.sort_by) q.set('sort_by', p.sort_by);
      if (p.order) q.set('order', p.order);
      const s = q.toString();
      return fetchApi<PageResult<ActivityLog>>(`/activity-logs${s ? `?${s}` : ''}`);
    },
  },
};
