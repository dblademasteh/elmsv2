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
  private refreshPromise: Promise<string | null> | null = null;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Exchange the stored refresh token for a new access token (single-flight:
   * concurrent 401s trigger only one refresh call).
   */
  private refreshTokens(): Promise<string | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) return null;

        try {
          const response = await fetch(`${this.baseUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          if (!response.ok) return null;

          const data = await response.json();
          useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
          return data.access_token as string;
        } catch {
          return null;
        }
      })().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
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

      if (response.status === 401 && !isRetry && !endpoint.startsWith('/auth/')) {
        // Access token may have expired - try one silent refresh, then retry
        const newToken = await this.refreshTokens();
        if (newToken) {
          return this.request<T>(endpoint, options, true);
        }
      }

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

  /** Multipart file upload (bypasses the JSON content-type of `request`). */
  async upload<T>(
    endpoint: string,
    formData: FormData,
    isRetry = false
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers();
    const token = useAuthStore.getState().token;
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
      });

      if (response.status === 401 && !isRetry) {
        const newToken = await this.refreshTokens();
        if (newToken) {
          return this.upload<T>(endpoint, formData, true);
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        return { error: typeof error.detail === 'string' ? error.detail : error.error || 'Upload failed' };
      }

      const data = await response.json();
      return { data };
    } catch {
      return { error: 'Network error' };
    }
  }
}

export const api = new ApiClient();

// Auth endpoints
export const authApi = {
  register: (data: { email: string; full_name: string; password: string; role?: string }) =>
    api.post<User>('/auth/register', data),

  login: async (data: { email: string; password: string }): Promise<ApiResponse<{ user: User; access_token: string; refresh_token: string }>> => {
    const response = await api.post<{ access_token: string; refresh_token: string; token_type: string }>('/auth/login', data);
    if (!response.data) return { error: response.error || 'Unable to sign in' };
    const userResponse = await authApi.getCurrentUser(response.data.access_token);
    if (!userResponse.data) return { error: userResponse.error || 'Unable to load your account' };
    return {
      data: {
        user: userResponse.data,
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
      },
    };
  },

  logout: () => api.post<{ message: string }>('/auth/logout', {}),

  getCurrentUser: (token?: string) => api.get<User>('/users/me', token ? {
    headers: { Authorization: `Bearer ${token}` },
  } : {}),

  updateProfile: (data: { full_name?: string; avatar_url?: string; password?: string; current_password?: string }) =>
    api.put<User>('/users/me', data),

  requestPasswordReset: (email: string) =>
    api.post<{ message: string; reset_token?: string }>('/auth/reset-password', { email }),

  resetPassword: (token: string, new_password: string) =>
    api.post<{ message: string }>('/auth/reset-password/confirm', { token, new_password }),

  /**
   * The seeded demo accounts, for the login page's "quick access" panel.
   *
   * The endpoint only answers in development, so the credentials never
   * reach a deployed instance and are never part of this bundle.
   */
  demoAccounts: () =>
    api.get<Array<{ role: string; email: string; password: string }>>('/auth/demo-accounts'),
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
  list: (params?: {
    skip?: number;
    limit?: number;
    featured?: boolean;
    mine?: boolean;
    search?: string;
    level?: string;
    min_price_cents?: number;
    max_price_cents?: number;
    sort?: 'popular' | 'rating' | 'price_asc' | 'price_desc' | 'newest';
  }) => {
    const query = new URLSearchParams();
    if (params?.skip !== undefined) query.set('skip', String(params.skip));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.featured !== undefined) query.set('featured', String(params.featured));
    if (params?.mine !== undefined) query.set('mine', String(params.mine));
    if (params?.search) query.set('search', params.search);
    if (params?.level) query.set('level', params.level);
    if (params?.min_price_cents !== undefined) query.set('min_price_cents', String(params.min_price_cents));
    if (params?.max_price_cents !== undefined) query.set('max_price_cents', String(params.max_price_cents));
    if (params?.sort) query.set('sort', params.sort);
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
      cover_image_url?: string | null;
      is_featured?: boolean;
      instructor_name?: string | null;
      status?: string;
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
export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  user_full_name?: string | null;
  enrollment_id: string | null;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  grade: number | null;
  passed: boolean;
  answers: Array<Record<string, unknown>> | null;
  attempt_number: number;
  needs_review: boolean;
  graded_by: string | null;
  graded_at: string | null;
  feedback: string | null;
}

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
      quiz_type: string;
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
      quiz_type: string;
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
      quiz_type: string;
      randomize_questions: boolean;
      show_results: boolean;
      allow_retry: boolean;
      created_at: string;
    }>(`/courses/quizzes/${quizId}`),

  create: (data: { lesson_id: string; title: string; questions: Array<Record<string, unknown>>; description?: string; time_limit_seconds?: number; max_attempts?: number; passing_grade?: number; quiz_type?: string; randomize_questions?: boolean; show_results?: boolean; allow_retry?: boolean }) =>
    api.post(`/courses/quizzes`, data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/courses/quizzes/${id}`, data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/courses/quizzes/${id}`),

  startAttempt: (quizId: string) =>
    api.post<{
      attempt_id: string;
      attempt_number: number;
      started_at: string;
      time_limit_seconds: number | null;
      remaining_seconds: number | null;
      max_attempts: number;
      attempts_used: number;
    }>(`/courses/quizzes/${quizId}/start`, {}),

  submitAttempt: (quizId: string, answers: Array<Record<string, unknown>>, attemptId?: string | null) =>
    api.post<{
      attempt_id: string;
      score: number | null;
      grade: number | null;
      passed: boolean;
      passing_grade: number;
      total_points: number;
      earned_points: number;
      feedback: string | null;
      needs_review: boolean;
      results_hidden: boolean;
    }>(`/courses/quizzes/${quizId}/attempt`, attemptId ? { answers, attempt_id: attemptId } : { answers }),

  /** Attempts for a quiz: the student's own, or every attempt for staff. */
  getAttempts: (quizId: string) =>
    api.get<Array<QuizAttempt>>(`/courses/quizzes/${quizId}/attempts`),

  /** Instructors: grade the manually graded part of an attempt. */
  gradeAttempt: (attemptId: string, points: number, feedback?: string) =>
    api.put<QuizAttempt>(`/courses/quizzes/attempts/${attemptId}/grade`, {
      points,
      feedback,
    }),
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
      section_title?: string | null;
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
    section_title?: string;
  }) => api.post(`/courses/lessons`, data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/courses/lessons/${id}`, data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/courses/lessons/${id}`),

  getProgress: (courseId: string) =>
    api.get<{
      course_id: string;
      enrollment_id: string;
      progress_percent: number;
      completed_lessons: number;
      total_lessons: number;
      completed_lesson_ids: string[];
      status: string;
      last_accessed_at: string | null;
    }>(`/courses/${courseId}/progress`),

  markComplete: (lessonId: string) =>
    api.post<{
      course_id: string;
      enrollment_id: string;
      lesson_id: string;
      progress_percent: number;
      completed_lessons: number;
      total_lessons: number;
      completed_lesson_ids: string[];
      status: string;
    }>(`/courses/lessons/${lessonId}/complete`, {}),
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

  listFeatured: (limit?: number) =>
    api.get<Array<{
      id: string;
      user_full_name: string;
      user_avatar_url: string | null;
      user_role: string;
      course_id: string;
      course_title: string;
      average_rating: number;
      title: string | null;
      review: string | null;
      created_at: string;
    }>>(`/courses/reviews/featured${limit ? `?limit=${limit}` : ''}`),
};

// File upload endpoints
export const fileApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.upload<{
      file_url: string;
      file_name: string;
      file_size_bytes: number;
      content_type: string | null;
    }>('/files/upload', formData);
  },
};

// Public platform statistics (no auth required)
export const platformApi = {
  getStats: () =>
    api.get<{
      published_courses: number;
      learners: number;
      enrollments: number;
    }>('/dashboard/platform'),
};

// Gradebook (aggregated quiz + assignment scores per enrollment)
export interface GradebookRow {
  enrollment_id: string;
  course_id: string;
  course_title: string;
  student_id: string;
  student_name: string;
  student_email: string;
  progress_percent: number;
  status: string;
  graded_quiz_count: number;
  quiz_avg_grade: number | null;
  quiz_best_grade: number | null;
  graded_assignment_count: number;
  assignment_avg_percent: number | null;
  overall_grade: number | null;
}

export const gradebookApi = {
  list: (courseId?: string) =>
    api.get<Array<GradebookRow>>(
      `/dashboard/gradebook${courseId ? `?course_id=${encodeURIComponent(courseId)}` : ''}`
    ),

  exportCsv: async (courseId?: string): Promise<ApiResponse<boolean>> => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(
        `${API_URL}/dashboard/gradebook/export${courseId ? `?course_id=${encodeURIComponent(courseId)}` : ''}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        }
      );
      if (!response.ok) return { error: 'Export failed' };
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^";]+)"?/);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = match?.[1] || 'gradebook.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      return { data: true };
    } catch {
      return { error: 'Export failed' };
    }
  },
};

