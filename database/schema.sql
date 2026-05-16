-- Nalanda Training & Development PostgreSQL schema
-- Designed for RBAC, immutable audit history, course versioning, strict assessments, and reporting.
-- Updated: includes login security, session versioning, certificates, archive, and Super Admin role.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role AS ENUM ('Super Admin', 'Admin', 'Manager', 'Employee');
CREATE TYPE lifecycle_status AS ENUM ('Active', 'Inactive');
CREATE TYPE approval_status AS ENUM ('Draft', 'Pending', 'Approved', 'Rejected');
CREATE TYPE assessment_type AS ENUM ('MCQ', 'Descriptive', 'Timed Quiz');
CREATE TYPE attempt_status AS ENUM ('InProgress', 'Submitted', 'AutoSubmitted', 'PendingManualReview', 'Evaluated');
CREATE TYPE proctor_event_type AS ENUM ('FULLSCREEN_EXIT', 'TAB_SWITCH', 'NOISE', 'CAMERA_OFF', 'MIC_OFF', 'FACE_MISMATCH');

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role user_role NOT NULL DEFAULT 'Employee',
  department_id UUID REFERENCES departments(id),
  team TEXT NOT NULL DEFAULT 'Unassigned',
  designation TEXT NOT NULL DEFAULT 'Employee',
  manager_id TEXT REFERENCES users(id),
  status lifecycle_status NOT NULL DEFAULT 'Active',
  session_version INTEGER NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_not_self_managed CHECK (manager_id IS NULL OR manager_id <> id)
);

CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_users_manager ON users(manager_id);
CREATE INDEX idx_users_department ON users(department_id);

-- ── Login Security ──
-- Tracks failed login attempts and account lockouts per email
CREATE TABLE login_security (
  email CITEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Rate Limiting ──
-- Tracks API request timestamps for sliding-window rate limiting
CREATE TABLE rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL,
  endpoint TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_ip_endpoint ON rate_limit_log(ip_address, endpoint, requested_at DESC);

-- Periodically clean old entries (older than 5 minutes)
-- Run via pg_cron or application-level cleanup:
-- DELETE FROM rate_limit_log WHERE requested_at < now() - INTERVAL '5 minutes';

CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'Technical',
  description TEXT NOT NULL DEFAULT '',
  status lifecycle_status NOT NULL DEFAULT 'Active',
  parent_skill_id UUID REFERENCES skills(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE target_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id),
  scope TEXT NOT NULL CHECK (scope IN ('Organization', 'Department', 'Role', 'Employee')),
  department TEXT,
  designation TEXT,
  user_id TEXT REFERENCES users(id),
  target_level TEXT NOT NULL DEFAULT 'Intermediate',
  target_score INTEGER NOT NULL DEFAULT 80,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_target_skills_scope ON target_skills(scope, department);

CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  skill TEXT NOT NULL DEFAULT '',
  skill_ids TEXT[] NOT NULL DEFAULT '{}',
  target_level TEXT NOT NULL DEFAULT 'Intermediate',
  prerequisites TEXT[] NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'General',
  tags TEXT[] NOT NULL DEFAULT '{}',
  thumbnail_color TEXT NOT NULL DEFAULT '#22d3ee',
  status lifecycle_status NOT NULL DEFAULT 'Active',
  approval approval_status NOT NULL DEFAULT 'Draft',
  owner_id TEXT NOT NULL REFERENCES users(id),
  current_version INTEGER NOT NULL DEFAULT 1,
  difficulty TEXT NOT NULL DEFAULT 'Beginner',
  estimated_hours NUMERIC(5,1) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_status_approval ON courses(status, approval);
CREATE INDEX idx_courses_skill ON courses(skill);

CREATE TABLE course_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL REFERENCES courses(id),
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  change_note TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, version)
);

-- ── Chapters ──
CREATE TABLE chapters (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'Rich Text'
    CHECK (content_type IN ('Rich Text', 'PDF', 'Video Link')),
  body TEXT NOT NULL DEFAULT '',
  url TEXT,
  file_name TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chapters_course ON chapters(course_id, sequence);

CREATE TABLE course_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL REFERENCES courses(id),
  version INTEGER NOT NULL,
  requested_by TEXT NOT NULL REFERENCES users(id),
  reviewed_by TEXT REFERENCES users(id),
  status approval_status NOT NULL DEFAULT 'Pending',
  feedback TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- ── Enrollments ──
CREATE TABLE enrollments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  assigned_by TEXT NOT NULL REFERENCES users(id),
  due_at DATE,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  mandatory BOOLEAN NOT NULL DEFAULT false,
  progress NUMERIC(5,2) NOT NULL DEFAULT 0,
  completed_chapters TEXT[] NOT NULL DEFAULT '{}',
  time_spent_minutes INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(course_id, user_id)
);

CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);

