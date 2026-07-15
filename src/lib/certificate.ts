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
  signature: string; // Подпись/имя в левой части блока подписи (бывшая линия «___»)

  // --- Дополнительные данные (в реестр, НЕ печатаются на бланке) ---
  certificate_number: string; // № свидетельства (вводится в доп. данных → колонка реестра «№ свидетельства»)
  application_number: string; // № заявка (устар.: теперь № заявки берётся из basis_date_number)
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
 * Номер свидетельства по умолчанию — предзаполнен в каждом новом бланке.
 * Меняйте здесь, если серия/номер изменится.
 */
export const CERT_NUMBER_DEFAULT = "TJ.762.37100.01.016 – 2025";

/**
 * Печатаемые поля бланка со значениями по умолчанию (образец из Word-документа
 * и фотографии сертификата). Пользователь заполняет только эти места.
 */
export const DEFAULT_CERT: Certificate = {
  cert_number: CERT_NUMBER_DEFAULT,
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
  signature: "",

  certificate_number: "",
  application_number: "",
  plan_number: "",
  inspector: "",
  amount: null,
};

/** Пустая запись — для кнопки «Очистить форму» и новой формы без образца. */
export function emptyCertificate(): Certificate {
  return {
    cert_number: CERT_NUMBER_DEFAULT,
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
    signature: "",
    certificate_number: "",
    application_number: "",
    plan_number: "",
    inspector: "",
    amount: null,
  };
}

/** Дополнительные данные (панель в редакторе) — попадают в реестр, не печатаются. */
export const EXTRA_FIELDS: { key: keyof Certificate; label: string; numeric?: boolean }[] = [
  { key: "certificate_number", label: "№ свидетельства" },
  { key: "plan_number", label: "№ плана" },
  { key: "inspector", label: "Инспектор (ФИО)" },
  { key: "amount", label: "Сумма", numeric: true },
];

// ============================================================================
// Преобразования «сертификат → реестр». На бланке значения хранятся в полной
// форме (так печатается официальный документ), а в реестр переносится
// сокращённый/извлечённый вид.
// ============================================================================

/**
 * Сокращения административно-территориальных терминов адреса (полная форма → короткая).
 * Пример: «шаҳри Душанбе, ноҳияи Фирдавсӣ, кӯчаи Миралӣ 1» → «ш. Душанбе, н. Фирдавсӣ, к. Миралӣ 1».
 */
const ADDRESS_ABBR: [string, string][] = [
  ["ҷумҳурии", "ҷ."],
  ["вилояти", "в."],
  ["шаҳри", "ш."],
  ["ноҳияи", "н."],
  ["ҷамоати", "ҷам."],
  ["деҳаи", "д."],
  ["маҳаллаи", "маҳ."],
  ["кӯчаи", "к."],
  ["хиёбони", "хиёб."],
  ["гузаргоҳи", "гуз."],
  ["хонаи", "х."],
];

/** Сократить адрес для реестра (заменяет административные термины короткими формами). */
export function abbreviateAddress(s: string): string {
  let out = s ?? "";
  for (const [word, short] of ADDRESS_ABBR) {
    // Слово целиком: в начале строки или после разделителя, далее пробел(ы).
    // Флаг «u» включает Unicode-регистронезависимость (важно для кириллицы).
    const re = new RegExp(`(^|[\\s,;(])${word}\\s+`, "giu");
    out = out.replace(re, (_m, sep) => `${sep}${short} `);
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

/**
 * Сократить ФИО предпринимателя для реестра.
 * • Полное ФИО (3+ слова: Фамилия Имя Отчество …) → «Фамилия И.О.».
 * • Только ФИ (2 слова) или одно слово — оставляем без изменений.
 */
export function shortenManagerName(s: string): string {
  const parts = (s ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 3) return parts.join(" ");
  const [last, ...rest] = parts;
  const initials = rest.map((p) => p[0].toUpperCase() + ".").join("");
  return `${last} ${initials}`;
}

/**
 * Извлечь № заявки из поля «дата и № основания» (basis_date_number).
 * Пример: «12.03.2026 №4012» → «4012». Если номер (после №) не найден — пусто.
 */
export function extractApplicationNumber(s: string): string {
  const m = (s ?? "").match(/№\s*([0-9]+)/);
  return m ? m[1] : "";
}

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
 * `field` — ключ записи (значение берётся и правится напрямую).
 * `value` — вычисляемое отображаемое значение (переопределяет `field`); такие
 *   колонки только для чтения, т.к. это производное от полей сертификата.
 * `colId` — явный id для колонок без прямого поля (напр. «Дата выдачи»).
 */
export interface RegistryColumn {
  field?: keyof Certificate;
  colId?: string;
  header: string;
  value?: (c: Certificate) => string;
  numeric?: boolean;
  editable?: boolean;
  minWidth?: number;
}

export const REGISTRY_COLUMNS: RegistryColumn[] = [
  // № свидетельства теперь вводится в «Дополнительных данных» (certificate_number),
  // а не берётся с бланка (cert_number — это серия готового бланка).
  { field: "certificate_number", header: "№ свидетельства", editable: true, minWidth: 150 },
  // № заявки извлекается из поля бланка «дата и № основания» (напр. «12.03.2026 №4012» → «4012»).
  { colId: "application_number", header: "№ заявка", value: (c) => extractApplicationNumber(c.basis_date_number), numeric: true, editable: false, minWidth: 100 },
  { field: "service_name", header: "Наименование предприятий, организаций, частных лиц, получивших свидетел.", editable: true, minWidth: 240 },
  // Адрес переносится в сокращённой форме (ш., н., к. …); правка — в сертификате.
  { field: "address", header: "Адрес", value: (c) => abbreviateAddress(c.address), editable: false, minWidth: 200 },
  // Полное ФИО сокращается до «Фамилия И.О.»; ФИ (2 слова) — без изменений.
  { field: "manager_name", header: "ФИО предприниматель", value: (c) => shortenManagerName(c.manager_name), editable: false, minWidth: 160 },
  { field: "service_type", header: "Вид услуга", editable: true, minWidth: 140 },
  { field: "plan_number", header: "№ плана", editable: true, minWidth: 100 },
  { colId: "issue_date", header: "Дата выдачи", value: issueDate, editable: false, minWidth: 130 },
  { field: "inspector", header: "Инспектор", editable: true, minWidth: 140 },
  { field: "amount", header: "Сумма", numeric: true, editable: true, minWidth: 110 },
];
