import { getToken, clearAuth } from './auth-storage';

function handleUnauthorized() {
  if (typeof window === 'undefined') return;
  clearAuth();
  window.location.href = '/auth/login';
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

// -- Tenant bridge --
// Stores the resolved company ID for cross-origin deployments where the backend
// cannot read the tenant's custom domain from the Host header.
// NEXT_PUBLIC_COMPANY_ID can be set per-deployment (e.g. Vercel project env vars)
// so tenant deployments on *.vercel.app URLs still send the correct X-Company-ID.
let _tenantId: string | null = process.env.NEXT_PUBLIC_COMPANY_ID || null;
export function setTenantId(id: string | null) { _tenantId = id; }
export function getTenantId(): string | null { return _tenantId; }

/** Resolve a backend-relative image path (e.g. /uploads/properties/x.jpg) to a full URL */
export function getImageUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// In the browser, route all API calls through the Next.js rewrite proxy
// (/api/:path* → backend) to avoid CORS preflight entirely.
// In SSR/SSG contexts and local dev, use the absolute backend URL directly.
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && !API_BASE_URL.includes('localhost')) {
    return '/api/v1';
  }
  return `${API_BASE_URL}/api/v1`;
}

/**
 * Build a full API URL that goes through the Next.js proxy in the browser
 * (avoids CORS) and directly to the backend in SSR/dev.
 * path should start with '/', e.g. '/auth/register'
 */
export function apiUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}

export const api = {
  get baseUrl() { return getApiBaseUrl(); },

  getHeaders(): HeadersInit {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(_tenantId ? { 'X-Company-ID': _tenantId } : {}),
    };
  },

  getAuthHeaders(): HeadersInit {
    const token = getToken();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(_tenantId ? { 'X-Company-ID': _tenantId } : {}),
    };
  },

  async get<T = any>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (response.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }
    return response.json();
  },

  async post<T = any>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    if (response.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }
    return response.json();
  },

  async put<T = any>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    if (response.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }
    return response.json();
  },

  async patch<T = any>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    if (response.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }
    return response.json();
  },

  async delete<T = any>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (response.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }
    return response.json();
  },

  async postForm<T = any>(endpoint: string, formData: FormData): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });
    if (response.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }
    return response.json();
  },

  async uploadFiles(endpoint: string, files: File[], fieldName = 'files'): Promise<string[]> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append(fieldName, file);
    });

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    if (response.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.message || 'Upload failed');
    }

    const result = await response.json();
    // Unwrap TransformInterceptor { success, data: { urls }, timestamp }
    const inner = result?.data || result;
    return inner?.urls || inner;
  },
};