CREATE TABLE assessments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  chapter_id TEXT REFERENCES chapters(id),
  title TEXT NOT NULL,
  type assessment_type NOT NULL,
  strict_mode BOOLEAN NOT NULL DEFAULT true,
  duration_minutes INTEGER NOT NULL,
  pass_score NUMERIC(5,2) NOT NULL CHECK (pass_score >= 0 AND pass_score <= 100),
  question_limit INTEGER,
  difficulty TEXT NOT NULL DEFAULT 'Beginner',
  approval approval_status NOT NULL DEFAULT 'Draft',
  status lifecycle_status NOT NULL DEFAULT 'Active',
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assessments_course ON assessments(course_id);
CREATE INDEX idx_assessments_chapter ON assessments(chapter_id);
CREATE INDEX idx_assessments_approval ON assessments(approval);
CREATE INDEX idx_assessments_status ON assessments(status);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('MCQ', 'Descriptive')),
  prompt TEXT NOT NULL,
  options JSONB,
  correct_answer JSONB,
  points NUMERIC(6,2) NOT NULL DEFAULT 10,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id TEXT NOT NULL REFERENCES assessments(id),
  chapter_id TEXT REFERENCES chapters(id),
  course_id TEXT REFERENCES courses(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status attempt_status NOT NULL DEFAULT 'InProgress',
  score NUMERIC(5,2),
  max_score NUMERIC(5,2),
  feedback TEXT,
  answers JSONB NOT NULL DEFAULT '{}',
  selected_question_ids TEXT[] NOT NULL DEFAULT '{}',
  tab_switch_warnings INTEGER NOT NULL DEFAULT 0,
  auto_submitted_reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  evaluated_by TEXT REFERENCES users(id)
);

CREATE INDEX idx_attempts_user ON assessment_attempts(user_id, started_at DESC);
CREATE INDEX idx_attempts_assessment ON assessment_attempts(assessment_id);

CREATE TABLE assessment_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  answer JSONB NOT NULL,
  auto_score NUMERIC(6,2),
  manual_score NUMERIC(6,2),
  feedback TEXT,
  UNIQUE(attempt_id, question_id)
);

-- ── Proctoring ──
CREATE TABLE proctoring_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  event_type proctor_event_type NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proctoring_attempt ON proctoring_logs(attempt_id, created_at DESC);

-- ── Proctor Captures (webcam snapshots during assessments) ──
CREATE TABLE proctor_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id TEXT NOT NULL REFERENCES assessments(id),
  course_id TEXT REFERENCES courses(id),
  chapter_id TEXT REFERENCES chapters(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  question_id UUID REFERENCES questions(id),
  image_data_url TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Chapter Feedback ──
CREATE TABLE chapter_feedbacks (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  clarity INTEGER NOT NULL CHECK (clarity BETWEEN 1 AND 5),
  relevance INTEGER NOT NULL CHECK (relevance BETWEEN 1 AND 5),
  comments TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chapter_id, user_id)
);

-- ── Skill Ratings ──
CREATE TABLE skill_ratings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  skill TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  assessments_based INTEGER NOT NULL DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'stable' CHECK (trend IN ('up', 'down', 'stable')),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, skill)
);

CREATE INDEX idx_skill_ratings_user ON skill_ratings(user_id);

-- ── Settings ──
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Reports ──
CREATE TABLE report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by TEXT NOT NULL REFERENCES users(id),
  report_type TEXT NOT NULL CHECK (report_type IN ('User', 'Team', 'Course')),
  format TEXT NOT NULL CHECK (format IN ('PDF', 'Excel')),
  filters JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'Queued',
  storage_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ── Audit Logs ──
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);

-- ── Deletion Archive ──
-- Super Admin only: stores full entity snapshots with mandatory deletion reason
CREATE TABLE deleted_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('User', 'Course', 'Assessment')),
  entity_id TEXT NOT NULL,
  entity_data JSONB NOT NULL,
  related_data JSONB NOT NULL DEFAULT '{}',
  deleted_by TEXT NOT NULL REFERENCES users(id),
  deleted_by_name TEXT NOT NULL DEFAULT '',
  deletion_comment TEXT NOT NULL CHECK (length(trim(deletion_comment)) >= 10),
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_archives_entity ON deleted_archives(entity_type, deleted_at DESC);
CREATE INDEX idx_archives_deleted_by ON deleted_archives(deleted_by);

-- ── Issued Certificates ──
-- Certificates generated by Admin/Super Admin and sent to employees
CREATE TABLE issued_certificates (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES users(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  title TEXT NOT NULL DEFAULT 'Certificate of Completion',
  template TEXT NOT NULL DEFAULT 'Executive',
  accent TEXT NOT NULL DEFAULT '#0f766e',
  duration TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  footer TEXT NOT NULL DEFAULT '',
  issued_by TEXT NOT NULL REFERENCES users(id),
  issued_by_name TEXT NOT NULL DEFAULT '',
  html_snapshot TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_certificates_employee ON issued_certificates(employee_id);
CREATE INDEX idx_certificates_course ON issued_certificates(course_id);
CREATE INDEX idx_certificates_issued_by ON issued_certificates(issued_by);

-- ── Analytics View ──
CREATE VIEW analytics_course_effectiveness AS
SELECT
  c.id AS course_id,
  c.title,
  COUNT(DISTINCT e.user_id) AS enrolled_users,
  AVG(e.progress) AS avg_completion,
  AVG(aa.score) AS avg_assessment_score
FROM courses c
LEFT JOIN enrollments e ON e.course_id = c.id
LEFT JOIN assessments a ON a.course_id = c.id
LEFT JOIN assessment_attempts aa ON aa.assessment_id = a.id
GROUP BY c.id, c.title;