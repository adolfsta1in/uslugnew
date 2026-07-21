"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "./Toast";
import SortDialog, { SortColumn, SortLevel } from "./SortDialog";
import { Certificate, REGISTRY_COLUMNS } from "../lib/certificate";
import {
  listCertificates,
  updateCertificate,
  deleteCertificate,
} from "../lib/certificateStore";
import { isSupabaseConfigured, testSupabaseConnection } from "../lib/supabaseClient";

// ============================================================================
// Реестр сертификатов — собственная Excel-подобная таблица.
// • Настоящие ячейки с рамками, номера строк слева, «шапка» и первый столбец
//   закреплены (sticky).
// • Выделение диапазона ячеек и строк протягиванием мыши (как в Excel).
// • Копирование выделения (Ctrl+C) в буфер как TSV (вставляется в Excel).
// • Сортировка: клик по заголовку (Ctrl+клик — добавить столбец) и
//   многоуровневый диалог «Сортировка», предзаполняемый из выделения.
// • Редактирование ячейки по двойному клику → сохранение в Supabase.
// AG Grid Community не умеет выделять диапазон ячеек (это Enterprise), поэтому
// таблица реализована вручную.
// ============================================================================

interface GridColumn {
  colId: string;
  header: string;
  field?: keyof Certificate;
  value?: (c: Certificate) => string;
  editable: boolean;
  numeric: boolean;
  minWidth: number;
}

const COLUMNS: GridColumn[] = REGISTRY_COLUMNS.map((c) => ({
  colId: c.colId ?? (c.field as string),
  header: c.header,
  field: c.field,
  value: c.value,
  editable: !!c.editable,
  numeric: !!c.numeric,
  minWidth: c.minWidth ?? 100,
}));

const SORT_COLUMNS: SortColumn[] = COLUMNS.map((c) => ({
  colId: c.colId,
  header: c.header,
  numeric: c.numeric,
}));

