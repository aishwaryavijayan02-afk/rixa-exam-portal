-- ====================================================================
-- HOD -> DEAN -> COE APPROVAL SYNC
-- Run once in Supabase: Dashboard -> SQL Editor -> New Query -> Paste & Run
-- Safe to re-run (IF NOT EXISTS everywhere).
-- ====================================================================

-- 1. Questions: keep who uploaded, for whom, and which role verified.
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS verified_role TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS source_file TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS uploaded_on_behalf_by TEXT;
-- Full app record (options, AI checks, reviewer comments, ...).
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS payload JSONB;

CREATE INDEX IF NOT EXISTS questions_status_idx ON public.questions (status);
CREATE INDEX IF NOT EXISTS questions_subject_idx ON public.questions (subject);

-- 2. Syllabus approvals: Staff/HOD upload -> HOD verify -> Dean -> COE.
CREATE TABLE IF NOT EXISTS public.syllabus_approvals (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
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
    -- Original uploaded file as a data URL; fetched only when a reviewer opens it.
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

-- Same access model as the other tables in schema.sql (anon frontend access).
ALTER TABLE public.syllabus_approvals DISABLE ROW LEVEL SECURITY;
