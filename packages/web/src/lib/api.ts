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

  updateProfile: (data: { full_name?: string; avatar_url?: string; password?: string }) =>
    api.put<User>('/users/me', data),

  verifyEmail: (token: string) =>
    api.post<{ message: string }>('/auth/verify-email', { token }),

  requestPasswordReset: (email: string) =>
    api.post<{ message: string }>('/auth/reset-password', { email }),

  resetPassword: (token: string, new_password: string) =>
    api.post<{ message: string }>('/auth/reset-password/confirm', { token, new_password }),
};

// User management endpoints (admin only)
export const userApi = {
  list: (params?: { skip?: number; limit?: number; role?: string; is_active?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.skip !== undefined) query.set('skip', String(params.skip));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.role) query.set('role', params.role);
    if (params?.is_active !== undefined) query.set('is_active', String(params.is_active));
    const endpoint = `/users${query.size ? `?${query.toString()}` : ''}`;
    return api.get<Array<User>>(endpoint);
  },

  get: (userId: string) => api.get<User>(`/users/${userId}`),

  update: (userId: string, data: { role?: string; is_active?: boolean; is_verified?: boolean; full_name?: string }) =>
    api.put<User>(`/users/${userId}`, data),
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

  getDetail: (id: string) => api.get<{
    id: string;
    title: string;
    slug: string;
    description: string | null;
    short_description: string | null;
    price_cents: number;
    currency: string;
    level: string;
    status: string;
    cover_image_url: string | null;
    learning_objectives: string | null;
    prerequisites: string | null;
    instructor_id: string | null;
    published_at: string | null;
    is_featured: boolean;
    is_private: boolean;
    enrollment_count: number;
    completion_rate: number;
    rating_average: number;
    rating_count: number;
    created_at: string;
  }>(`/courses/${id}/detail`),

  create: (data: Partial<{ title: string; description: string; short_description: string; price_cents: number; currency: string; level: string; cover_image_url: string; learning_objectives: string; prerequisites: string; is_private: boolean; is_featured: boolean }>) =>
    api.post(`/courses`, data),

  update: (id: string, data: Record<string, unknown>) => api.put(`/courses/${id}`, data),

  archive: (id: string) => api.delete<{ message: string }>(`/courses/${id}/archive`),

  enroll: (id: string) => api.post<{ message: string; enrollment: any }>(`/courses/${id}/enroll`, {}),
};

// Enrollment endpoints
export const enrollmentApi = {
  list: (params?: { skip?: number; limit?: number; course_id?: string; enrollment_status?: string }) => {
    const query = new URLSearchParams();
    if (params?.skip !== undefined) query.set('skip', String(params.skip));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.course_id) query.set('course_id', params.course_id);
    if (params?.enrollment_status) query.set('enrollment_status', params.enrollment_status);
    return api.get<Array<{
      id: string;
      user_id: string;
      user_full_name: string;
      user_email: string;
      user_avatar_url: string | null;
      course_id: string;
      course_title: string;
      course_level: string;
      enrolled_at: string;
      progress_percent: number;
      status: string;
      completed_at: string | null;
      total_minutes: number;
      last_accessed_at: string | null;
    }>>(`/enrollments${query.size ? `?${query.toString()}` : ''}`);
  },

  getMyEnrollments: () => api.get<Array<{
    id: string;
    course_id: string;
    course_title: string;
    course_level: string;
    course_cover_image_url: string | null;
    enrolled_at: string;
    progress_percent: number;
    status: string;
    completed_at: string | null;
    total_minutes: number;
    last_accessed_at: string | null;
  }>>(`/enrollments/me`),

  enroll: (courseId: string) => api.post<{ message: string; enrollment_id: string; course_id: string }>(`/enrollments`, { course_id: courseId }),
};

