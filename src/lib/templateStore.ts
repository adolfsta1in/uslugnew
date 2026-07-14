// ============================================================================
// Хранилище правок ПОСТОЯННОГО текста сертификата (шаблона).
// Пользователь может исправлять опечатки/сдвигать текст пробелами прямо в бланке.
// Правки едины для всех сертификатов и сохраняются локально в браузере.
//
// Два слоя:
//   • overrides (KEY)         — текущие правки пользователя;
//   • defaults  (DEFAULT_KEY) — «сохранённый по умолчанию» вид (кнопка «Сохранить
//                               как шаблон по умолчанию»). Служит базой при сбросе.
// Приоритет чтения: overrides → defaults → исходное значение из кода (fallback).
// ============================================================================

const KEY = "cert-template-v1";
const DEFAULT_KEY = "cert-template-default-v1";

let overrides: Record<string, string> = {};
let defaults: Record<string, string> = {};
let loaded = false;

function has(obj: Record<string, string>, id: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, id);
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    if (raw) overrides = JSON.parse(raw);
  } catch {
    overrides = {};
  }
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(DEFAULT_KEY) : null;
    if (raw) defaults = JSON.parse(raw);
  } catch {
    defaults = {};
  }
}

/** Текст фрагмента шаблона: правка → сохранённый дефолт → значение из кода. */
export function getTemplateText(id: string, fallback: string): string {
  ensureLoaded();
  if (has(overrides, id)) return overrides[id];
  if (has(defaults, id)) return defaults[id];
  return fallback;
}

/** Есть ли сохранённый текст (правка или дефолт) — тогда в нём может быть HTML. */
export function hasTemplateText(id: string): boolean {
  ensureLoaded();
  return has(overrides, id) || has(defaults, id);
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

/**
 * Зафиксировать текущий вид текста бланка как «по умолчанию» навсегда.
 * Все текущие правки становятся базой, к которой возвращает «Сбросить текст».
 */
export function saveTemplateAsDefault() {
  ensureLoaded();
  defaults = { ...defaults, ...overrides };
  try {
    localStorage.setItem(DEFAULT_KEY, JSON.stringify(defaults));
  } catch {
    /* ignore */
  }
}

/** Сбросить текущие правки к сохранённому дефолту (или к исходному тексту из кода). */
export function resetTemplate() {
  overrides = {};
  loaded = true;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
