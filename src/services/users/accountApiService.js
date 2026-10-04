import { apiRequest } from '../api/apiClient.js';

export async function getEmployees() {
  const employees = [];
  let page = 1;
  while (true) {
    const result = await apiRequest(`/api/v1/users?page=${page}&pageSize=100`, { raw: true });
    employees.push(...result.data);
    if (employees.length >= result.meta.total || result.data.length === 0) return employees;
    page += 1;
  }
}

export function createEmployee({ username, name, password }) {
  return apiRequest('/api/v1/users', {
    method: 'POST', body: { username, ...(name ? { name } : {}), password },
  });
}

export function updateEmployee(id, changes) {
  return apiRequest(`/api/v1/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes });
}

export function setEmployeePassword(id, nextPassword, ownerPassword) {
  return apiRequest(`/api/v1/users/${encodeURIComponent(id)}/password`, {
    method: 'POST', body: { ownerPassword, newPassword: nextPassword },
  });
}

export function setOwnPassword(currentPassword, nextPassword) {
  return apiRequest('/api/v1/auth/password', {
    method: 'POST', body: { currentPassword, newPassword: nextPassword },
  });
}