// Quiz endpoints
export const quizApi = {
  getByCourse: (courseId: string) =>
    api.get<Array<{
      id: string;
      lesson_id: string;
      title: string;
      description: string | null;
      questions: Array<Record<string, unknown>>;
      time_limit_seconds: number | null;
      max_attempts: number;
      passing_grade: number;
      randomize_questions: boolean;
      show_results: boolean;
      allow_retry: boolean;
      created_at: string;
    }>>(`/courses/quizzes/course/${courseId}`),

  getByLesson: (lessonId: string) =>
    api.get<Array<{
      id: string;
      lesson_id: string;
      title: string;
      description: string | null;
      questions: Array<Record<string, unknown>>;
      time_limit_seconds: number | null;
      max_attempts: number;
      passing_grade: number;
      randomize_questions: boolean;
      show_results: boolean;
      allow_retry: boolean;
      created_at: string;
    }>>(`/courses/quizzes/lesson/${lessonId}`),

  getById: (quizId: string) =>
    api.get<{
      id: string;
      lesson_id: string;
      title: string;
      description: string | null;
      questions: Array<Record<string, unknown>>;
      time_limit_seconds: number | null;
      max_attempts: number;
      passing_grade: number;
      randomize_questions: boolean;
      show_results: boolean;
      allow_retry: boolean;
      created_at: string;
    }>(`/courses/quizzes/${quizId}`),

  create: (data: { lesson_id: string; title: string; questions: Array<Record<string, unknown>>; time_limit_seconds?: number; max_attempts?: number; passing_grade?: number }) =>
    api.post(`/courses/quizzes`, data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/courses/quizzes/${id}`, data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/courses/quizzes/${id}`),

  submitAttempt: (quizId: string, answers: Array<Record<string, unknown>>) =>
    api.post<{
      attempt_id: string;
      score: number;
      grade: number;
      passed: boolean;
      passing_grade: number;
      total_points: number;
      earned_points: number;
      feedback: string | null;
    }>(`/courses/quizzes/${quizId}/attempt`, { answers }),

  getMyAttempts: (quizId: string) =>
    api.get<Array<{
      id: string;
      quiz_id: string;
      user_id: string;
      enrollment_id: string | null;
      started_at: string;
      completed_at: string | null;
      score: number | null;
      grade: number | null;
      passed: boolean;
      answers: Array<Record<string, unknown>> | null;
      attempt_number: number;
    }>>(`/courses/quizzes/${quizId}/attempts`),
};

