'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '@/components/RequireAuth';
import { RequireRole } from '@/components/RequireRole';
import { useAuthStore } from '@/store/auth';
import {
  api,
  type User,
  type HoldingCompany,
  type Company,
  type OrgFunction,
  type Department,
  type Team,
} from '@/lib/api';

const ORG_TABS = ['Holding Companies', 'Companies', 'Functions', 'Departments', 'Teams'] as const;
const MAIN_TABS = ['Organization', 'Users'] as const;

function UsersPageContent() {
  const queryClient = useQueryClient();
  const [mainTab, setMainTab] = useState<(typeof MAIN_TABS)[number]>('Organization');
  const [orgTab, setOrgTab] = useState<(typeof ORG_TABS)[number]>('Holding Companies');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [formManagerId, setFormManagerId] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userTeamId, setUserTeamId] = useState('');
  const [userDirectManagerId, setUserDirectManagerId] = useState('');
  const [newDottedManagerId, setNewDottedManagerId] = useState('');
  const [filterCompanyId, setFilterCompanyId] = useState('');
  const [functionCompanyError, setFunctionCompanyError] = useState('');
  const [filterFunctionId, setFilterFunctionId] = useState('');
  const [departmentFunctionError, setDepartmentFunctionError] = useState('');
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);

  const { user: currentUser } = useAuthStore();
  const { data: holdings = [] } = useQuery({
    queryKey: ['holding-companies'],
    queryFn: () => api.holdingCompanies.list(),
  });
  const { data: companies = [] } = useQuery({
    queryKey: ['companies', formParentId || undefined],
    queryFn: () => api.companies.list(formParentId ? { holding_company_id: formParentId } : undefined),
  });
  const { data: companiesAll = [] } = useQuery({
    queryKey: ['companies', 'all'],
    queryFn: () => api.companies.list(),
    enabled: orgTab === 'Functions',
  });
  const companiesForFunctions = orgTab === 'Functions' ? companiesAll : companies;
  const { data: functions = [] } = useQuery({
    queryKey: ['functions', orgTab === 'Functions' ? filterCompanyId || undefined : formParentId || undefined],
    queryFn: () =>
      api.functions.list(
        (orgTab === 'Functions' ? filterCompanyId : formParentId)
          ? { company_id: orgTab === 'Functions' ? filterCompanyId : formParentId }
          : undefined
      ),
    enabled: orgTab === 'Functions' || orgTab === 'Departments',
  });
  const { data: functionsAllForDepts = [] } = useQuery({
    queryKey: ['functions', 'all'],
    queryFn: () => api.functions.list(),
    enabled: orgTab === 'Departments',
  });
  const functionsForDepartments = orgTab === 'Departments' ? functionsAllForDepts : functions;
  const { data: departments = [] } = useQuery({
    queryKey: ['departments', orgTab === 'Departments' ? filterFunctionId || undefined : 'all'],
    queryFn: () =>
      api.departments.list(orgTab === 'Departments' && filterFunctionId ? { function_id: filterFunctionId } : undefined),
    enabled: orgTab === 'Departments' || orgTab === 'Teams',
  });
  const { data: teamsFiltered = [] } = useQuery({
    queryKey: ['teams', formParentId || undefined],
    queryFn: () => api.teams.list(formParentId ? { department_id: formParentId } : undefined),
  });
  const { data: teamsAll = [] } = useQuery({
    queryKey: ['teams', 'all'],
    queryFn: () => api.teams.list(),
  });
  const teams = mainTab === 'Users' ? teamsAll : teamsFiltered;
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.list(),
  });
  const { data: dottedLine = [] } = useQuery({
    queryKey: ['users', editingUserId, 'dotted-line'],
    queryFn: () => api.users.listDottedLineManagers(editingUserId!),
    enabled: !!editingUserId,
  });

  const createHolding = useMutation({
    mutationFn: (body: { name: string; description?: string }) => api.holdingCompanies.create(body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['holding-companies'] }); setFormName(''); setFormDesc(''); },
  });
  const updateHolding = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; description?: string } }) => api.holdingCompanies.update(id, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['holding-companies'] }); setEditingId(null); },
  });
  const deleteHolding = useMutation({
    mutationFn: (id: string) => api.holdingCompanies.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holding-companies'] }),
  });

  const createCompany = useMutation({
    mutationFn: (body: { holding_company_id: string; name: string }) => api.companies.create(body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); setFormName(''); setFormParentId(''); },
  });
  const updateCompany = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { holding_company_id?: string; name?: string } }) => api.companies.update(id, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); setEditingId(null); },
  });
  const deleteCompany = useMutation({
    mutationFn: (id: string) => api.companies.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  });

  const createFunction = useMutation({
    mutationFn: (body: { company_id: string; name: string }) => api.functions.create(body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['functions'] }); setFormName(''); setFormParentId(''); },
  });
  const updateFunction = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { company_id?: string; name?: string } }) => api.functions.update(id, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['functions'] }); setEditingId(null); },
  });
  const deleteFunction = useMutation({
    mutationFn: (id: string) => api.functions.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['functions'] }),
  });

  const createDepartment = useMutation({
    mutationFn: (body: { function_id: string; name: string }) => api.departments.create(body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); setFormName(''); setFormParentId(''); },
  });
  const updateDepartment = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { function_id?: string; name?: string } }) => api.departments.update(id, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); setEditingId(null); },
  });
  const deleteDepartment = useMutation({
    mutationFn: (id: string) => api.departments.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });

  const createTeam = useMutation({
    mutationFn: (body: { department_id: string; name: string; manager_id?: string }) => api.teams.create(body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teams'] }); setFormName(''); setFormParentId(''); setFormManagerId(''); },
  });
  const updateTeam = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { department_id?: string; name?: string; manager_id?: string } }) => api.teams.update(id, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teams'] }); setEditingId(null); },
  });
  const deleteTeam = useMutation({
    mutationFn: (id: string) => api.teams.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { team_id?: string; direct_manager_id?: string } }) => api.users.update(id, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setEditingUserId(null); },
  });
  const addDotted = useMutation({
    mutationFn: ({ userId, managerId }: { userId: string; managerId: string }) => api.users.addDottedLineManager(userId, managerId),
    onSuccess: (_, v) => { queryClient.invalidateQueries({ queryKey: ['users', v.userId, 'dotted-line'] }); setNewDottedManagerId(''); },
  });
  const removeDotted = useMutation({
    mutationFn: ({ userId, managerId }: { userId: string; managerId: string }) => api.users.removeDottedLineManager(userId, managerId),
    onSuccess: (_, v) => queryClient.invalidateQueries({ queryKey: ['users', v.userId, 'dotted-line'] }),
  });
  const removeFromProducts = useMutation({
    mutationFn: (userId: string) => api.users.removeFromProducts(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
  const deleteUser = useMutation({
    mutationFn: (userId: string) => api.users.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setConfirmDeleteUserId(null);
      setEditingUserId(null);
    },
  });

  const startEditHolding = (h: HoldingCompany) => {
    setEditingId(h.id);
    setFormName(h.name);
    setFormDesc(h.description ?? '');
  };
  const startEditCompany = (c: Company) => {
    setEditingId(c.id);
    setFormName(c.name);
    setFormParentId(c.holding_company_id);
  };
  const startEditFunction = (f: OrgFunction) => {
    setEditingId(f.id);
    setFormName(f.name);
    setFormParentId(f.company_id);
    setFunctionCompanyError('');
  };
  const startEditDepartment = (d: Department) => {
    setEditingId(d.id);
    setFormName(d.name);
    setFormParentId(d.function_id);
    setDepartmentFunctionError('');
  };
  const startEditTeam = (t: Team) => {
    setEditingId(t.id);
    setFormName(t.name);
    setFormParentId(t.department_id);
    setFormManagerId(t.manager_id ?? '');
  };
  const startEditUser = (u: User) => {
    setEditingUserId(u.id);
    setUserTeamId(u.team_id ?? '');
    setUserDirectManagerId(u.direct_manager_id ?? '');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Users &amp; Organization</h1>
        <Link href="/admin" className="btn-secondary">Back to Admin</Link>
      </div>
      <p className="text-gray-600 mb-4">
        Define the organization (Holding → Companies → Functions → Departments → Teams) and assign users to teams, direct managers, and dotted-line managers. Manager hierarchy is up to 10 levels.
      </p>

      <div className="flex border-b border-gray-200 mb-4">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMainTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${mainTab === tab ? 'border-dhl-red text-dhl-red' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {mainTab === 'Organization' && (
        <>
          <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-2 mb-4">
            {ORG_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setOrgTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${orgTab === tab ? 'bg-dhl-red text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {orgTab === 'Holding Companies' && (
            <div className="card">
              <h3 className="font-semibold mb-3">Holding Companies</h3>
              {!editingId ? (
                <form
                  className="flex flex-wrap gap-2 mb-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (formName.trim()) createHolding.mutate({ name: formName.trim(), description: formDesc || undefined });
                  }}
                >
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input flex-1 min-w-[200px]" placeholder="Name" />
                  <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="input flex-1 min-w-[200px]" placeholder="Description (optional)" />
                  <button type="submit" disabled={!formName.trim() || createHolding.isPending} className="btn-primary">Add</button>
                </form>
              ) : (
                <form
                  className="flex flex-wrap gap-2 mb-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editingId && formName.trim()) updateHolding.mutate({ id: editingId, body: { name: formName.trim(), description: formDesc || undefined } });
                  }}
                >
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input flex-1 min-w-[200px]" placeholder="Name" />
                  <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="input flex-1 min-w-[200px]" placeholder="Description" />
                  <button type="submit" disabled={!formName.trim() || updateHolding.isPending} className="btn-primary">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="btn-secondary">Cancel</button>
                </form>
              )}
              <ul className="divide-y divide-gray-100">
                {holdings.map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-2">
                    <span>{h.name} {h.description && <span className="text-gray-500 text-sm">— {h.description}</span>}</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEditHolding(h)} className="text-sm text-indigo-600 hover:underline">Edit</button>
                      <button type="button" onClick={() => deleteHolding.mutate(h.id)} disabled={deleteHolding.isPending} className="text-sm text-red-600 hover:underline">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {orgTab === 'Companies' && (
            <div className="card">
              <h3 className="font-semibold mb-3">Companies</h3>
              <label className="block text-sm text-gray-600 mb-1">Filter by Holding</label>
              <select value={formParentId} onChange={(e) => setFormParentId(e.target.value)} className="input mb-4 w-auto">
                <option value="">All</option>
                {holdings.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              {!editingId ? (
                <form
                  className="flex flex-wrap gap-2 mb-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (formName.trim() && formParentId) createCompany.mutate({ holding_company_id: formParentId, name: formName.trim() });
                  }}
                >
                  <select value={formParentId} onChange={(e) => setFormParentId(e.target.value)} className="input w-auto" required>
                    <option value="">Select holding</option>
                    {holdings.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input flex-1 min-w-[180px]" placeholder="Company name" />
                  <button type="submit" disabled={!formName.trim() || !formParentId || createCompany.isPending} className="btn-primary">Add</button>
                </form>
              ) : (
                <form
                  className="flex flex-wrap gap-2 mb-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editingId && formName.trim() && formParentId) updateCompany.mutate({ id: editingId, body: { holding_company_id: formParentId, name: formName.trim() } });
                  }}
                >
                  <select value={formParentId} onChange={(e) => setFormParentId(e.target.value)} className="input w-auto" required>
                    {holdings.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input flex-1 min-w-[180px]" placeholder="Company name" />
                  <button type="submit" disabled={!formName.trim() || !formParentId || updateCompany.isPending} className="btn-primary">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="btn-secondary">Cancel</button>
                </form>
              )}
              <ul className="divide-y divide-gray-100">
                {companies.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <span>{c.name} <span className="text-gray-500 text-sm">({holdings.find((h) => h.id === c.holding_company_id)?.name ?? c.holding_company_id})</span></span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEditCompany(c)} className="text-sm text-indigo-600 hover:underline">Edit</button>
                      <button type="button" onClick={() => deleteCompany.mutate(c.id)} disabled={deleteCompany.isPending} className="text-sm text-red-600 hover:underline">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {orgTab === 'Functions' && (
            <div className="card">
              <h3 className="font-semibold mb-3">Functions</h3>
              <label className="block text-sm text-gray-600 mb-1">Filter by Company</label>
              <select value={filterCompanyId} onChange={(e) => setFilterCompanyId(e.target.value)} className="input mb-4 w-auto">
                <option value="">All</option>
                {companiesForFunctions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {companiesForFunctions.length === 0 && (
                <p className="text-amber-600 text-sm mb-3">Create at least one company in the Companies tab first.</p>
              )}
              {!editingId ? (
                <form
                  className="flex flex-wrap gap-2 mb-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setFunctionCompanyError('');
                    if (!formParentId) {
                      setFunctionCompanyError('Please select a company.');
                      return;
                    }
                    if (formName.trim()) createFunction.mutate({ company_id: formParentId, name: formName.trim() });
                  }}
                >
                  <div className="flex flex-col gap-0.5">
                    <select
                      value={formParentId}
                      onChange={(e) => { setFormParentId(e.target.value); setFunctionCompanyError(''); }}
                      className={`input w-auto ${functionCompanyError ? 'border-amber-500' : ''}`}
                      aria-invalid={!!functionCompanyError}
                      aria-describedby={functionCompanyError ? 'function-company-error' : undefined}
                    >
                      <option value="">Select company</option>
                      {companiesForFunctions.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {functionCompanyError && (
                      <span id="function-company-error" className="text-amber-600 text-sm flex items-center gap-1">
                        <span aria-hidden>!</span> {functionCompanyError}
                      </span>
                    )}
                  </div>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input flex-1 min-w-[180px]" placeholder="Function name" />
                  <button type="submit" disabled={!formName.trim() || !formParentId || companiesForFunctions.length === 0 || createFunction.isPending} className="btn-primary">Add</button>
                </form>
              ) : (
                <form
                  className="flex flex-wrap gap-2 mb-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setFunctionCompanyError('');
                    if (!formParentId) {
                      setFunctionCompanyError('Please select a company.');
                      return;
                    }
                    if (editingId && formName.trim()) updateFunction.mutate({ id: editingId, body: { company_id: formParentId, name: formName.trim() } });
                  }}
                >
                  <div className="flex flex-col gap-0.5">
                    <select
                      value={formParentId}
                      onChange={(e) => { setFormParentId(e.target.value); setFunctionCompanyError(''); }}
                      className={`input w-auto ${functionCompanyError ? 'border-amber-500' : ''}`}
                      aria-invalid={!!functionCompanyError}
                      aria-describedby={functionCompanyError ? 'function-company-error-edit' : undefined}
                    >
                      {companiesForFunctions.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {functionCompanyError && (
                      <span id="function-company-error-edit" className="text-amber-600 text-sm flex items-center gap-1">
                        <span aria-hidden>!</span> {functionCompanyError}
                      </span>
                    )}
                  </div>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input flex-1 min-w-[180px]" placeholder="Function name" />
                  <button type="submit" disabled={!formName.trim() || !formParentId || updateFunction.isPending} className="btn-primary">Save</button>
                  <button type="button" onClick={() => { setEditingId(null); setFunctionCompanyError(''); }} className="btn-secondary">Cancel</button>
                </form>
              )}
              <ul className="divide-y divide-gray-100">
                {functions.map((f) => (
                  <li key={f.id} className="flex items-center justify-between py-2">
                    <span>{f.name} <span className="text-gray-500 text-sm">({companiesForFunctions.find((c) => c.id === f.company_id)?.name ?? f.company_id})</span></span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEditFunction(f)} className="text-sm text-indigo-600 hover:underline">Edit</button>
                      <button type="button" onClick={() => deleteFunction.mutate(f.id)} disabled={deleteFunction.isPending} className="text-sm text-red-600 hover:underline">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {orgTab === 'Departments' && (
            <div className="card">
              <h3 className="font-semibold mb-3">Departments</h3>
              <label className="block text-sm text-gray-600 mb-1">Filter by Function</label>
              <select value={filterFunctionId} onChange={(e) => setFilterFunctionId(e.target.value)} className="input mb-4 w-auto">
                <option value="">All</option>
                {functionsForDepartments.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {functionsForDepartments.length === 0 && (
                <p className="text-amber-600 text-sm mb-3">Create at least one function in the Functions tab first.</p>
              )}
              {!editingId ? (
                <form
                  className="flex flex-wrap gap-2 mb-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setDepartmentFunctionError('');
                    if (!formParentId) {
                      setDepartmentFunctionError('Please select a function.');
                      return;
                    }
                    if (formName.trim()) createDepartment.mutate({ function_id: formParentId, name: formName.trim() });
                  }}
                >
                  <div className="flex flex-col gap-0.5">
                    <select
                      value={formParentId}
                      onChange={(e) => { setFormParentId(e.target.value); setDepartmentFunctionError(''); }}
                      className={`input w-auto ${departmentFunctionError ? 'border-amber-500' : ''}`}
                      aria-invalid={!!departmentFunctionError}
                      aria-describedby={departmentFunctionError ? 'department-function-error' : undefined}
                    >
                      <option value="">Select function</option>
                      {functionsForDepartments.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    {departmentFunctionError && (
                      <span id="department-function-error" className="text-amber-600 text-sm flex items-center gap-1">
                        <span aria-hidden>!</span> {departmentFunctionError}
                      </span>
                    )}
                  </div>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input flex-1 min-w-[180px]" placeholder="Department name" />
                  <button type="submit" disabled={!formName.trim() || !formParentId || functionsForDepartments.length === 0 || createDepartment.isPending} className="btn-primary">Add</button>
                </form>
              ) : (
                <form
                  className="flex flex-wrap gap-2 mb-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setDepartmentFunctionError('');
                    if (!formParentId) {
                      setDepartmentFunctionError('Please select a function.');
                      return;
                    }
                    if (editingId && formName.trim()) updateDepartment.mutate({ id: editingId, body: { function_id: formParentId, name: formName.trim() } });
                  }}
                >
                  <div className="flex flex-col gap-0.5">
                    <select
                      value={formParentId}
                      onChange={(e) => { setFormParentId(e.target.value); setDepartmentFunctionError(''); }}
                      className={`input w-auto ${departmentFunctionError ? 'border-amber-500' : ''}`}
                      aria-invalid={!!departmentFunctionError}
                      aria-describedby={departmentFunctionError ? 'department-function-error-edit' : undefined}
                    >
                      {functionsForDepartments.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    {departmentFunctionError && (
                      <span id="department-function-error-edit" className="text-amber-600 text-sm flex items-center gap-1">
                        <span aria-hidden>!</span> {departmentFunctionError}
                      </span>
                    )}
                  </div>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input flex-1 min-w-[180px]" placeholder="Department name" />
                  <button type="submit" disabled={!formName.trim() || !formParentId || updateDepartment.isPending} className="btn-primary">Save</button>
                  <button type="button" onClick={() => { setEditingId(null); setDepartmentFunctionError(''); }} className="btn-secondary">Cancel</button>
                </form>
              )}
              <ul className="divide-y divide-gray-100">
                {departments.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2">
                    <span>{d.name} <span className="text-gray-500 text-sm">({functionsForDepartments.find((f) => f.id === d.function_id)?.name ?? d.function_id})</span></span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEditDepartment(d)} className="text-sm text-indigo-600 hover:underline">Edit</button>
                      <button type="button" onClick={() => deleteDepartment.mutate(d.id)} disabled={deleteDepartment.isPending} className="text-sm text-red-600 hover:underline">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {orgTab === 'Teams' && (
            <div className="card">
              <h3 className="font-semibold mb-3">Teams</h3>
              <label className="block text-sm text-gray-600 mb-1">Filter by Department</label>
              <select value={formParentId} onChange={(e) => setFormParentId(e.target.value)} className="input mb-4 w-auto">
                <option value="">All</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {!editingId ? (
                <form
                  className="flex flex-wrap gap-2 mb-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (formName.trim() && formParentId) createTeam.mutate({ department_id: formParentId, name: formName.trim(), manager_id: formManagerId || undefined });
                  }}
                >
                  <select value={formParentId} onChange={(e) => setFormParentId(e.target.value)} className="input w-auto" required>
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input flex-1 min-w-[180px]" placeholder="Team name" />
                  <select value={formManagerId} onChange={(e) => setFormManagerId(e.target.value)} className="input w-auto">
                    <option value="">No manager</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <button type="submit" disabled={!formName.trim() || !formParentId || createTeam.isPending} className="btn-primary">Add</button>
                </form>
              ) : (
                <form
                  className="flex flex-wrap gap-2 mb-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editingId && formName.trim() && formParentId) updateTeam.mutate({ id: editingId, body: { department_id: formParentId, name: formName.trim(), manager_id: formManagerId || undefined } });
                  }}
                >
                  <select value={formParentId} onChange={(e) => setFormParentId(e.target.value)} className="input w-auto" required>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input flex-1 min-w-[180px]" placeholder="Team name" />
                  <select value={formManagerId} onChange={(e) => setFormManagerId(e.target.value)} className="input w-auto">
                    <option value="">No manager</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <button type="submit" disabled={!formName.trim() || !formParentId || updateTeam.isPending} className="btn-primary">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="btn-secondary">Cancel</button>
                </form>
              )}
              <ul className="divide-y divide-gray-100">
                {teams.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2">
                    <span>{t.name} <span className="text-gray-500 text-sm">({departments.find((d) => d.id === t.department_id)?.name ?? t.department_id})</span> {t.manager_id && <span className="text-gray-500 text-sm">— Manager: {users.find((u) => u.id === t.manager_id)?.name ?? t.manager_id}</span>}</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEditTeam(t)} className="text-sm text-indigo-600 hover:underline">Edit</button>
                      <button type="button" onClick={() => deleteTeam.mutate(t.id)} disabled={deleteTeam.isPending} className="text-sm text-red-600 hover:underline">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {mainTab === 'Users' && (
        <div className="rounded-xl border-2 border-dhl-red/30 bg-white shadow-sm overflow-hidden">
          <h3 className="font-semibold mb-3 px-4 pt-4 text-dhl-red">Users</h3>
          <p className="text-sm text-gray-600 mb-4 px-4">Assign team, direct manager (one), and dotted-line managers (multiple). Manager hierarchy is up to 10 levels.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-dhl-yellow/25 border-b-2 border-dhl-red/40">
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-dhl-red">Name</th>
                  <th className="text-left py-2 px-3 font-medium text-dhl-red">Email</th>
                  <th className="text-left py-2 px-3 font-medium text-dhl-red">Role</th>
                  <th className="text-left py-2 px-3 font-medium text-dhl-red">Team</th>
                  <th className="text-left py-2 px-3 font-medium text-dhl-red">Direct Manager</th>
                  <th className="text-left py-2 px-3 font-medium text-dhl-red w-20">Edit</th>
                  <th className="text-left py-2 px-3 font-medium text-dhl-red w-48">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dhl-red/20">
                {users.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  const isSuperadmin = (u.role ?? '').toLowerCase() === 'superadmin';
                  const canRemoveUser = !isSelf && !isSuperadmin;
                  return (
                    <tr key={u.id} className="hover:bg-dhl-yellow/10">
                      <td className="py-2 px-3 text-slate-800">{u.name}</td>
                      <td className="py-2 px-3 text-slate-700">{u.email}</td>
                      <td className="py-2 px-3 text-slate-700">{u.role}</td>
                      <td className="py-2 px-3 text-slate-700">{teams.find((t) => t.id === u.team_id)?.name ?? (u.team_id || '—')}</td>
                      <td className="py-2 px-3 text-slate-700">{users.find((m) => m.id === u.direct_manager_id)?.name ?? (u.direct_manager_id ? '—' : '—')}</td>
                      <td className="py-2 px-3">
                        <button type="button" onClick={() => startEditUser(u)} className="text-sm text-dhl-red hover:underline font-medium">Edit</button>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => removeFromProducts.mutate(u.id)}
                            disabled={removeFromProducts.isPending}
                            className="text-sm text-dhl-red hover:underline font-medium border border-dhl-red/50 px-2 py-1 rounded hover:bg-dhl-yellow/20 disabled:opacity-50"
                          >
                            Remove from products
                          </button>
                          {canRemoveUser ? (
                            confirmDeleteUserId === u.id ? (
                              <span className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => deleteUser.mutate(u.id)}
                                  disabled={deleteUser.isPending}
                                  className="text-sm text-white bg-dhl-red px-2 py-1 rounded hover:opacity-90 disabled:opacity-50"
                                >
                                  Confirm delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteUserId(null)}
                                  className="text-sm text-slate-600 hover:underline"
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUserId(u.id)}
                                className="text-sm text-dhl-red hover:underline font-medium"
                              >
                                Remove user
                              </button>
                            )
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {editingUserId && (
            <div className="mt-6 mx-4 mb-4 p-4 border-2 border-dhl-red/30 rounded-xl bg-dhl-yellow/10">
              <h4 className="font-medium mb-3 text-dhl-red">Edit user: {users.find((u) => u.id === editingUserId)?.name}</h4>
              <div className="grid gap-3 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Team</label>
                  <select value={userTeamId} onChange={(e) => setUserTeamId(e.target.value)} className="input w-full border-dhl-red/40 focus:ring-dhl-red focus:border-dhl-red">
                    <option value="">No team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Direct Manager (one)</label>
                  <select value={userDirectManagerId} onChange={(e) => setUserDirectManagerId(e.target.value)} className="input w-full border-dhl-red/40 focus:ring-dhl-red focus:border-dhl-red">
                    <option value="">No direct manager</option>
                    {users.filter((u) => u.id !== editingUserId).map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateUser.mutate({ id: editingUserId, body: { team_id: userTeamId || '', direct_manager_id: userDirectManagerId || '' } })}
                    disabled={updateUser.isPending}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-dhl-red hover:opacity-90 focus:ring-2 focus:ring-dhl-yellow focus:ring-offset-2"
                  >
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingUserId(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-dhl-red border-2 border-dhl-red hover:bg-dhl-yellow/20">Cancel</button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-dhl-red/30">
                <label className="block text-sm font-medium text-slate-700 mb-2">Dotted-line managers</label>
                <ul className="list-disc list-inside text-sm text-gray-600 mb-2">
                  {dottedLine.map((d) => (
                    <li key={d.id} className="flex items-center gap-2">
                      {d.manager?.name ?? d.manager_id}
                      <button type="button" onClick={() => removeDotted.mutate({ userId: editingUserId, managerId: d.manager_id })} className="text-dhl-red hover:underline font-medium">Remove</button>
                    </li>
                  ))}
                  {dottedLine.length === 0 && <li className="text-gray-500">None</li>}
                </ul>
                <div className="flex gap-2">
                  <select value={newDottedManagerId} onChange={(e) => setNewDottedManagerId(e.target.value)} className="input flex-1 max-w-xs border-dhl-red/40 focus:ring-dhl-red focus:border-dhl-red">
                    <option value="">Add dotted-line manager</option>
                    {users.filter((u) => u.id !== editingUserId && !dottedLine.some((d) => d.manager_id === u.id)).map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => newDottedManagerId && addDotted.mutate({ userId: editingUserId, managerId: newDottedManagerId })}
                    disabled={!newDottedManagerId || addDotted.isPending}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-dhl-red border-2 border-dhl-red hover:bg-dhl-yellow/20"
                  >
                    Add
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

export default function AdminUsersPage() {
  return (
    <RequireAuth>
      <RequireRole allowedRoles={['admin', 'superadmin']}>
        <UsersPageContent />
      </RequireRole>
    </RequireAuth>
  );
}
