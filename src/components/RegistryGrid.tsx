"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  GridReadyEvent,
  CellValueChangedEvent,
  SelectionChangedEvent,
  RowDoubleClickedEvent,
  GridApi,
  ValueGetterParams,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import { toast } from "./Toast";
import { Certificate, REGISTRY_COLUMNS, issueDate } from "../lib/certificate";
import {
  listCertificates,
  updateCertificate,
  deleteCertificate,
} from "../lib/certificateStore";
import { isSupabaseConfigured } from "../lib/supabaseClient";

export default function RegistryGrid() {
  const router = useRouter();
  const gridApiRef = useRef<GridApi | null>(null);
  const [rowData, setRowData] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Certificate | null>(null);
  const [quick, setQuick] = useState("");
  const [stats, setStats] = useState({ count: 0, sum: 0 });

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

  const columnDefs = useMemo<ColDef[]>(() => {
    return REGISTRY_COLUMNS.map((col) => {
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
    const rows = e.api.getSelectedRows();
    setSelected(rows[0] ?? null);
  };

  const openInEditor = (rec: Certificate | null) => {
    if (rec?.id) router.push(`/new?id=${rec.id}`);
  };

  const onRowDoubleClicked = (e: RowDoubleClickedEvent<Certificate>) => {
    openInEditor(e.data ?? null);
  };

  const handleDelete = async () => {
    if (!selected?.id) return;
    if (!window.confirm("Удалить выбранный сертификат из реестра?")) return;
    try {
      await deleteCertificate(selected.id);
      const rows = rowData.filter((r) => r.id !== selected.id);
      setRowData(rows);
      recomputeStats(rows);
      setSelected(null);
      toast("Запись удалена", "success");
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
        <button className="btn btn-primary" disabled={!selected} onClick={() => openInEditor(selected)}>
          📂 Открыть
        </button>
        <button className="btn btn-danger" disabled={!selected} onClick={handleDelete}>
          🗑️ Удалить
        </button>
        <button className="btn" onClick={handleExport}>⬇️ Экспорт CSV</button>
        <button className="btn" onClick={load}>🔄 Обновить</button>
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
            rowSelection="single"
            animateRows
            onGridReady={onGridReady}
            onCellValueChanged={onCellValueChanged}
            onSelectionChanged={onSelectionChanged}
            onRowDoubleClicked={onRowDoubleClicked}
            stopEditingWhenCellsLoseFocus
            enableCellTextSelection
            tooltipShowDelay={300}
          />
        </div>
      )}
      <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
        Двойной клик по строке открывает сертификат для редактирования. Столбцы можно сортировать,
        фильтровать, менять ширину, перемещать и закреплять через меню столбца. «Дата выдачи»
        вычисляется из даты «Эътибор дорад аз» и редактируется в самом сертификате.
      </p>
    </div>
  );
}
