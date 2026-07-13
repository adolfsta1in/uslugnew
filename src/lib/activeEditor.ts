// ============================================================================
// Небольшой реестр «активного» редактора поля (Lexical).
// Каждое поле сертификата — отдельный экземпляр Lexical. Чтобы одна плавающая
// панель форматирования (цвет/размер шрифта) могла работать с тем полем,
// которое пользователь сейчас редактирует, поле регистрирует себя при фокусе,
// а панель берёт активный редактор отсюда.
// ============================================================================

import type { LexicalEditor } from "lexical";

let active: LexicalEditor | null = null;
const subscribers = new Set<(e: LexicalEditor | null) => void>();

/** Установить активный редактор (вызывается полем при фокусе). */
export function setActiveEditor(editor: LexicalEditor | null) {
  active = editor;
  subscribers.forEach((cb) => cb(editor));
}

/** Текущий активный редактор поля. */
export function getActiveEditor(): LexicalEditor | null {
  return active;
}

/** Подписка на смену активного редактора. */
export function subscribeActiveEditor(cb: (e: LexicalEditor | null) => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}
