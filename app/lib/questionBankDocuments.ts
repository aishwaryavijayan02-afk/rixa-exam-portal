const DATABASE_NAME = "exam-cell-question-bank-documents";
const STORE_NAME = "uploads";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open document storage."));
  });
}

export async function saveQuestionBankDocument(file: File): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(file, file.name);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Unable to preserve the uploaded document."));
    transaction.onabort = () => reject(transaction.error || new Error("Document storage was interrupted."));
  });
  database.close();
}

export async function getQuestionBankDocument(fileName: string): Promise<Blob | null> {
  const database = await openDatabase();
  const file = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(fileName);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error || new Error("Unable to retrieve the uploaded document."));
  });
  database.close();
  return file || null;
}

export async function getQuestionBankDocumentUrl(fileName: string): Promise<string | null> {
  const file = await getQuestionBankDocument(fileName);
  return file ? URL.createObjectURL(file) : null;
}

// ---------------------------------------------------------------------------
// Shared copy in Supabase (table `question_bank_documents`, see
// supabase/migrations/20261120_question_bank_documents.sql) so reviewers on
// other devices can open the original file. Every call is best-effort: if the
// table does not exist yet, uploads still work from the local copy.
// ---------------------------------------------------------------------------

const CLOUD_TABLE = "question_bank_documents";

export interface QuestionBankDocumentMeta {
  uploadedBy?: string;
  uploaderEmail?: string;
  subject?: string;
  department?: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Unable to read the document."));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/** Uploads the original file to the shared table. Returns false when it could not be stored. */
export async function uploadQuestionBankDocumentToCloud(file: Blob, fileName: string, meta: QuestionBankDocumentMeta = {}): Promise<boolean> {
  const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from(CLOUD_TABLE).upsert({
      file_name: fileName,
      content_type: file.type || null,
      size_bytes: file.size,
      document_data: await blobToDataUrl(file),
      uploaded_by: meta.uploadedBy || null,
      uploader_email: meta.uploaderEmail || null,
      subject: meta.subject || null,
      department: meta.department || null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.warn("Question bank file was not stored in the shared repository:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("Question bank file was not stored in the shared repository.", error);
    return false;
  }
}

/** Original question bank file: this browser's copy first, then the shared table. */
export async function fetchQuestionBankDocument(fileName: string): Promise<Blob | null> {
  try {
    const local = await getQuestionBankDocument(fileName);
    if (local) return local;
  } catch {
    // IndexedDB unavailable (private window); fall through to the shared copy.
  }
  const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase.from(CLOUD_TABLE).select("document_data").eq("file_name", fileName).maybeSingle();
    if (error || !data?.document_data) return null;
    return await dataUrlToBlob(data.document_data);
  } catch {
    return null;
  }
}

/**
 * Copies question bank files kept only in this browser (uploaded before the
 * shared table existed) to the shared table, so reviewers can open them too.
 */
export async function syncLocalQuestionBankDocuments(files: { fileName: string; meta: QuestionBankDocumentMeta }[]): Promise<void> {
  if (!files.length) return;
  const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
  if (!isSupabaseConfigured()) return;
  try {
    const names = files.map((f) => f.fileName);
    const { data, error } = await supabase.from(CLOUD_TABLE).select("file_name").in("file_name", names);
    if (error) return; // table not created yet
    const stored = new Set((data || []).map((row: { file_name: string }) => row.file_name));
    for (const { fileName, meta } of files) {
      if (stored.has(fileName)) continue;
      const local = await getQuestionBankDocument(fileName).catch(() => null);
      if (local) await uploadQuestionBankDocumentToCloud(local, fileName, meta);
    }
  } catch {
    // best-effort
  }
}
