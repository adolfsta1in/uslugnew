"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  ColumnState,
  GridReadyEvent,
  CellValueChangedEvent,
  CellFocusedEvent,
  SelectionChangedEvent,
  RowDoubleClickedEvent,
  GridApi,
  ValueGetterParams,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import { toast } from "./Toast";
import SortDialog, { SortColumn, SortLevel } from "./SortDialog";
import { Certificate, REGISTRY_COLUMNS, issueDate } from "../lib/certificate";
import {
  listCertificates,
  updateCertificate,
  deleteCertificate,
} from "../lib/certificateStore";
import { isSupabaseConfigured, testSupabaseConnection } from "../lib/supabaseClient";

export default function RegistryGrid() {
  const router = useRouter();
  const gridApiRef = useRef<GridApi | null>(null);
  const [rowData, setRowData] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Certificate[]>([]);
  const [quick, setQuick] = useState("");
  const [stats, setStats] = useState({ count: 0, sum: 0 });
  const [sortOpen, setSortOpen] = useState(false);
  const [initialSort, setInitialSort] = useState<SortLevel[]>([]);
  const focusedColRef = useRef<string | null>(null);

  const selected = selectedRows[0] ?? null;

  const recomputeStats = useCallback((rows: Certificate[]) => {
    const count = rows.length;
    const sum = rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    setStats({ count, sum });
  }, []);

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
      recomputeStats(rows);
    } catch (e) {
      toast("Ошибка загрузки реестра: " + (e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [recomputeStats]);

  useEffect(() => {
    load();
  }, [load]);

  // Столбцы, доступные для сортировки (для диалога «Сортировка»).
  const sortableColumns = useMemo<SortColumn[]>(
    () =>
      REGISTRY_COLUMNS.map((c) => ({
        colId: c.computed === "issue_date" ? "issue_date" : (c.field as string),
        header: c.header,
        numeric: !!c.numeric,
      })),
    []
  );

  const columnDefs = useMemo<ColDef[]>(() => {
    return REGISTRY_COLUMNS.map((col, idx) => {
      const def: ColDef = {
        headerName: col.header,
        editable: col.editable ?? false,
        minWidth: col.minWidth,
        filter: true,
        floatingFilter: true,
        sortable: true,
        resizable: true,
        headerTooltip: col.header,
      };
      // Первый столбец получает чекбоксы выделения строк (как в Excel слева).
      if (idx === 0) {
        def.checkboxSelection = true;
        def.headerCheckboxSelection = true;
        def.headerCheckboxSelectionFilteredOnly = true;
      }
      if (col.computed === "issue_date") {
        def.colId = "issue_date";
        def.valueGetter = (p: ValueGetterParams) =>
          p.data ? issueDate(p.data as Certificate) : "";
      } else if (col.field) {
        def.field = col.field as string;
        if (col.numeric) {
          def.filter = "agNumberColumnFilter";
          def.type = "numericColumn";
        }
      }
      return def;
    });
  }, []);

  const defaultColDef = useMemo<ColDef>(
    () => ({
      flex: 1,
      minWidth: 100,
      // pinning/move/resize доступны в Community через меню столбца
    }),
    []
  );

  const onGridReady = (e: GridReadyEvent) => {
    gridApiRef.current = e.api;
  };

  const onCellValueChanged = async (e: CellValueChangedEvent<Certificate>) => {
    const field = e.colDef.field as keyof Certificate | undefined;
    const id = e.data.id;
    if (!field || !id) return;
    try {
      let value: unknown = e.newValue;
      if (field === "amount") value = value === "" || value == null ? null : Number(value);
      await updateCertificate(id, { [field]: value } as Partial<Certificate>);
      recomputeStats(rowData);
      toast("Ячейка обновлена", "success");
    } catch (err) {
      toast("Ошибка обновления: " + (err as Error).message, "error");
      // откат значения в таблице
      e.node.setDataValue(field as string, e.oldValue);
    }
  };

  const onSelectionChanged = (e: SelectionChangedEvent<Certificate>) => {
    setSelectedRows(e.api.getSelectedRows());
  };

  const onCellFocused = (e: CellFocusedEvent) => {
    const col = e.column;
    focusedColRef.current =
      typeof col === "string" ? col : col ? col.getColId() : null;
  };

  const openInEditor = (rec: Certificate | null) => {
    if (rec?.id) router.push(`/new?id=${rec.id}`);
  };

  const onRowDoubleClicked = (e: RowDoubleClickedEvent<Certificate>) => {
    openInEditor(e.data ?? null);
  };

  const handleDelete = async () => {
    if (selectedRows.length === 0) return;
    const n = selectedRows.length;
    if (!window.confirm(`Удалить выбранные записи (${n}) из реестра?`)) return;
    try {
      const ids = selectedRows.map((r) => r.id).filter(Boolean) as string[];
      for (const id of ids) {
        await deleteCertificate(id);
      }
      const rows = rowData.filter((r) => !ids.includes(r.id as string));
      setRowData(rows);
      recomputeStats(rows);
      setSelectedRows([]);
      toast(`Удалено записей: ${n}`, "success");
    } catch (e) {
      toast("Ошибка удаления: " + (e as Error).message, "error");
    }
  };

  const handleExport = () => {
    gridApiRef.current?.exportDataAsCsv({ fileName: "reestr-sertifikatov.csv" });
  };

  const onQuickChange = (v: string) => {
    setQuick(v);
    gridApiRef.current?.setGridOption("quickFilterText", v);
  };

  // --- Сортировка (Excel-подобный диалог) ---
  const openSort = () => {
    const api = gridApiRef.current;
    let levels: SortLevel[] = [];
    if (api) {
      levels = api
        .getColumnState()
        .filter((s) => s.sort)
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
        .map((s) => ({ colId: s.colId, dir: s.sort as "asc" | "desc" }));
    }
    // Если сортировки ещё нет — подставим столбец сфокусированной ячейки.
    if (levels.length === 0 && focusedColRef.current) {
      const known = sortableColumns.find((c) => c.colId === focusedColRef.current);
      if (known) levels = [{ colId: known.colId, dir: "asc" }];
    }
    setInitialSort(levels);
    setSortOpen(true);
  };

  const applySort = (levels: SortLevel[]) => {
    const api = gridApiRef.current;
    if (api) {
      const state: ColumnState[] = levels.map((l, i) => ({
        colId: l.colId,
        sort: l.dir,
        sortIndex: i,
      }));
      api.applyColumnState({ state, defaultState: { sort: null } });
    }
    setSortOpen(false);
    toast(
      levels.length ? `Сортировка применена (уровней: ${levels.length})` : "Сортировка сброшена",
      "success"
    );
  };

  const clearSort = () => {
    gridApiRef.current?.applyColumnState({ defaultState: { sort: null } });
    toast("Сортировка сброшена", "info");
  };

  const handleCheckSupabase = async () => {
    const res = await testSupabaseConnection();
    toast(res.message, res.ok ? "success" : "error");
  };

  return (
    <div className="no-print" style={{ padding: "16px 20px 40px" }}>
      {/* Панель инструментов реестра */}
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
          onChange={(e) => onQuickChange(e.target.value)}
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
        <button className="btn" onClick={clearSort}>
          ✖ Сбросить сортировку
        </button>
        <button className="btn" disabled={!selected} onClick={() => openInEditor(selected)}>
          📂 Открыть
        </button>
        <button
          className="btn btn-danger"
          disabled={selectedRows.length === 0}
          onClick={handleDelete}
        >
          🗑️ Удалить{selectedRows.length > 1 ? ` (${selectedRows.length})` : ""}
        </button>
        <button className="btn" onClick={handleExport}>⬇️ Экспорт CSV</button>
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
        <div className="ag-theme-quartz" style={{ height: "calc(100vh - 180px)", width: "100%" }}>
          <AgGridReact<Certificate>
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            suppressRowClickSelection
            multiSortKey="ctrl"
            animateRows
            onGridReady={onGridReady}
            onCellValueChanged={onCellValueChanged}
            onSelectionChanged={onSelectionChanged}
            onCellFocused={onCellFocused}
            onRowDoubleClicked={onRowDoubleClicked}
            stopEditingWhenCellsLoseFocus
            enableCellTextSelection
            ensureDomOrder
            tooltipShowDelay={300}
          />
        </div>
      )}
      <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
        Выделяйте ячейки мышью, копируйте (Ctrl+C). Флажки слева выделяют строки (можно несколько —
        затем «Открыть»/«Удалить»). Кнопка «Сортировка…» открывает многоуровневую сортировку как в
        Excel. Клик по заголовку сортирует столбец, Ctrl+клик — добавляет столбец к сортировке.
        Двойной клик по строке открывает сертификат. «Дата выдачи» вычисляется из даты «Эътибор дорад
        аз».
      </p>

      <SortDialog
        open={sortOpen}
        columns={sortableColumns}
        initial={initialSort}
        onApply={applySort}
        onClose={() => setSortOpen(false)}
      />
    </div>
  );
}