/** Отображаемое значение ячейки (строкой). */
function cellText(row: Certificate, col: GridColumn): string {
  if (col.value) return col.value(row);
  const v = col.field ? row[col.field] : "";
  return v == null ? "" : String(v);
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function excelCell(value: string, numeric: boolean): string {
  const normalized = value.trim().replace(/\s+/g, "");
  const number = Number(normalized);
  const type = numeric && value.trim() !== "" && Number.isFinite(number) ? "Number" : "String";
  const data = type === "Number" ? String(number) : xmlEscape(value);
  return `<Cell><Data ss:Type="${type}">${data}</Data></Cell>`;
}

interface Cell {
  r: number;
  c: number;
}
interface Selection {
  a: Cell; // якорь
  f: Cell; // фокус
}

function bounds(sel: Selection) {
  return {
    minR: Math.min(sel.a.r, sel.f.r),
    maxR: Math.max(sel.a.r, sel.f.r),
    minC: Math.min(sel.a.c, sel.f.c),
    maxC: Math.max(sel.a.c, sel.f.c),
  };
}

export default function RegistryGrid() {
  const router = useRouter();
  const [rowData, setRowData] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [quick, setQuick] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortModel, setSortModel] = useState<SortLevel[]>([]);
  const [sel, setSel] = useState<Selection | null>(null);
  const [editing, setEditing] = useState<{ id: string; colId: string; value: string } | null>(
    null
  );
  const [sortOpen, setSortOpen] = useState(false);
  const [initialSort, setInitialSort] = useState<SortLevel[]>([]);

  const draggingRef = useRef(false);
  const dragModeRef = useRef<"cell" | "row" | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      toast("Supabase не настроен — задайте переменные окружения (.env.local)", "error");
      return;
    }
    setLoading(true);
    try {
      const rows = await listCertificates();
      setRowData(rows);
    } catch (e) {
      toast("Ошибка загрузки реестра: " + (e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Завершение протягивания в любом месте окна.
  useEffect(() => {
    const up = () => {
      draggingRef.current = false;
      dragModeRef.current = null;
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const activeFilterCount = useMemo(
    () => Object.values(columnFilters).filter((v) => v.trim() !== "").length,
    [columnFilters]
  );

  const setColumnFilter = (colId: string, value: string) => {
    setColumnFilters((prev) => {
      if (value === "") {
        const next = { ...prev };
        delete next[colId];
        return next;
      }
      return { ...prev, [colId]: value };
    });
  };

  const clearColumnFilters = () => {
    setColumnFilters({});
    toast("Фильтры по колонкам сброшены", "info");
  };

  // Фильтрация по общей строке поиска и по отдельным колонкам.
  const filtered = useMemo(() => {
    const q = quick.trim().toLowerCase();
    const filters = Object.entries(columnFilters)
      .map(([colId, value]) => [colId, value.trim().toLowerCase()] as const)
      .filter(([, value]) => value !== "");

    if (!q && filters.length === 0) return rowData;

    const colMap = new Map(COLUMNS.map((col) => [col.colId, col]));
    return rowData.filter((row) => {
      const matchesQuick =
        !q || COLUMNS.some((col) => cellText(row, col).toLowerCase().includes(q));
      if (!matchesQuick) return false;

      return filters.every(([colId, value]) => {
        const col = colMap.get(colId);
        return col ? cellText(row, col).toLowerCase().includes(value) : true;
      });
    });
  }, [rowData, quick, columnFilters]);

  // Сортировка по модели (многоуровневая).
  const rows = useMemo(() => {
    if (sortModel.length === 0) return filtered;
    const colMap = new Map(COLUMNS.map((c) => [c.colId, c]));
    const data = [...filtered];
    data.sort((a, b) => {
      for (const lvl of sortModel) {
        const col = colMap.get(lvl.colId);
        if (!col) continue;
        const dir = lvl.dir === "asc" ? 1 : -1;
        let cmp = 0;
        if (col.numeric) {
          // Через cellText — работает и для вычисляемых колонок (напр. «№ заявка»,
          // где значение берётся из basis_date_number, а не из отдельного поля).
          const num = (row: Certificate) => {
            const n = Number(cellText(row, col).replace(/\s+/g, ""));
            return Number.isFinite(n) ? n : 0;
          };
          cmp = num(a) - num(b);
        } else {
          cmp = cellText(a, col).localeCompare(cellText(b, col), "ru");
        }
        if (cmp !== 0) return dir * cmp;
      }
      return 0;
    });
    return data;
  }, [filtered, sortModel]);

  const stats = useMemo(() => {
    const count = rows.length;
    const sum = rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    return { count, sum };
  }, [rows]);

  // Сброс выделения, если данные изменились и индексы вышли за границы.
  useEffect(() => {
    if (sel && (sel.a.r >= rows.length || sel.f.r >= rows.length)) setSel(null);
  }, [rows.length, sel]);

  const isSel = (r: number, c: number) => {
    if (!sel) return false;
    const b = bounds(sel);
    return r >= b.minR && r <= b.maxR && c >= b.minC && c <= b.maxC;
  };

  // --- Мышь: выделение ячеек ---
  const onCellMouseDown = (r: number, c: number, e: React.MouseEvent) => {
    if (e.button !== 0 || editing) return;
    e.preventDefault();
    draggingRef.current = true;
    dragModeRef.current = "cell";
    setSel({ a: { r, c }, f: { r, c } });
  };
  const onCellMouseEnter = (r: number, c: number) => {
    if (!draggingRef.current) return;
    if (dragModeRef.current === "row") {
      setSel((s) => (s ? { a: { r: s.a.r, c: 0 }, f: { r, c: COLUMNS.length - 1 } } : s));
    } else {
      setSel((s) => (s ? { ...s, f: { r, c } } : s));
    }
  };

  // --- Мышь: выделение строк по номеру ---
  const onRowHeadMouseDown = (r: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    draggingRef.current = true;
    dragModeRef.current = "row";
    setSel({ a: { r, c: 0 }, f: { r, c: COLUMNS.length - 1 } });
  };

  // --- Сортировка кликом по заголовку (Ctrl+клик — многоуровневая) ---
  const onHeaderClick = (c: number, e: React.MouseEvent) => {
    const col = COLUMNS[c];
    setSortModel((prev) => {
      const existing = prev.find((l) => l.colId === col.colId);
      if (e.ctrlKey || e.metaKey) {
        // добавить/переключить в многоуровневой
        if (!existing) return [...prev, { colId: col.colId, dir: "asc" }];
        if (existing.dir === "asc")
          return prev.map((l) => (l.colId === col.colId ? { ...l, dir: "desc" } : l));
        return prev.filter((l) => l.colId !== col.colId);
      }
      // одиночная сортировка: asc → desc → нет
      if (!existing || prev.length > 1) return [{ colId: col.colId, dir: "asc" }];
      if (existing.dir === "asc") return [{ colId: col.colId, dir: "desc" }];
      return [];
    });
  };

  const sortIndicator = (colId: string) => {
    const idx = sortModel.findIndex((l) => l.colId === colId);
    if (idx < 0) return null;
    const arrow = sortModel[idx].dir === "asc" ? "▲" : "▼";
    return (
      <span className="xl-sort">
        {arrow}
        {sortModel.length > 1 ? <sup>{idx + 1}</sup> : null}
      </span>
    );
  };

  // --- Редактирование ячейки ---
  const startEdit = (row: Certificate, col: GridColumn) => {
    if (!col.editable || !col.field || !row.id) return;
    setEditing({ id: row.id, colId: col.colId, value: cellText(row, col) });
  };
  const commitEdit = async () => {
    if (!editing) return;
    const col = COLUMNS.find((c) => c.colId === editing.colId);
    const { id, value } = editing;
    setEditing(null);
    if (!col || !col.field) return;
    const row = rowData.find((r) => r.id === id);
    if (!row) return;
    if (cellText(row, col) === value) return; // без изменений
    let newValue: unknown = value;
    if (col.numeric) newValue = value === "" ? null : Number(value);
    setRowData((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [col.field as string]: newValue } : r))
    );
    try {
      await updateCertificate(id, { [col.field]: newValue } as Partial<Certificate>);
      toast("Ячейка обновлена", "success");
    } catch (e) {
      toast("Ошибка обновления: " + (e as Error).message, "error");
      load(); // откат — перезагрузка
    }
  };

  // --- Копирование выделения (Ctrl+C) ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C") && sel) {
        const b = bounds(sel);
        const lines: string[] = [];
        for (let r = b.minR; r <= b.maxR; r++) {
          const cells: string[] = [];
          for (let c = b.minC; c <= b.maxC; c++) {
            cells.push(cellText(rows[r], COLUMNS[c]));
          }
          lines.push(cells.join("\t"));
        }
        navigator.clipboard?.writeText(lines.join("\n")).then(
          () => toast("Скопировано в буфер обмена", "success"),
          () => {}
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, rows, editing]);

  // --- Выбранные строки (для операций) ---
  const selectedRows = useMemo(() => {
    if (!sel) return [] as Certificate[];
    const b = bounds(sel);
    const out: Certificate[] = [];
    for (let r = b.minR; r <= b.maxR && r < rows.length; r++) out.push(rows[r]);
    return out;
  }, [sel, rows]);

  // --- Итоги по выделенным ячейкам (как строка состояния в Excel) ---
  // Число распознаётся только если ВСЯ ячейка — число (Number), поэтому даты и
  // текст («23 июни 2026», «TJ.762…») не попадают в сумму.
  const selStats = useMemo(() => {
    if (!sel) return null;
    const b = bounds(sel);
    let cells = 0;
    let numeric = 0;
    let sum = 0;
    for (let r = b.minR; r <= b.maxR && r < rows.length; r++) {
      for (let c = b.minC; c <= b.maxC; c++) {
        const t = cellText(rows[r], COLUMNS[c]).trim();
        if (t === "") continue;
        cells++;
        const n = Number(t.replace(/\s+/g, ""));
        if (Number.isFinite(n)) {
          numeric++;
          sum += n;
        }
      }
    }
    return { cells, numeric, sum, avg: numeric ? sum / numeric : 0 };
  }, [sel, rows]);

  const showSelStats = !!selStats && (selStats.numeric > 0 || selStats.cells > 1);

  const openInEditor = (rec: Certificate | null) => {
    if (rec?.id) router.push(`/new?id=${rec.id}`);
  };

  const handleDelete = async () => {
    if (selectedRows.length === 0) return;
    const n = selectedRows.length;
    if (!window.confirm(`Удалить выбранные записи (${n}) из реестра?`)) return;
    try {
      const ids = selectedRows.map((r) => r.id).filter(Boolean) as string[];
      for (const id of ids) await deleteCertificate(id);
      setRowData((prev) => prev.filter((r) => !ids.includes(r.id as string)));
      setSel(null);
      toast(`Удалено записей: ${n}`, "success");
    } catch (e) {
      toast("Ошибка удаления: " + (e as Error).message, "error");
    }
  };

  // --- Экспорт Excel ---
  const handleExport = () => {
    const header = `<Row ss:StyleID="header">${COLUMNS.map((c) => excelCell(c.header, false)).join("")}</Row>`;
    const body = rows
      .map(
        (row) =>
          `<Row>${COLUMNS.map((c) => excelCell(cellText(row, c), c.numeric)).join("")}</Row>`
      )
      .join("");
    const widths = COLUMNS.map(
      (c) => `<Column ss:Width="${Math.max(80, Math.min(240, c.minWidth))}"/>`
    ).join("");
    const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="header">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#E8EEF7" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Реестр">
  <Table>${widths}${header}${body}</Table>
 </Worksheet>
</Workbook>`;
    const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reestr-sertifikatov.xls";
    a.click();
    URL.revokeObjectURL(url);
    toast(`Экспортировано строк: ${rows.length}`, "success");
  };

  // --- Сортировка через диалог ---
  const openSort = () => {
    let levels = sortModel;
    if (levels.length === 0 && sel) {
      const b = bounds(sel);
      levels = [];
      for (let c = b.minC; c <= b.maxC; c++) {
        levels.push({ colId: COLUMNS[c].colId, dir: "asc" });
      }
    }
    setInitialSort(levels);
    setSortOpen(true);
  };
  const applySort = (levels: SortLevel[]) => {
    setSortModel(levels);
    setSortOpen(false);
    toast(
      levels.length ? `Сортировка применена (уровней: ${levels.length})` : "Сортировка сброшена",
      "success"
    );
  };
  const clearSort = () => {
    setSortModel([]);
    toast("Сортировка сброшена", "info");
  };

  const handleCheckSupabase = async () => {
    const res = await testSupabaseConnection();
    toast(res.message, res.ok ? "success" : "error");
  };

  const anchorRow = sel ? rows[Math.min(sel.a.r, sel.f.r)] ?? null : null;

  return (
    <div className="no-print" style={{ padding: "16px 20px 40px" }}>
      {/* Панель инструментов */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, marginRight: 8, fontSize: 18 }}>Реестр сертификатов</h2>
        <input
          placeholder="🔍 Поиск по всем колонкам…"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 14,
            minWidth: 240,
          }}
        />
        <button className="btn btn-primary" onClick={openSort}>
          ⇅ Сортировка…
        </button>
        <button className="btn" onClick={clearSort} disabled={sortModel.length === 0}>
          ✖ Сбросить сортировку
        </button>
        <button className="btn" onClick={clearColumnFilters} disabled={activeFilterCount === 0}>
          Сбросить фильтры{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </button>
        <button className="btn" disabled={!anchorRow} onClick={() => openInEditor(anchorRow)}>
          📂 Открыть
        </button>
        <button
          className="btn btn-danger"
          disabled={selectedRows.length === 0}
          onClick={handleDelete}
        >
          🗑️ Удалить{selectedRows.length > 1 ? ` (${selectedRows.length})` : ""}
        </button>
        <button className="btn" onClick={handleExport}>⬇️ Экспорт Excel</button>
        <button className="btn" onClick={load}>🔄 Обновить</button>
        <button className="btn" onClick={handleCheckSupabase}>🔌 Проверить Supabase</button>
        <div style={{ marginLeft: "auto", fontSize: 14, color: "var(--muted)" }}>
          Всего: <b>{stats.count}</b> &nbsp;|&nbsp; Сумма:{" "}
          <b>{stats.sum.toLocaleString("ru-RU")}</b>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, color: "var(--muted)" }}>Загрузка данных…</div>
      ) : (
        <div className="xl-wrap" style={{ height: "calc(100vh - 200px)" }}>
          <table className="xl-table">
            <thead>
              <tr>
                <th className="xl-corner" />
                {COLUMNS.map((col, c) => (
                  <th
                    key={col.colId}
                    className="xl-head"
                    style={{ minWidth: col.minWidth }}
                    title={col.header}
                    onClick={(e) => onHeaderClick(c, e)}
                  >
                    <div className="xl-head-label">
                      <span className="xl-head-text">{col.header}</span>
                      {sortIndicator(col.colId)}
                    </div>
                    <input
                      className="xl-filter"
                      value={columnFilters[col.colId] ?? ""}
                      placeholder="Поиск"
                      aria-label={`Фильтр: ${col.header}`}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      onChange={(e) => setColumnFilter(col.colId, e.target.value)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={row.id ?? r}>
                  <th
                    className={"xl-rownum" + (sel && isSel(r, 0) ? " xl-rownum-sel" : "")}
                    onMouseDown={(e) => onRowHeadMouseDown(r, e)}
                    onDoubleClick={() => openInEditor(row)}
                    title="Клик — выделить строку; двойной клик — открыть"
                  >
                    {r + 1}
                  </th>
                  {COLUMNS.map((col, c) => {
                    const isEditing =
                      editing && editing.id === row.id && editing.colId === col.colId;
                    const selected = isSel(r, c);
                    const active = sel && sel.a.r === r && sel.a.c === c;
                    return (
                      <td
                        key={col.colId}
                        className={
                          "xl-cell" +
                          (col.numeric ? " xl-num" : "") +
                          (selected ? " sel" : "") +
                          (active ? " active" : "") +
                          (col.editable ? "" : " xl-readonly")
                        }
                        onMouseDown={(e) => onCellMouseDown(r, c, e)}
                        onMouseEnter={() => onCellMouseEnter(r, c)}
                        onDoubleClick={() => startEdit(row, col)}
                      >
                        {isEditing ? (
                          <input
                            className="xl-input"
                            autoFocus
                            type={col.numeric ? "number" : "text"}
                            value={editing!.value}
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setEditing((ed) => (ed ? { ...ed, value: e.target.value } : ed))
                            }
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              else if (e.key === "Escape") setEditing(null);
                            }}
                          />
                        ) : (
                          cellText(row, col)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="xl-empty" colSpan={COLUMNS.length + 1}>
                    Нет записей
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Строка состояния: итоги по выделенным ячейкам (как в Excel) */}
      {!loading && showSelStats && selStats && (
        <div className="xl-statusbar">
          <span>Выделено ячеек: <b>{selStats.cells}</b></span>
          {selStats.numeric > 0 && (
            <>
              <span className="xl-sep" />
              <span>Числовых: <b>{selStats.numeric}</b></span>
              <span className="xl-sep" />
              <span>Среднее: <b>{selStats.avg.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}</b></span>
              <span className="xl-sep" />
              <span className="xl-sum">Сумма: <b>{selStats.sum.toLocaleString("ru-RU")}</b></span>
            </>
          )}
        </div>
      )}

      <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
        Протяните мышью по ячейкам, чтобы выделить диапазон; тяните по номерам строк слева — чтобы
        выделять строки. Ctrl+C — копировать выделение (вставляется в Excel). Поля в заголовках
        фильтруют каждую колонку отдельно. «Сортировка…» —
        многоуровневая (предзаполняется из выделения). Выделите числовые ячейки (напр. столбец
        «Сумма») — снизу появится их сумма, среднее и количество. Клик по заголовку сортирует столбец,
        Ctrl+клик — добавляет к сортировке. Двойной клик по ячейке — редактирование; по номеру строки
        — открыть сертификат.
      </p>

      <SortDialog
        open={sortOpen}
        columns={SORT_COLUMNS}
        initial={initialSort}
        onApply={applySort}
        onClose={() => setSortOpen(false)}
      />
    </div>
  );
}