// Assignment endpoints
export const assignmentApi = {
  getByCourse: (courseId: string) =>
    api.get<Array<{
      id: string;
      lesson_id: string;
      title: string;
      description?: string | null;
      instructions?: string | null;
      due_date: string | null;
      max_score: number;
      max_file_size_mb: number;
      allowed_file_types: string[];
      rubric_json?: Array<Record<string, unknown>> | null;
      is_required: boolean;
      is_published: boolean;
      created_at: string;
      updated_at: string | null;
      submission_count: number;
      graded_count: number;
    }>>(`/courses/${courseId}/assignments`),

  getByLesson: (lessonId: string) =>
    api.get<Array<{
      id: string;
      lesson_id: string;
      title: string;
      description?: string | null;
      instructions?: string | null;
      due_date: string | null;
      max_score: number;
      max_file_size_mb: number;
      allowed_file_types: string[];
      rubric_json?: Array<Record<string, unknown>> | null;
      is_required: boolean;
      is_published: boolean;
      created_at: string;
      updated_at: string | null;
      submission_count: number;
      graded_count: number;
    }>>(`/courses/lessons/${lessonId}/assignments`),

  create: (data: {
    lesson_id: string;
    title: string;
    description?: string;
    instructions?: string;
    due_date?: string;
    max_score?: number;
    max_file_size_mb?: number;
    allowed_file_types?: string[];
    rubric_json?: Array<Record<string, unknown>>;
    is_required?: boolean;
    is_published?: boolean;
  }) => api.post<{
    id: string;
    lesson_id: string;
    title: string;
    description: string | null;
    instructions: string | null;
    due_date: string | null;
    max_score: number;
    max_file_size_mb: number;
    allowed_file_types: string[];
    rubric_json: Array<Record<string, unknown>> | null;
    is_required: boolean;
    is_published: boolean;
    created_at: string;
    updated_at: string | null;
    submission_count: number;
    graded_count: number;
  }>(`/courses/assignments`, data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put<{
      id: string;
      lesson_id: string;
      title: string;
      description: string | null;
      instructions: string | null;
      due_date: string | null;
      max_score: number;
      max_file_size_mb: number;
      allowed_file_types: string[];
      rubric_json: Array<Record<string, unknown>> | null;
      is_required: boolean;
      is_published: boolean;
      created_at: string;
      updated_at: string | null;
      submission_count: number;
      graded_count: number;
    }>(`/courses/assignments/${id}`, data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/courses/assignments/${id}`),

  submit: (assignmentId: string, file_url: string, file_name: string, file_size_bytes: number) =>
    api.post<{
      id: string;
      assignment_id: string;
      user_id: string;
      user_full_name: string;
      file_url: string | null;
      file_name: string | null;
      file_size_bytes: number;
      submitted_at: string | null;
      is_late: boolean;
      score: number | null;
      feedback: string | null;
      grader_id: string | null;
      grader_name: string | null;
      graded_at: string | null;
      status: string;
      max_score: number;
      score_percentage: number | null;
      created_at: string;
      updated_at: string | null;
    }>(`/courses/assignments/${assignmentId}/submit`, {
      file_url, file_name, file_size_bytes
    }),

  listSubmissions: (assignmentId: string) =>
    api.get<Array<{
      id: string;
      assignment_id: string;
      user_id: string;
      user_full_name: string;
      file_url: string | null;
      file_name: string | null;
      file_size_bytes: number;
      submitted_at: string | null;
      is_late: boolean;
      score: number | null;
      feedback: string | null;
      grader_id: string | null;
      grader_name: string | null;
      graded_at: string | null;
      status: string;
      max_score: number;
      score_percentage: number | null;
      created_at: string;
      updated_at: string | null;
    }>>(`/courses/assignments/${assignmentId}/submissions`),

  gradeSubmission: (submissionId: string, score: number, feedback?: string) =>
    api.put(`/courses/submissions/${submissionId}/grade`, { score, feedback }),

  getMySubmissions: () =>
    api.get<Array<{
      id: string;
      assignment_id: string;
      user_id: string;
      user_full_name: string;
      file_url: string | null;
      file_name: string | null;
      file_size_bytes: number;
      submitted_at: string | null;
      is_late: boolean;
      score: number | null;
      feedback: string | null;
      grader_id: string | null;
      grader_name: string | null;
      graded_at: string | null;
      status: string;
      max_score: number;
      score_percentage: number | null;
      created_at: string;
      updated_at: string | null;
    }>>(`/enrollments/my-assignments`),
};

// Lesson endpoints
export const lessonApi = {
  listByCourse: (courseId: string) =>
    api.get<Array<{
      id: string;
      course_id: string;
      title: string;
      description: string | null;
      slug: string | null;
      position: number;
      content_type: string;
      video_url: string | null;
      video_duration_seconds: number | null;
      content_json: string | null;
      duration_seconds: number | null;
      is_published: boolean;
      published_at: string | null;
      estimated_minutes: number;
      created_at: string;
    }>>(`/courses/lessons/course/${courseId}`),

  create: (data: {
    course_id: string;
    title: string;
    description?: string;
    position?: number;
    content_type?: "video" | "text" | "quiz" | "assignment" | "download";
    video_url?: string;
    duration_seconds?: number;
    estimated_minutes?: number;
  }) => api.post(`/courses/lessons`, data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/courses/lessons/${id}`, data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/courses/lessons/${id}`),
};

// Review endpoints
export const reviewApi = {
  listByCourse: (courseId: string) =>
    api.get<Array<{
      id: string;
      user_id: string;
      user_full_name: string;
      user_avatar_url: string | null;
      user_role: string;
      course_id: string;
      rating_content: number;
      rating_instructor: number;
      rating_value: number;
      average_rating: number;
      title: string | null;
      review: string | null;
      is_approved: boolean;
      is_featured: boolean;
      created_at: string;
    }>>(`/courses/${courseId}/reviews`),

  getRatingSummary: (courseId: string) =>
    api.get<{
      course_id: string;
      average_content: number;
      average_instructor: number;
      average_value: number;
      overall_average: number;
      total_reviews: number;
      rating_distribution: Record<string, number>;
    }>(`/courses/${courseId}/rating`),

  create: (courseId: string, data: {
    rating_content: number;
    rating_instructor: number;
    rating_value: number;
    title?: string;
    review?: string;
  }) => api.post(`/courses/${courseId}/reviews`, data),

  update: (reviewId: string, data: Record<string, unknown>) =>
    api.put(`/courses/reviews/${reviewId}`, data),

  delete: (reviewId: string) =>
    api.delete<{ message: string }>(`/courses/reviews/${reviewId}`),

  getMyReview: (courseId: string) =>
    api.get<{
      id: string;
      user_id: string;
      user_full_name: string;
      user_avatar_url: string | null;
      user_role: string;
      course_id: string;
      rating_content: number;
      rating_instructor: number;
      rating_value: number;
      average_rating: number;
      title: string | null;
      review: string | null;
      is_approved: boolean;
      is_featured: boolean;
      created_at: string;
    } | null>(`/courses/${courseId}/reviews/my`),
};

