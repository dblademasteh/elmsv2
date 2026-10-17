import { User } from '@/types';
import { useAuthStore } from '@/store/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    const token = useAuthStore.getState().token;
    if (token && !endpoint.startsWith('/auth/') && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // Include credentials for cookies
    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include',
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: response.statusText,
        }));
        return { error: typeof error.detail === 'string' ? error.detail : error.error || 'An error occurred' };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: 'Network error' };
    }
  }

  get<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET", ...options });
  }

  post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

// Auth endpoints
export const authApi = {
  register: (data: { email: string; full_name: string; password: string; role?: string }) =>
    api.post<User>('/auth/register', data),

  login: async (data: { email: string; password: string }): Promise<ApiResponse<{ user: User; access_token: string }>> => {
    const response = await api.post<{ access_token: string; refresh_token: string; token_type: string }>('/auth/login', data);
    if (!response.data) return { error: response.error || 'Unable to sign in' };
    const userResponse = await authApi.getCurrentUser(response.data.access_token);
    if (!userResponse.data) return { error: userResponse.error || 'Unable to load your account' };
    return { data: { user: userResponse.data, access_token: response.data.access_token } };
  },

  logout: () => api.post<{ message: string }>('/auth/logout', {}),

  getCurrentUser: (token?: string) => api.get<User>('/users/me', token ? {
    headers: { Authorization: `Bearer ${token}` },
  } : {}),

  verifyEmail: (token: string) =>
    api.post<{ message: string }>('/auth/verify-email', { token }),

  requestPasswordReset: (email: string) =>
    api.post<{ message: string }>('/auth/reset-password', { email }),

  resetPassword: (token: string, new_password: string) =>
    api.post<{ message: string }>('/auth/reset-password/confirm', { token, new_password }),
};

// Course endpoints
export const courseApi = {
  list: (params?: { skip?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.skip !== undefined) query.set('skip', String(params.skip));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    return api.get<Array<{
      id: string;
      title: string;
      slug: string;
      price_cents: number;
      currency: string;
      enrollment_count: number;
      short_description?: string | null;
      description?: string | null;
      level: string;
      rating_average: number;
    }>>(`/courses${query.size ? `?${query.toString()}` : ''}`);
  },

  get: (id: string) => api.get<{ id: string; title: string; description: string }>(`/courses/${id}`),

  create: (data: any) => api.post('/courses', data),

  update: (id: string, data: any) => api.put(`/courses/${id}`, data),

  delete: (id: string) => api.delete(`/courses/${id}`),

  enroll: (id: string) => api.post<{ message: string; enrollment: any }>(`/courses/${id}/enroll`, {}),
};
