"use client";

import { useEffect, useState } from "react";

// ============================================================================
// Диалог многоуровневой сортировки — как окно «Сортировка» в Excel, но на
// русском. Позволяет добавлять уровни (Сортировать по / Затем по), выбирать
// столбец, тип сортировки (значения ячеек) и порядок. Применяется к таблице
// реестра (AG Grid) через applyColumnState.
// ============================================================================

export interface SortColumn {
  colId: string;
  header: string;
  numeric?: boolean;
}

export interface SortLevel {
  colId: string;
  dir: "asc" | "desc";
}

interface Props {
  open: boolean;
  columns: SortColumn[];
  initial: SortLevel[];
  onApply: (levels: SortLevel[]) => void;
  onClose: () => void;
}

function orderOptions(numeric?: boolean) {
  return numeric
    ? [
        { value: "asc", label: "По возрастанию (0 → 9)" },
        { value: "desc", label: "По убыванию (9 → 0)" },
      ]
    : [
        { value: "asc", label: "От А до Я" },
        { value: "desc", label: "От Я до А" },
      ];
}

export default function SortDialog({ open, columns, initial, onApply, onClose }: Props) {
  const [levels, setLevels] = useState<SortLevel[]>([]);
  const [selected, setSelected] = useState(0);
  const [hasHeaders, setHasHeaders] = useState(true);

  // При открытии — подставить текущую сортировку или один пустой уровень.
  useEffect(() => {
    if (!open) return;
    const start =
      initial.length > 0
        ? initial
        : [{ colId: columns[0]?.colId ?? "", dir: "asc" as const }];
    setLevels(start);
    setSelected(0);
  }, [open, initial, columns]);

  if (!open) return null;

  const usedFirstColIds = new Set(levels.map((l) => l.colId));
  const firstFree = columns.find((c) => !usedFirstColIds.has(c.colId)) ?? columns[0];

  const addLevel = () => {
    setLevels((ls) => [...ls, { colId: firstFree?.colId ?? "", dir: "asc" }]);
    setSelected(levels.length);
  };
  const deleteLevel = () => {
    if (levels.length <= 1) return;
    setLevels((ls) => ls.filter((_, i) => i !== selected));
    setSelected((s) => Math.max(0, s - 1));
  };
  const copyLevel = () => {
    setLevels((ls) => {
      const copy = { ...ls[selected] };
      const next = [...ls];
      next.splice(selected + 1, 0, copy);
      return next;
    });
    setSelected((s) => s + 1);
  };
  const move = (dir: -1 | 1) => {
    setLevels((ls) => {
      const j = selected + dir;
      if (j < 0 || j >= ls.length) return ls;
      const next = [...ls];
      [next[selected], next[j]] = [next[j], next[selected]];
      return next;
    });
    setSelected((s) => Math.min(levels.length - 1, Math.max(0, s + dir)));
  };
  const setLevel = (i: number, patch: Partial<SortLevel>) => {
    setLevels((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const colOf = (colId: string) => columns.find((c) => c.colId === colId);

  return (
    <div className="sort-overlay" onMouseDown={onClose}>
      <div className="sort-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sort-titlebar">
          <span>Сортировка</span>
          <button className="sort-x" onClick={onClose} title="Закрыть">
            ✕
          </button>
        </div>

        <div className="sort-tools">
          <button className="btn btn-sm" onClick={addLevel}>
            ➕ Добавить уровень
          </button>
          <button className="btn btn-sm" onClick={deleteLevel} disabled={levels.length <= 1}>
            ✖ Удалить уровень
          </button>
          <button className="btn btn-sm" onClick={copyLevel}>
            📋 Копировать уровень
          </button>
          <button className="btn btn-sm" onClick={() => move(-1)} disabled={selected <= 0} title="Вверх">
            ▲
          </button>
          <button
            className="btn btn-sm"
            onClick={() => move(1)}
            disabled={selected >= levels.length - 1}
            title="Вниз"
          >
            ▼
          </button>
          <label className="sort-headers">
            <input
              type="checkbox"
              checked={hasHeaders}
              onChange={(e) => setHasHeaders(e.target.checked)}
            />
            Мои данные содержат заголовки
          </label>
        </div>

        <div className="sort-grid">
          <div className="sort-grid-head">
            <div>Столбец</div>
            <div>Сортировка</div>
            <div>Порядок</div>
          </div>
          {levels.map((lvl, i) => {
            const col = colOf(lvl.colId);
            return (
              <div
                key={i}
                className={"sort-row" + (i === selected ? " sort-row-selected" : "")}
                onMouseDown={() => setSelected(i)}
              >
                <div className="sort-cell">
                  <span className="sort-prefix">{i === 0 ? "Сортировать по" : "Затем по"}</span>
                  <select
                    value={lvl.colId}
                    onChange={(e) => setLevel(i, { colId: e.target.value })}
                  >
                    {columns.map((c) => (
                      <option key={c.colId} value={c.colId}>
                        {c.header}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sort-cell">
                  <select disabled value="values">
                    <option value="values">Значения ячеек</option>
                  </select>
                </div>
                <div className="sort-cell">
                  <select
                    value={lvl.dir}
                    onChange={(e) => setLevel(i, { dir: e.target.value as "asc" | "desc" })}
                  >
                    {orderOptions(col?.numeric).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sort-footer">
          <button className="btn btn-primary" onClick={() => onApply(levels)}>
            OK
          </button>
          <button className="btn" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
