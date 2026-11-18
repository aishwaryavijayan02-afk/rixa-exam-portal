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
