-- ====================================================================
-- QUESTION BANK ORIGINAL FILES (for the Scrutinizer's Academic Repository)
-- Run once in Supabase: Dashboard -> SQL Editor -> New Query -> Paste & Run
-- Safe to re-run (IF NOT EXISTS everywhere).
--
-- Until now the original question bank file (Word / PDF / Excel) was kept
-- only in the uploading browser. This table stores it so reviewers on any
-- device can view and download the exact file the faculty uploaded.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.question_bank_documents (
    -- Same value as questions.source_file
    file_name TEXT PRIMARY KEY,
    content_type TEXT,
    size_bytes BIGINT,
    -- Original uploaded file as a data URL
    document_data TEXT NOT NULL,
    uploaded_by TEXT,
    uploader_email TEXT,
    subject TEXT,
    department TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Same access model as the other tables in schema.sql (anon frontend access).
ALTER TABLE public.question_bank_documents DISABLE ROW LEVEL SECURITY;
