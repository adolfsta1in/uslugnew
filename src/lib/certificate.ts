// ============================================================================
// Единый источник истины для полей сертификата (ШАҲОДАТНОМА).
// Отсюда выводятся: тип записи, значения по умолчанию, редактируемые поля в
// шаблоне, панель «Дополнительные данные» и колонки реестра (AG Grid).
// SQL-схема Supabase (supabase/schema.sql) должна соответствовать этим ключам.
// ============================================================================

/** Запись сертификата — соответствует строке таблицы `certificates` в Supabase. */
export interface Certificate {
  id?: string;

  // --- Печатаемые поля бланка (чёрный текст поверх готового бланка) ---
  cert_number: string; // № свидетельства (напр. TJ.762.37100.01.016 – 2025)
  from_day: string; // «Эътибор дорад аз» — день
  from_month: string; // месяц (напр. июни)
  from_year: string; // год
  to_day: string; // «то» — день
  to_month: string; // месяц
  to_year: string; // год
  service_name: string; // Наименование (хизматрасонии ...)
  address: string; // Адрес
  manager_name: string; // ФИО руководителя/предпринимателя
  service_type: string; // Вид услуги (хизматрасонии ...)
  normative_doc: string; // Нормативный документ (СТ ҶТ ...)
  basis_date_number: string; // Основание: дата и № (напр. 25.06.2026с. № 3799)
  activity_doc: string; // Документ о праве деятельности (Шаҳодатномаи Кумитаи андоз)
  inspection_body: string; // Орган инспекционного надзора (Тоҷикстандарт)
  special_notes: string; // Қайдҳои махсус (особые отметки)
  signatory: string; // Роҳбари мақомот — ФИО подписанта (Раҳмон И.Х.)

  // --- Дополнительные данные (в реестр, НЕ печатаются на бланке) ---
  application_number: string; // № заявка
  plan_number: string; // № плана
  inspector: string; // Инспектор (ФИО)
  amount: number | null; // Сумма

  // --- Служебные ---
  created_at?: string;
  updated_at?: string;
}

/** Тип редактируемого поля внутри шаблона A4. */
export interface CertField {
  key: keyof Certificate;
  /** Подсказка (placeholder), показывается когда поле пустое. */
  hint: string;
  /** Ширина поля на экране, в мм (для точной верстки A4). */
  width?: number;
  /** Многострочное поле (напр. особые отметки). */
  multiline?: boolean;
  /** Выравнивание текста по центру (для дат в «...»). */
  center?: boolean;
}

/**
 * Печатаемые поля бланка со значениями по умолчанию (образец из Word-документа
 * и фотографии сертификата). Пользователь заполняет только эти места.
 */
export const DEFAULT_CERT: Certificate = {
  cert_number: "TJ.762.37100.01.016 – 2025",
  from_day: "23",
  from_month: "июни",
  from_year: "2026",
  to_day: "23",
  to_month: "июни",
  to_year: "2027",
  service_name: "Дукони фурӯши техникаи маишӣ",
  address: "шаҳри Душанбе, ноҳияи Фирдавсӣ, кӯчаи Миралӣ 1",
  manager_name: "Ғиёсова С.",
  service_type: "савдои чаканаро",
  normative_doc: "СТ ҶТ 1037-2001",
  basis_date_number: "25.06.2026с. № 3799",
  activity_doc: "Шаҳодатномаи Кумитаи андоз",
  inspection_body: "Тоҷикстандарт",
  special_notes: "",
  signatory: "Раҳмон И.Х.",

  application_number: "",
  plan_number: "",
  inspector: "",
  amount: null,
};

/** Пустая запись — для кнопки «Очистить форму» и новой формы без образца. */
export function emptyCertificate(): Certificate {
  return {
    cert_number: "",
    from_day: "",
    from_month: "",
    from_year: "",
    to_day: "",
    to_month: "",
    to_year: "",
    service_name: "",
    address: "",
    manager_name: "",
    service_type: "",
    normative_doc: "СТ ҶТ 1037-2001",
    basis_date_number: "",
    activity_doc: "Шаҳодатномаи Кумитаи андоз",
    inspection_body: "Тоҷикстандарт",
    special_notes: "",
    signatory: "Раҳмон И.Х.",
    application_number: "",
    plan_number: "",
    inspector: "",
    amount: null,
  };
}

/** Дополнительные данные (панель в редакторе) — попадают в реестр, не печатаются. */
export const EXTRA_FIELDS: { key: keyof Certificate; label: string; numeric?: boolean }[] = [
  { key: "application_number", label: "№ заявки" },
  { key: "plan_number", label: "№ плана" },
  { key: "inspector", label: "Инспектор (ФИО)" },
  { key: "amount", label: "Сумма", numeric: true },
];

/**
 * Собрать строку «Дата выдачи» из даты «Эътибор дорад аз».
 * Используется как read-only колонка реестра (valueGetter).
 */
export function issueDate(c: Certificate): string {
  const parts = [c.from_day, c.from_month, c.from_year].map((p) => (p || "").trim()).filter(Boolean);
  return parts.join(" ");
}

/**
 * Порядок и заголовки колонок реестра — один в один с рабочим Excel-файлом.
 * `field` — ключ записи; для «Дата выдачи» значение вычисляется (valueGetter).
 */
export const REGISTRY_COLUMNS: {
  field?: keyof Certificate;
  header: string;
  computed?: "issue_date";
  numeric?: boolean;
  editable?: boolean;
  minWidth?: number;
}[] = [
  { field: "cert_number", header: "№ свидетельства", editable: true, minWidth: 150 },
  { field: "application_number", header: "№ заявка", editable: true, minWidth: 100 },
  { field: "service_name", header: "Наименование предприятий, организаций, частных лиц, получивших свидетел.", editable: true, minWidth: 240 },
  { field: "address", header: "Адрес", editable: true, minWidth: 200 },
  { field: "manager_name", header: "ФИО предприниматель", editable: true, minWidth: 160 },
  { field: "service_type", header: "Вид услуга", editable: true, minWidth: 140 },
  { field: "plan_number", header: "№ плана", editable: true, minWidth: 100 },
  { header: "Дата выдачи", computed: "issue_date", editable: false, minWidth: 130 },
  { field: "inspector", header: "Инспектор", editable: true, minWidth: 140 },
  { field: "amount", header: "Сумма", numeric: true, editable: true, minWidth: 110 },
];