// Notifications (in-app)
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string | null;
}

export const notificationApi = {
  list: (unreadOnly?: boolean) =>
    api.get<{ unread_count: number; notifications: Array<AppNotification> }>(
      `/notifications${unreadOnly ? '?unread_only=true' : ''}`
    ),

  markRead: (id: string) => api.post<{ message: string }>(`/notifications/${id}/read`, {}),

  markAllRead: () => api.post<{ message: string }>('/notifications/read-all', {}),
};

// Announcements
export interface Announcement {
  id: string;
  author_name: string;
  course_id: string | null;
  course_title: string | null;
  title: string;
  body: string;
  created_at: string | null;
}

export const announcementApi = {
  list: () => api.get<Array<Announcement>>('/announcements/'),

  create: (data: { title: string; body: string; course_id?: string }) =>
    api.post<{ message: string; id: string; course_id: string | null }>('/announcements/', data),

  remove: (id: string) => api.delete<{ message: string }>(`/announcements/${id}`),
};

// Discussions (course forums)
export interface DiscussionThreadRow {
  id: string;
  title: string;
  author_id: string;
  author_name: string;
  is_pinned: boolean;
  is_locked: boolean;
  reply_count: number;
  created_at: string | null;
}

export interface DiscussionThreadDetail {
  id: string;
  course_id: string;
  title: string;
  is_locked: boolean;
  is_pinned: boolean;
  created_at: string | null;
  posts: Array<{
    id: string;
    author_id: string;
    author_name: string;
    author_role: string;
    body: string;
    created_at: string | null;
  }>;
}

