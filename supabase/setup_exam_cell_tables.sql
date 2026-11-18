-- ====================================================================
-- EXAM CELL TABLES FOR AN EXISTING SUPABASE PROJECT
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run
--
-- Only creates the tables the Exam Cell app needs and adds missing columns
-- to the existing `subjects` table. It does NOT drop, rename or change any
-- existing table or row (users, cat_questions, notifications, ... are left
-- exactly as they are). Safe to run more than once.
-- ====================================================================

-- 1. QUESTIONS (question bank + HOD -> Dean -> COE status)
CREATE TABLE IF NOT EXISTS public.questions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT,
    question TEXT NOT NULL,
    subject TEXT NOT NULL,
    unit TEXT NOT NULL,
    topic TEXT,
    type TEXT DEFAULT 'Descriptive',
    difficulty TEXT DEFAULT 'Medium',
    marks INTEGER DEFAULT 5,
    bloom_level TEXT DEFAULT 'Understand',
    status TEXT DEFAULT 'Pending',
    options JSONB,
    answer TEXT,
    explanation TEXT,
    verifier TEXT,
    verified_date TEXT,
    submitted_by TEXT,
    submitted_date TEXT,
    email TEXT,
    department TEXT,
    verified_role TEXT,
    source_file TEXT,
    uploaded_on_behalf_by TEXT,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS questions_status_idx ON public.questions (status);
CREATE INDEX IF NOT EXISTS questions_subject_idx ON public.questions (subject);

-- 2. SYLLABUS APPROVALS (Staff/HOD upload -> HOD verify -> Dean -> COE)
CREATE TABLE IF NOT EXISTS public.syllabus_approvals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    course_code TEXT,
    course_name TEXT NOT NULL,
    department TEXT,
    semester TEXT,
    submitted_by TEXT,
    submitter_email TEXT,
    uploaded_on_behalf_by TEXT,
    stage TEXT DEFAULT 'hod' CHECK (stage IN ('staff', 'hod', 'dean', 'coe')),
    status TEXT DEFAULT 'Pending',
    hod_status TEXT DEFAULT 'Pending',
    dean_status TEXT DEFAULT 'Waiting_HOD',
    coe_status TEXT DEFAULT 'Waiting_Dean',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    document_data TEXT,
    has_document BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS syllabus_approvals_stage_idx ON public.syllabus_approvals (stage, hod_status, dean_status);

CREATE OR REPLACE FUNCTION public.touch_syllabus_approvals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS syllabus_approvals_touch_updated_at ON public.syllabus_approvals;
CREATE TRIGGER syllabus_approvals_touch_updated_at
  BEFORE UPDATE ON public.syllabus_approvals
  FOR EACH ROW EXECUTE FUNCTION public.touch_syllabus_approvals_updated_at();

-- 3. SYLLABUS UNITS
CREATE TABLE IF NOT EXISTS public.syllabus_units (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    num TEXT NOT NULL,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    topics INTEGER DEFAULT 0,
    docs INTEGER DEFAULT 0,
    subtopics JSONB DEFAULT '[]'::jsonb,
    co_mapping JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. SUBJECT ALLOCATIONS (which faculty teaches which subject)
CREATE TABLE IF NOT EXISTS public.subject_allocations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    department TEXT NOT NULL,
    semester TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    faculty_name TEXT,
    faculty_id TEXT,
    status TEXT DEFAULT 'Allocated',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. FACULTY (used for the HOD "Submitting for" list)
CREATE TABLE IF NOT EXISTS public.faculty (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'STAFF',
    department TEXT NOT NULL,
    designation TEXT,
    employee_id TEXT,
    school TEXT,
    dean_name TEXT,
    dean_email TEXT,
    hod_name TEXT,
    hod_email TEXT,
    phone TEXT,
    qualification TEXT,
    experience TEXT,
    reporting_to TEXT DEFAULT 'HOD',
    reporting_officer_name TEXT,
    subjects_assigned JSONB DEFAULT '[]'::jsonb,
    assigned_syllabus JSONB DEFAULT '[]'::jsonb,
    syllabus_count INTEGER DEFAULT 0,
    questions_contributed INTEGER DEFAULT 0,
    pending_reviews INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Active',
    avatar_bg TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. EXISTING `subjects` TABLE: add only the counters the app writes.
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS total_questions INTEGER DEFAULT 0;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS approved INTEGER DEFAULT 0;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS pending INTEGER DEFAULT 0;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS verified INTEGER DEFAULT 0;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

-- 7. Frontend (publishable key) access for the new tables, same model as
-- the rest of the Exam Cell schema.
ALTER TABLE public.questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_approvals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_units DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions, public.syllabus_approvals, public.syllabus_units, public.subject_allocations, public.faculty TO anon, authenticated;

-- Make the new tables visible to the API immediately.
NOTIFY pgrst, 'reload schema';
