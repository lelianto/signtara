import { openDB } from 'idb';
import { SEQUENCE_VERSION, validSequence, type Sequence, type WordTemplate } from '../recognition/sequence';
import { normalizeWord, wordConceptId } from '../recognition/vocabulary';

/** Only the numeric feature sequence is stored: no images or video frames. */
export interface StoredWordTemplate extends WordTemplate {
  capturedAt: number;
  sequenceVersion: string;
  source: 'personal';
}

export const MAX_PER_WORD = 10;

export function validWordTemplate(value: unknown): value is StoredWordTemplate {
  const t = value as StoredWordTemplate;
  return !!t && typeof t.id === 'string' && typeof t.word === 'string' && normalizeWord(t.word) === t.word &&
    t.conceptId === wordConceptId(t.word) && t.sequenceVersion === SEQUENCE_VERSION && t.source === 'personal' &&
    Number.isFinite(t.capturedAt) && validSequence(t.sequence);
}

let writes: Promise<unknown> = Promise.resolve();
// Nama lama "isyara" (sebelum BISARA) sengaja dipertahankan; mengganti nama basis data menghilangkan kata rekaman yang sudah tersimpan.
async function db() {
  return openDB('isyara-word-templates', 1, { upgrade(d) { d.createObjectStore('templates', { keyPath: 'id' }); } });
}

export async function readWordTemplates(): Promise<StoredWordTemplate[]> {
  const d = await db();
  try {
    return (await d.getAll('templates')).filter(validWordTemplate).sort((a, b) => a.capturedAt - b.capturedAt);
  } finally { d.close(); }
}

function queue<T>(op: () => Promise<T>): Promise<T> {
  const next = writes.catch(() => {}).then(op);
  writes = next;
  return next;
}

/** Saves one recording; the oldest recording of that word is dropped beyond MAX_PER_WORD. */
export function saveWordTemplate(word: string, sequence: Sequence) {
  const w = normalizeWord(word);
  const template: StoredWordTemplate = {
    id: crypto.randomUUID(), word: w, conceptId: w ? wordConceptId(w) : '', sequence: sequence.map((f) => [...f]),
    capturedAt: Date.now(), sequenceVersion: SEQUENCE_VERSION, source: 'personal',
  };
  if (!validWordTemplate(template)) return Promise.reject(Error('Invalid word template'));
  return queue(async () => {
    const d = await db();
    try {
      const tx = d.transaction('templates', 'readwrite');
      const existing: StoredWordTemplate[] = (await tx.store.getAll()).filter(
        (t: StoredWordTemplate) => t.conceptId === template.conceptId,
      ).sort((a: StoredWordTemplate, b: StoredWordTemplate) => a.capturedAt - b.capturedAt);
      for (const t of existing.slice(0, Math.max(0, existing.length + 1 - MAX_PER_WORD))) await tx.store.delete(t.id);
      await tx.store.put(template);
      await tx.done;
    } finally { d.close(); }
    return readWordTemplates();
  });
}

export function deleteWord(conceptId: string) {
  return queue(async () => {
    const d = await db();
    try {
      const tx = d.transaction('templates', 'readwrite');
      for (const t of await tx.store.getAll()) if (t.conceptId === conceptId) await tx.store.delete(t.id);
      await tx.done;
    } finally { d.close(); }
    return readWordTemplates();
  });
}

export function deleteWordTemplate(id: string) {
  return queue(async () => {
    const d = await db();
    try { await d.delete('templates', id); } finally { d.close(); }
    return readWordTemplates();
  });
}

export function clearWordTemplates() {
  return queue(async () => {
    const d = await db();
    try { await d.clear('templates'); } finally { d.close(); }
  });
}
