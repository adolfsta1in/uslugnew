// ============================================================================
// Хранилище правок ПОСТОЯННОГО текста сертификата (шаблона).
// Пользователь может исправлять опечатки прямо в тексте бланка. Правки едины
// для всех сертификатов и сохраняются локально в браузере (localStorage).
// (При необходимости можно перенести в Supabase, чтобы правки были общими.)
// ============================================================================

const KEY = "cert-template-v1";

let overrides: Record<string, string> = {};
let loaded = false;

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    if (raw) overrides = JSON.parse(raw);
  } catch {
    overrides = {};
  }
}

/** Текст фрагмента шаблона: правка пользователя или значение по умолчанию. */
export function getTemplateText(id: string, fallback: string): string {
  ensureLoaded();
  return Object.prototype.hasOwnProperty.call(overrides, id) ? overrides[id] : fallback;
}

/** Есть ли сохранённая правка фрагмента (тогда в нём может быть форматирование/HTML). */
export function hasTemplateText(id: string): boolean {
  ensureLoaded();
  return Object.prototype.hasOwnProperty.call(overrides, id);
}

/** Сохранить правку фрагмента шаблона. */
export function setTemplateText(id: string, text: string) {
  ensureLoaded();
  overrides[id] = text;
  try {
    localStorage.setItem(KEY, JSON.stringify(overrides));
  } catch {
    /* ignore */
  }
}

/** Сбросить все правки шаблона к значениям по умолчанию. */
export function resetTemplate() {
  overrides = {};
  loaded = true;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
