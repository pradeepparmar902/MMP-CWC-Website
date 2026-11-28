import React, { useEffect, useRef, useState } from "react";

export default function MultiSelectFilter({
  label,
  options = [], // array of { value, label, count } or strings
  selected = [], // array of selected string values (empty array = All)
  onChange,
  allLabel = "All"
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const normalized = options.map((o) =>
    typeof o === "string" ? { value: o, label: o, count: null } : o
  );

  const filtered = q.trim()
    ? normalized.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase()))
    : normalized;

  const selectedSet = new Set(selected.map((v) => String(v).toUpperCase()));

  const toggleVal = (val) => {
    const key = String(val).toUpperCase();
    if (selectedSet.has(key)) {
      onChange(selected.filter((v) => String(v).toUpperCase() !== key));
    } else {
      onChange([...selected, val]);
    }
  };

  const selectAllVisible = () => {
    const next = [...selected];
    const existing = new Set(next.map((v) => String(v).toUpperCase()));
    for (const o of filtered) {
      if (!existing.has(String(o.value).toUpperCase())) {
        next.push(o.value);
        existing.add(String(o.value).toUpperCase());
      }
    }
    onChange(next);
  };

  const clearAll = () => onChange([]);

  const summaryText =
    selected.length === 0
      ? allLabel
      : selected.length === 1
      ? selected[0]
      : `${selected.length} Selected`;

  return (
    <div className="mat-field mat-ms-wrap" ref={ref}>
      <label className="mat-label">{label}</label>
      <button
        type="button"
        className={`mat-ms-trigger ${selected.length > 0 ? "has-val" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="mat-ms-text" title={selected.join(", ")}>
          {summaryText}
        </span>
        <span className="mat-ms-caret">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mat-ms-menu">
          {normalized.length > 5 && (
            <div className="mat-ms-search-wrap">
              <input
                type="text"
                className="mat-input"
                style={{ padding: "6px 8px", fontSize: "0.78rem" }}
                placeholder={`Search ${label}...`}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className="mat-ms-actions">
            <button type="button" className="mat-ms-link" onClick={selectAllVisible}>
              Select All
            </button>
            <button type="button" className="mat-ms-link danger" onClick={clearAll}>
              Clear ({selected.length})
            </button>
          </div>

          <div className="mat-ms-list">
            {filtered.length === 0 ? (
              <div style={{ padding: "10px 8px", fontSize: "0.76rem", color: "#64748B", textAlign: "center" }}>
                No options
              </div>
            ) : (
              filtered.map((opt) => {
                const checked = selectedSet.has(String(opt.value).toUpperCase());
                return (
                  <label key={opt.value} className={`mat-ms-option ${checked ? "checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleVal(opt.value)}
                    />
                    <span className="mat-ms-opt-label">{opt.label}</span>
                    {opt.count !== null && opt.count !== undefined && (
                      <span className="mat-ms-opt-count">{opt.count}</span>
                    )}
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
