-- ====================================================================
-- SUBJECT MASTER (COE): subject name, code, department, school
-- Run once in Supabase: Dashboard -> SQL Editor -> New Query -> Paste & Run
-- Safe to re-run (IF NOT EXISTS everywhere). Does not touch other tables.
--
-- The app's School -> Subject page writes here; staff uploads and the
-- question paper read the official code / department / school from it.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.exam_subject_master (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    department TEXT NOT NULL,
    school TEXT NOT NULL,
    semester TEXT,
    -- Full app record (created by, timestamps, ...).
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Lookups by code / department. Uniqueness of the code is checked in the app
-- (a unique index would make a sync from two devices fail as a whole).
CREATE INDEX IF NOT EXISTS exam_subject_master_code_idx ON public.exam_subject_master (lower(code));
CREATE INDEX IF NOT EXISTS exam_subject_master_dept_idx ON public.exam_subject_master (school, department);

CREATE OR REPLACE FUNCTION public.touch_exam_subject_master_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exam_subject_master_touch_updated_at ON public.exam_subject_master;
CREATE TRIGGER exam_subject_master_touch_updated_at
  BEFORE UPDATE ON public.exam_subject_master
  FOR EACH ROW EXECUTE FUNCTION public.touch_exam_subject_master_updated_at();

-- Same access model as the other Exam Cell tables (publishable key frontend).
ALTER TABLE public.exam_subject_master DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_subject_master TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
