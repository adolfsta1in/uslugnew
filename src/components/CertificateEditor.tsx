"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import EditableField from "./EditableField";
import EditableText from "./EditableText";
import CertRulers, { Margins } from "./CertRulers";
import FieldFormatToolbar from "./FieldFormatToolbar";
import { resetTemplate } from "../lib/templateStore";
import { toast } from "./Toast";
import {
  Certificate,
  CERT_NUMBER_DEFAULT,
  emptyCertificate,
  EXTRA_FIELDS,
} from "../lib/certificate";
import {
  getCertificate,
  insertCertificate,
  updateCertificate,
} from "../lib/certificateStore";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { AbbrPair } from "./EditableField";
import { getCachedAbbreviations, listAbbreviations } from "../lib/abbreviations";

const DRAFT_KEY = "cert-draft-v1";
const MARGINS_KEY = "cert-margins-v1";
const RULERS_KEY = "cert-rulers-v1";
// Значения по умолчанию совпадают с print.css (--cert-top/left/right).
const DEFAULT_MARGINS: Margins = { top: 62, left: 18, right: 14 };

export default function CertificateEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const [cert, setCert] = useState<Certificate>(emptyCertificate());
  const [recordId, setRecordId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0); // меняется → поля Lexical перемонтируются
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [margins, setMargins] = useState<Margins>(DEFAULT_MARGINS);
  const [showRulers, setShowRulers] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [abbr, setAbbr] = useState<AbbrPair[]>([]);
  const didInit = useRef(false);

  // Поле-хелпер: значение берётся один раз при монтировании (Lexical неуправляем),
  // поэтому при загрузке/очистке меняем formKey, чтобы поля пересоздались.
  const setField = useCallback((key: keyof Certificate, value: string) => {
    setCert((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const loadRecord = useCallback(async (id: string) => {
    try {
      const rec = await getCertificate(id);
      if (rec) {
        setCert(rec);
        setRecordId(rec.id ?? id);
        setFormKey((k) => k + 1);
        setDirty(false);
        toast("Запись загружена из реестра", "info");
      } else {
        toast("Запись не найдена", "error");
      }
    } catch (e) {
      toast("Ошибка загрузки: " + (e as Error).message, "error");
    }
  }, []);

  // Инициализация: загрузить запись по id или восстановить черновик.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    if (idParam) {
      loadRecord(idParam);
      return;
    }
    // Восстановление черновика
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Certificate;
        // № свидетельства всегда должен быть заполнен
        if (!draft.cert_number) draft.cert_number = CERT_NUMBER_DEFAULT;
        setCert(draft);
        setFormKey((k) => k + 1);
      }
    } catch {
      /* ignore */
    }
  }, [idParam, loadRecord]);

  // Автосохранение черновика (защита от случайной потери данных).
  useEffect(() => {
    if (!didInit.current) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(cert));
    } catch {
      /* ignore */
    }
  }, [cert]);

  // Загрузка сохранённых отступов (последних применённых/распечатанных) и
  // настройки линеек — один раз при открытии. setHydrated в том же эффекте
  // батчится с setMargins, поэтому первое сохранение не затирает загруженное.
  useEffect(() => {
    try {
      const m = localStorage.getItem(MARGINS_KEY);
      if (m) setMargins((prev) => ({ ...prev, ...(JSON.parse(m) as Partial<Margins>) }));
      const r = localStorage.getItem(RULERS_KEY);
      if (r != null) setShowRulers(r === "1");
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Автозамены: сразу из кэша, затем обновляем из Supabase.
  useEffect(() => {
    setAbbr(getCachedAbbreviations());
    listAbbreviations()
      .then((list) => setAbbr(list.map((a) => ({ short: a.short, full: a.full }))))
      .catch(() => {
        /* нет сети/Supabase — используем кэш */
      });
  }, []);

  // Сохранение отступов полей бланка (сохраняются между сеансами).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(MARGINS_KEY, JSON.stringify(margins));
    } catch {
      /* ignore */
    }
  }, [margins, hydrated]);

  // Сохранение видимости линеек.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(RULERS_KEY, showRulers ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [showRulers, hydrated]);

  // Предупреждение при уходе со страницы с несохранёнными изменениями.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleSave = async () => {
    if (!isSupabaseConfigured) {
      toast("Supabase не настроен — задайте переменные окружения (.env.local)", "error");
      return;
    }
    setSaving(true);
    try {
      if (recordId) {
        await updateCertificate(recordId, cert);
        toast("Изменения сохранены в реестр", "success");
      } else {
        const saved = await insertCertificate(cert);
        setRecordId(saved.id ?? null);
        if (saved.id) {
          // Обновляем URL, чтобы перезагрузка сохраняла контекст записи
          router.replace(`/new?id=${saved.id}`);
        }
        toast("Сертификат сохранён в реестр", "success");
      }
      setDirty(false);
    } catch (e) {
      toast("Ошибка сохранения: " + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    // То, что распечатали, остаётся стандартным по умолчанию: фиксируем
    // текущие отступы линейки, чтобы в следующий раз бланк открылся так же.
    try {
      localStorage.setItem(MARGINS_KEY, JSON.stringify(margins));
    } catch {
      /* ignore */
    }
    window.print();
    toast("Отступы линейки сохранены — так и останется по умолчанию", "success");
  };

  const handleClear = () => {
    if (dirty && !window.confirm("Очистить форму? Несохранённые данные будут потеряны.")) {
      return;
    }
    setCert(emptyCertificate());
    setRecordId(null);
    setFormKey((k) => k + 1);
    setDirty(false);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    router.replace("/new");
  };

  const handleLoadFromRegistry = () => {
    router.push("/registry");
  };

  // Хелпер для рендера редактируемого поля бланка
  const f = (
    key: keyof Certificate,
    opts?: {
      hint?: string;
      width?: string;
      center?: boolean;
      multiline?: boolean;
      block?: boolean;
      plain?: boolean;
    }
  ) => (
    <EditableField
      key={`${formKey}-${key}`}
      value={String(cert[key] ?? "")}
      onChange={(t) => setField(key, t)}
      hint={opts?.hint}
      width={opts?.width}
      center={opts?.center}
      multiline={opts?.multiline}
      block={opts?.block}
      plain={opts?.plain}
      abbr={abbr}
    />
  );

  // Хелпер для редактируемого ПОСТОЯННОГО текста шаблона
  const ct = (id: string, text: string) => (
    <EditableText key={`${formKey}-t-${id}`} id={id} defaultText={text} />
  );

  const handleResetTemplate = () => {
    if (!window.confirm("Сбросить весь постоянный текст сертификата к исходному?")) return;
    resetTemplate();
    setFormKey((k) => k + 1);
    toast("Текст шаблона сброшен к исходному", "info");
  };

  const handleResetMargins = () => {
    setMargins(DEFAULT_MARGINS);
    toast("Отступы полей сброшены к стандартным", "info");
  };

  // CSS-переменные листа: отступы (поля) управляются линейками.
  const pageStyle = {
    ["--cert-top" as string]: `${margins.top}mm`,
    ["--cert-left" as string]: `${margins.left}mm`,
    ["--cert-right" as string]: `${margins.right}mm`,
  } as React.CSSProperties;

  // ===== Лист A4 (постоянный текст редактируем; значения полей — в реестр) =====
  const renderPage = () => (
    <div className="a4-page" style={pageStyle}>
      <div className="a4-header-guide no-print">
        Область готового бланка (шапка, логотипы, номер) — НЕ печатается приложением
      </div>

      <div className="cert-content">
        {/* Срок действия */}
        <div className="cert-validity">
          {ct("v_from_pre", "Эътибор дорад")}&nbsp;&nbsp;&nbsp; {ct("v_from_az", "аз «")}
          {f("from_day", { width: "12mm", center: true, hint: "дд" })}
          {ct("v_from_q", "»")} {f("from_month", { width: "22mm", center: true, hint: "месяц" })}{" "}
          {f("from_year", { width: "16mm", center: true, hint: "год" })} {ct("v_from_s", "с.")}
        </div>
        <div className="cert-validity-row">
          <span className="left">
            {ct("v_no", "№")}
            {f("cert_number", { width: "60mm", hint: "№ свидетельства", plain: true })}
          </span>
          <span>
            {ct("v_to_pre", "то «")}
            {f("to_day", { width: "12mm", center: true, hint: "дд" })}
            {ct("v_to_q", "»")} {f("to_month", { width: "22mm", center: true, hint: "месяц" })}{" "}
            {f("to_year", { width: "16mm", center: true, hint: "год" })} {ct("v_to_s", "с.")}
          </span>
        </div>

        {/* Основной текст */}
        <div className="cpar" style={{ marginTop: "3mm" }}>
          {ct("p1", "Шаҳодатномаи мазкур тасдиқ менамояд, ки хизматрасонии")}{" "}
          {f("service_name", { width: "70mm", hint: "наименование" })}
        </div>
        {f("address", { block: true, center: true, hint: "адрес объекта" })}
        <div className="cert-caption">{ct("cap1", "(номгӯи муассисаи иҷрокунандаи хизматрасонӣ)")}</div>

        {f("manager_name", { block: true, center: true, hint: "ФИО руководителя" })}
        <div className="cert-caption">{ct("cap2", "(ному насаби роҳбари ташкилот)")}</div>

        <div className="cert-indent cpar">
          {ct(
            "p2",
            "дар асоси Қонунҳои Ҷумҳурии Тоҷикистон «Дар бораи баҳодиҳии мутобиқат», «Дар бораи ҳимояи ҳуқуқи истеъмолкунандагон», «Дар бораи бамеъёрдарории техникӣ», «Дар бораи стандартонӣ», «Дар бораи таъмини ченаки ягона», «Дар бораи савдо ва хизматрасонии маишӣ», «Дар бораи бехатарии маҳсулоти хӯрокворӣ» аз ҷониби Тоҷикстандарт баҳогузорӣ карда шуда, субъекти хоҷагидори мазкур имконияти иҷрои хизматрасонии"
          )}{" "}
          {f("service_type", { width: "55mm", hint: "вид услуги" })}
        </div>
        <div className="cert-caption">{ct("cap3", "(номгӯи кору хизматрасонӣ)")}</div>

        <div className="cpar">
          {ct("p3a", "мутобиқи талаботи")}{" "}
          {f("normative_doc", { width: "55mm", hint: "нормативный документ" })}{" "}
          {ct("p3b", "дорад.")}
        </div>
        <div className="cert-caption">{ct("cap4", "(ифодаи номгӯи ҳуҷҷатҳои меъёрии техникӣ)")}</div>

        <div className="cert-indent cpar">
          {ct(
            "p4a",
            "Шаҳодатнома дода шуд дар асоси хулосаи (тасдиқнома) баҳогузорӣ оид ба тасдиқи мутобиқати хизматрасонии субъекти хоҷагидор ба талаботи ҳуҷҷати меъёрии техникӣ аз"
          )}{" "}
          {f("basis_date_number", { width: "50mm", hint: "дата и № основания" })}
          {ct(
            "p4b",
            ". Ҳангоми шаҳодатномадиҳӣ ҳуҷҷати муайянкунандаи ҳуқуқи фаъолияти субъекти хоҷагидор"
          )}{" "}
          {f("activity_doc", { width: "55mm", hint: "документ" })}{" "}
          {ct("p4c", "ба инобат гирифта шуд.")}
        </div>

        <div className="cert-indent cpar">
          {ct(
            "p5",
            "Дархосткунанда, (иҷрокунандаи кор ва хизматрасонӣ) барои мутобиқати кору ё хизматрасонии ба талаботи муқаррарнамудаи ҳуҷҷати меъёрии техникие, ки дар шаҳодатнома дарҷ гардидааст ва огоҳ намудани истеъмолкунанда дар бобати доштани шаҳодатнома масъул мебошад."
          )}
        </div>

        <div className="cpar">
          {ct("p6a", "Назорати инспексионӣ аз ҷониби")}{" "}
          {f("inspection_body", { width: "45mm", hint: "орган" })}{" "}
          {ct("p6b", "амалӣ карда мешавад.")}
        </div>
        <div className="cert-caption">{ct("cap5", "(номгӯи мақомот оид ба шаҳодатномадиҳӣ)")}</div>

        <div className="cpar">
          {ct("p7", "Қайдҳои махсус")}{" "}
          {f("special_notes", { width: "90mm", hint: "особые отметки" })}
        </div>

        <div className="cert-indent cpar" style={{ marginTop: "1mm" }}>
          {ct(
            "p8",
            "Дар ҳолати иҷро накардани талаботи муқарраргардида шаҳодатномаи мазкур аз эътибор соқит дониста мешавад."
          )}
        </div>

        {/* Подпись */}
        <div className="cert-sign">
          <div className="cert-sign-right">{ct("s1", "Роҳбари мақомот")}</div>
          <div className="cert-validity-row" style={{ marginTop: "3mm" }}>
            <span className="left">{ct("s2", "Ҷ.М.")}</span>
            <span>{f("signature", { width: "45mm", center: true, hint: "имя / подпись" })}</span>
            <span>{f("signatory", { width: "45mm", center: true, hint: "ФИО" })}</span>
          </div>
          <div className="cert-validity-row" style={{ fontSize: "8.5pt", marginTop: "-1mm" }}>
            <span className="left">&nbsp;</span>
            <span>{ct("s4", "(имзо)")}</span>
            <span style={{ width: "45mm", textAlign: "center" }}>{ct("s5", "(ному насаб)")}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "20px 12px 60px" }}>
      {/* Плавающая панель форматирования выделенного текста поля */}
      <FieldFormatToolbar />

      {/* Панель действий */}
      <div
        className="editor-toolbar no-print"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          marginBottom: 16,
          position: "sticky",
          top: 52,
          zIndex: 10,
          background: "var(--bg)",
          padding: "8px 0",
        }}
      >
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Сохранение…" : recordId ? "💾 Сохранить изменения" : "💾 Сохранить в реестр"}
        </button>
        <button className="btn" onClick={handlePrint}>🖨️ Печать сертификата</button>
        <button className="btn" onClick={handleClear}>🧹 Очистить форму</button>
        <button className="btn" onClick={handleLoadFromRegistry}>📂 Загрузить из реестра</button>
        <button className="btn" onClick={handleResetTemplate}>↩️ Сбросить текст шаблона</button>
        <button className="btn" onClick={() => setShowRulers((v) => !v)}>
          {showRulers ? "📏 Скрыть линейку" : "📏 Показать линейку"}
        </button>
        {showRulers && (
          <button className="btn" onClick={handleResetMargins}>↔️ Сбросить отступы</button>
        )}
      </div>

      {/* ===== Лист A4 (с линейками или без) ===== */}
      {showRulers ? (
        <CertRulers margins={margins} onChange={setMargins}>
          {renderPage()}
        </CertRulers>
      ) : (
        renderPage()
      )}

      {/* ===== Дополнительные данные (в реестр, НЕ печатаются) ===== */}
      <div
        className="extra-panel no-print"
        style={{
          maxWidth: "210mm",
          margin: "20px auto 0",
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 16,
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Дополнительные данные</h3>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>
          Эти поля сохраняются в реестр, но не печатаются на бланке.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {EXTRA_FIELDS.map((ef) => (
            <label key={ef.key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>{ef.label}</span>
              <input
                type={ef.numeric ? "number" : "text"}
                value={
                  ef.numeric
                    ? cert.amount ?? ""
                    : (cert[ef.key] as string) ?? ""
                }
                onChange={(e) => {
                  if (ef.numeric) {
                    const v = e.target.value;
                    setCert((prev) => ({ ...prev, amount: v === "" ? null : Number(v) }));
                  } else {
                    setCert((prev) => ({ ...prev, [ef.key]: e.target.value }));
                  }
                  setDirty(true);
                }}
                style={{
                  padding: "8px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
