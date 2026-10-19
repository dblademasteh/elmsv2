import { UUID } from 'crypto';

export type Role = 'student' | 'instructor' | 'admin' | 'parent';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  avatar_url?: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description?: string;
  price_cents: number;
  currency: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  status: 'draft' | 'published' | 'archived' | 'review';
  cover_image_url?: string;
  learning_objectives: string[];
  prerequisites: string[];
  instructor_id: string;
  published_at?: string;
  is_featured: boolean;
  is_private: boolean;
  enrollment_count: number;
  completion_rate: number;
  rating_average: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  slug: string;
  position: number;
  content_type: 'video' | 'text' | 'quiz' | 'assignment' | 'download';
  video_url?: string;
  video_duration_seconds?: number;
  duration_seconds?: number;
  is_published: boolean;
  published_at?: string;
  estimated_minutes: number;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  progress_percent: number;
  status: 'active' | 'completed' | 'dropped' | 'paused';
  completed_at?: string;
  total_minutes: number;
  last_accessed_at?: string;
}

export interface Quiz {
  id: string;
  lesson_id: string;
  title: string;
  description?: string;
  time_limit_seconds?: number;
  max_attempts: number;
  passing_grade: number;
  quiz_type: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  started_at: string;
  completed_at?: string;
  score?: number;
  grade?: number;
  passed?: boolean;
  answer?: unknown;
  attempt_number: number;
}

export interface Payment {
  id: string;
  user_id: string;
  course_id: string;
  stripe_payment_intent_id: string;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'disputed';
  created_at: string;
}

export interface DiscussionThread {
  id: string;
  course_id: string;
  lesson_id?: string;
  author_id: string[];
  title: string;
  content?: string;
  is_pinned: boolean;
  is_solved: boolean;
  reply_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  thread_id: string;
  author_id: string;
  content: string;
  parent_id?: string;
  is_edited: boolean;
  edited_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  enrollment_id: string;
  issued_to: string;
  course_id: string;
  certificate_url: string;
  verification_token: string;
  issued_at: string;
  expires_at?: string;
}

export interface Review {
  id: string;
  user_id: string;
  course_id: string;
  rating: number;
  title?: string;
  review?: string;
  created_at: string;
  updated_at: string;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Component Props types
export interface CourseCardProps {
  course: Course;
  isEnrolled?: boolean;
  onEnroll?: (courseId: string) => void;
}

export interface LessonCardProps {
  lesson: Lesson;
  isActive?: boolean;
  onComplete?: (lessonId: string) => void;
}