export const discussionApi = {
  list: (courseId: string) =>
    api.get<Array<DiscussionThreadRow>>(`/discussions/course/${courseId}`),

  create: (courseId: string, data: { title: string; body: string; lesson_id?: string }) =>
    api.post<{ message: string; id: string }>(`/discussions/course/${courseId}`, data),

  get: (threadId: string) =>
    api.get<DiscussionThreadDetail>(`/discussions/${threadId}`),

  reply: (threadId: string, body: string) =>
    api.post<{ message: string; id: string }>(`/discussions/${threadId}/posts`, { body }),

  removeThread: (threadId: string) =>
    api.delete<{ message: string }>(`/discussions/${threadId}`),

  removePost: (postId: string) =>
    api.delete<{ message: string }>(`/discussions/posts/${postId}`),
};

// Dashboard statistics
export const dashboardApi = {
  getStats: () =>
    api.get<{
      role: string;
      // admin
      total_users?: number;
      active_users?: number;
      total_courses?: number;
      published_courses?: number;
      total_enrollments?: number;
      completed_enrollments?: number;
      avg_progress?: number;
      revenue_cents?: number;
      // instructor
      students_taught?: number;
      avg_rating?: number;
      pending_submissions?: number;
      // student
      enrolled_courses?: number;
      completed_courses?: number;
      hours_learned?: number;
      pending_assignments?: number;
    }>('/dashboard/stats'),
};
