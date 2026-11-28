import React, { useEffect, useMemo, useRef, useState } from "react";

const normalizeVal = (v) => {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ").trim();
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v).trim();
};

const compareSmart = (aVal, bVal, dir = "asc") => {
  const aStr = normalizeVal(aVal);
  const bStr = normalizeVal(bVal);
  if (!aStr && !bStr) return 0;
  if (!aStr) return 1;
  if (!bStr) return -1;

  const aNum = Number(aStr);
  const bNum = Number(bStr);
  const bothNumeric =
    aStr !== "" && bStr !== "" && !Number.isNaN(aNum) && !Number.isNaN(bNum) && /^-?\d+(\.\d+)?$/.test(aStr) && /^-?\d+(\.\d+)?$/.test(bStr);

  let cmp = 0;
  if (bothNumeric) {
    cmp = aNum - bNum;
  } else {
    cmp = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" });
  }
  return dir === "desc" ? -cmp : cmp;
};

export function useTableFilterSort(rows = [], getters = {}) {
  const [colFilters, setColFilters] = useState({});
  const [sort, setSort] = useState({ key: null, dir: "asc" });

  const getVal = (row, colKey) => {
    const fn = getters?.[colKey];
    if (typeof fn === "function") return normalizeVal(fn(row));
    return normalizeVal(row?.[colKey]);
  };

  const setColFilter = (colKey, selectedValues) => {
    setColFilters((prev) => {
      const next = { ...prev };
      if (!selectedValues || selectedValues.length === 0) {
        delete next[colKey];
      } else {
        next[colKey] = selectedValues;
      }
      return next;
    });
  };

  const toggleSort = (colKey) => {
    setSort((prev) => {
      if (prev.key !== colKey) return { key: colKey, dir: "asc" };
      if (prev.dir === "asc") return { key: colKey, dir: "desc" };
      return { key: null, dir: "asc" };
    });
  };

  const setSortDir = (colKey, dir) => {
    if (!dir) {
      setSort({ key: null, dir: "asc" });
    } else {
      setSort({ key: colKey, dir });
    }
  };

  const clearAll = () => {
    setColFilters({});
    setSort({ key: null, dir: "asc" });
  };

  const activeFilterKeys = Object.keys(colFilters).filter(
    (k) => Array.isArray(colFilters[k]) && colFilters[k].length > 0
  );
  const hasActive = activeFilterKeys.length > 0 || Boolean(sort.key);

  const processedRows = useMemo(() => {
    let list = Array.isArray(rows) ? rows : [];
    if (activeFilterKeys.length > 0) {
      list = list.filter((row) =>
        activeFilterKeys.every((k) => {
          const allowed = new Set(colFilters[k].map((v) => String(v).toLowerCase()));
          const val = getVal(row, k) || "(Blank)";
          return allowed.has(val.toLowerCase());
        })
      );
    }
    if (sort.key) {
      list = [...list].sort((a, b) => compareSmart(getVal(a, sort.key), getVal(b, sort.key), sort.dir));
    }
    return list;
  }, [rows, colFilters, sort, getters]);

  const getColumnOptions = (colKey) => {
    const otherKeys = activeFilterKeys.filter((k) => k !== colKey);
    const base =
      otherKeys.length > 0
        ? (rows || []).filter((row) =>
            otherKeys.every((k) => {
              const allowed = new Set(colFilters[k].map((v) => String(v).toLowerCase()));
              const val = getVal(row, k) || "(Blank)";
              return allowed.has(val.toLowerCase());
            })
          )
        : rows || [];

    const counts = new Map();
    for (const row of base) {
      const val = getVal(row, colKey) || "(Blank)";
      counts.set(val, (counts.get(val) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => compareSmart(a.value, b.value, "asc"));
  };

  return {
    rows: processedRows,
    colFilters,
    sort,
    hasActive,
    setColFilter,
    toggleSort,
    setSortDir,
    clearAll,
    getColumnOptions
  };
}

export function ActiveTableFiltersBar({ tableState, labels = {} }) {
  if (!tableState?.hasActive) return null;
  const activeKeys = Object.keys(tableState.colFilters || {}).filter(
    (k) => Array.isArray(tableState.colFilters[k]) && tableState.colFilters[k].length > 0
  );

  return (
    <div className="mat-tbl-active-bar">
      <span className="mat-tbl-active-label">Active Filters / Sort:</span>
      {tableState.sort?.key && (
        <span className="mat-tbl-chip sort">
          Sort: {labels[tableState.sort.key] || tableState.sort.key}{" "}
          {tableState.sort.dir === "asc" ? "▲" : "▼"}
          <button
            type="button"
            className="mat-tbl-chip-x"
            onClick={() => tableState.setSortDir(null, null)}
            title="Clear Sort"
          >
            ✕
          </button>
        </span>
      )}
      {activeKeys.map((k) => {
        const vals = tableState.colFilters[k];
        const txt = vals.length === 1 ? vals[0] : `${vals.length} selected`;
        return (
          <span key={k} className="mat-tbl-chip">
            {labels[k] || k}: <strong>{txt}</strong>
            <button
              type="button"
              className="mat-tbl-chip-x"
              onClick={() => tableState.setColFilter(k, [])}
              title={`Clear ${labels[k] || k} filter`}
            >
              ✕
            </button>
          </span>
        );
      })}
      <button type="button" className="mat-tbl-reset-btn" onClick={tableState.clearAll}>
        Reset All
      </button>
    </div>
  );
}

export default function ColumnHeaderFilter({
  label,
  colKey,
  tableState,
  disableFilter = false,
  disableSort = false
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const selected = tableState?.colFilters?.[colKey] || [];
  const isSorted = tableState?.sort?.key === colKey;
  const sortDir = isSorted ? tableState.sort.dir : null;

  const options = useMemo(() => {
    if (!open || disableFilter || !tableState) return [];
    return tableState.getColumnOptions(colKey);
  }, [open, disableFilter, tableState, colKey]);

  const filteredOpts = useMemo(() => {
    if (!q.trim()) return options;
    const ql = q.trim().toLowerCase();
    return options.filter((o) => o.value.toLowerCase().includes(ql));
  }, [options, q]);

  const selectedSet = new Set(selected.map((v) => String(v).toLowerCase()));

  const handleToggleOpen = (e) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuW = 230;
      const menuH = 310;
      let left = rect.left;
      if (left + menuW > window.innerWidth - 10) {
        left = Math.max(10, window.innerWidth - menuW - 10);
      }
      let top = rect.bottom + 4;
      if (top + menuH > window.innerHeight - 10) {
        top = Math.max(10, rect.top - menuH - 4);
      }
      setMenuPos({ top, left });
      setQ("");
    }
    setOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const handleScrollOrResize = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  const toggleVal = (val) => {
    const lower = String(val).toLowerCase();
    if (selectedSet.has(lower)) {
      tableState.setColFilter(
        colKey,
        selected.filter((v) => String(v).toLowerCase() !== lower)
      );
    } else {
      tableState.setColFilter(colKey, [...selected, val]);
    }
  };

  const selectAllVisible = () => {
    const next = [...selected];
    const existing = new Set(next.map((v) => String(v).toLowerCase()));
    for (const o of filteredOpts) {
      if (!existing.has(o.value.toLowerCase())) {
        next.push(o.value);
        existing.add(o.value.toLowerCase());
      }
    }
    tableState.setColFilter(colKey, next);
  };

  return (
    <div className="mat-th-inner">
      <button
        type="button"
        className="mat-th-sort-btn"
        disabled={disableSort}
        onClick={() => !disableSort && tableState.toggleSort(colKey)}
        title={disableSort ? label : `Click to sort by ${label}`}
      >
        <span>{label}</span>
        {!disableSort && (
          <span className={`mat-th-sort-icon ${isSorted ? "active" : ""}`}>
            {sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : "↕"}
          </span>
        )}
      </button>

      {!disableFilter && (
        <button
          ref={btnRef}
          type="button"
          className={`mat-th-filter-btn ${selected.length > 0 ? "filtered" : ""}`}
          onClick={handleToggleOpen}
          title={`Filter / Sort ${label}`}
        >
          ▾{selected.length > 0 ? ` ${selected.length}` : ""}
        </button>
      )}

      {open && (
        <div
          ref={menuRef}
          className="mat-th-popover"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {!disableSort && (
            <div className="mat-th-pop-sort">
              <button
                type="button"
                className={`mat-th-pop-sort-btn ${sortDir === "asc" ? "active" : ""}`}
                onClick={() => {
                  tableState.setSortDir(colKey, "asc");
                  setOpen(false);
                }}
              >
                ▲ Sort A → Z
              </button>
              <button
                type="button"
                className={`mat-th-pop-sort-btn ${sortDir === "desc" ? "active" : ""}`}
                onClick={() => {
                  tableState.setSortDir(colKey, "desc");
                  setOpen(false);
                }}
              >
                ▼ Sort Z → A
              </button>
            </div>
          )}

          <div className="mat-ms-search-wrap">
            <input
              type="text"
              className="mat-input"
              style={{ padding: "5px 8px", fontSize: "0.78rem" }}
              placeholder={`Filter ${label}...`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="mat-ms-actions">
            <button type="button" className="mat-ms-link" onClick={selectAllVisible}>
              Select All
            </button>
            <button
              type="button"
              className="mat-ms-link danger"
              onClick={() => tableState.setColFilter(colKey, [])}
            >
              Clear ({selected.length})
            </button>
          </div>

          <div className="mat-ms-list" style={{ maxHeight: 170 }}>
            {filteredOpts.length === 0 ? (
              <div style={{ padding: "10px 8px", fontSize: "0.75rem", color: "#64748B", textAlign: "center" }}>
                No values
              </div>
            ) : (
              filteredOpts.map((opt) => {
                const checked = selectedSet.has(opt.value.toLowerCase());
                return (
                  <label key={opt.value} className={`mat-ms-option ${checked ? "checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleVal(opt.value)}
                    />
                    <span className="mat-ms-opt-label" title={opt.value}>
                      {opt.value}
                    </span>
                    <span className="mat-ms-opt-count">{opt.count}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
