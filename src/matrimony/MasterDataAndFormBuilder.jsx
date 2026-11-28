import React, { useEffect, useMemo, useState } from "react";
import { dedupeSortedList, parseCsvOrExcelTable } from "./matrimonyApi";
import ColumnHeaderFilter, { ActiveTableFiltersBar, useTableFilterSort } from "./ColumnHeaderFilter";

const MASTER_LIST_LABELS = {
  surnames: { label: "Surnames", icon: "🏷️", profileField: "surname" },
  nativeVillages: { label: "Native Villages (Vatan)", icon: "🏡", profileField: "nativeVillage" },
  educations: { label: "Educations", icon: "🎓", profileField: "education" },
  occupations: { label: "Occupations", icon: "💼", profileField: "occupation" },
  cities: { label: "Current Cities", icon: "📍", profileField: "city" },
  heights: { label: "Heights", icon: "📏", profileField: "height" },
  maritalStatuses: { label: "Marital Statuses", icon: "💍", profileField: "maritalStatus" },
  diets: { label: "Diets", icon: "🥗", profileField: "diet" },
  incomes: { label: "Annual Incomes", icon: "💰", profileField: "income" },
  gotras: { label: "Gotra / Kuldevi", icon: "🙏", profileField: "gotra" },
  managedBys: { label: "Profile Managed By", icon: "👨‍👩‍👧", profileField: "managedBy" }
};

export default function MasterDataAndFormBuilder({
  masterData = {},
  masterTables = {},
  supportTables = [],
  profiles = [],
  saving = false,
  onSaveMasterData,
  onSaveMasterTables,
  onSaveSupportTables
}) {
  // Opened workspace: null (grid overview) | { kind: "master", key } | { kind: "support", id }
  const [openedWorkspace, setOpenedWorkspace] = useState(null);

  // Master Table editor state
  const [newValueInput, setNewValueInput] = useState("");
  const [rowDraft, setRowDraft] = useState({});
  const [tableSearch, setTableSearch] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  // Create new custom Master List / Upload new Support CSV-Excel Table modals
  const [showNewMasterBox, setShowNewMasterBox] = useState(false);
  const [newListName, setNewListName] = useState("");

  const [showUploadSupportBox, setShowUploadSupportBox] = useState(false);
  const [tableNameInput, setTableNameInput] = useState("");
  const [pendingUpload, setPendingUpload] = useState(null);

  const flashMsg = (msg) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(""), 4000);
  };

  const deletedBuiltInKeys = useMemo(
    () => (Array.isArray(masterTables?.__deletedBuiltInKeys) ? masterTables.__deletedBuiltInKeys : []),
    [masterTables]
  );

  const allMasterKeys = useMemo(() => {
    const deletedSet = new Set(deletedBuiltInKeys);
    const builtIn = Object.keys(MASTER_LIST_LABELS).filter((k) => !deletedSet.has(k));
    const custom = Array.from(
      new Set([...Object.keys(masterData || {}), ...Object.keys(masterTables || {})])
    )
      .filter((k) => k !== "__deletedBuiltInKeys" && !MASTER_LIST_LABELS[k])
      .sort();
    return [...builtIn, ...custom];
  }, [masterData, masterTables, deletedBuiltInKeys]);

  const getMasterDisplay = (key) => {
    if (MASTER_LIST_LABELS[key]) return MASTER_LIST_LABELS[key];
    const pretty = String(key || "")
      .replace(/^custom_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { label: pretty, icon: "📂", profileField: null };
  };

  const getMasterTableView = (key) => {
    const tbl = masterTables?.[key];
    if (tbl && Array.isArray(tbl.columns) && tbl.columns.length > 0 && Array.isArray(tbl.rows)) {
      return tbl;
    }
    const colLabel = getMasterDisplay(key).label;
    const vals = Array.isArray(masterData?.[key]) ? masterData[key] : [];
    return {
      columns: [colLabel],
      primaryColumn: colLabel,
      rows: vals.map((v) => ({ [colLabel]: v }))
    };
  };

  // Currently opened Master or Support table object
  const activeMasterKey = openedWorkspace?.kind === "master" ? openedWorkspace.key : null;
  const activeMasterTable = useMemo(
    () => (activeMasterKey ? getMasterTableView(activeMasterKey) : null),
    [activeMasterKey, masterTables, masterData]
  );

  const activeSupportTable = useMemo(() => {
    if (openedWorkspace?.kind !== "support") return null;
    return supportTables.find((t) => t.id === openedWorkspace.id) || null;
  }, [openedWorkspace, supportTables]);

  const activeTableObj = activeMasterTable || activeSupportTable;

  const filteredRows = useMemo(() => {
    if (!activeTableObj) return [];
    const rows = activeTableObj.rows || [];
    const q = tableSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (activeTableObj.columns || []).some((c) => String(r?.[c] || "").toLowerCase().includes(q))
    );
  }, [activeTableObj, tableSearch]);

  const masterTableGetters = useMemo(() => {
    const map = {};
    for (const col of activeTableObj?.columns || []) {
      map[col] = (row) => row?.[col] || "";
    }
    return map;
  }, [activeTableObj]);

  const masterTableState = useTableFilterSort(filteredRows, masterTableGetters);

  useEffect(() => {
    masterTableState.clearAll();
  }, [openedWorkspace?.kind, openedWorkspace?.id]);

  // ── GLOBAL ACTIONS (Sync, Create Master List, Upload Support CSV/Excel) ──
  const handleSyncFromProfiles = async () => {
    const next = { ...masterData };
    let totalAdded = 0;
    for (const [mKey, meta] of Object.entries(MASTER_LIST_LABELS)) {
      if (!meta.profileField) continue;
      const existing = Array.isArray(next[mKey]) ? next[mKey] : [];
      const fromProfiles = (profiles || []).map((p) => p?.[meta.profileField]).filter(Boolean);
      const merged = dedupeSortedList([...existing, ...fromProfiles]);
      totalAdded += merged.length - existing.length;
      next[mKey] = merged;
    }
    await onSaveMasterData(next);
    flashMsg(
      totalAdded > 0
        ? `Synced ${totalAdded} new distinct value(s) from submitted profiles into Master Data!`
        : "Master Data is already 100% up-to-date with all submitted profiles."
    );
  };

  const handleCreateCustomMasterList = async (e) => {
    e.preventDefault();
    const clean = newListName.trim();
    if (!clean) return;
    const key = `custom_${clean.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    if (!masterData[key]) {
      await onSaveMasterData({ ...masterData, [key]: [] });
    }
    setShowNewMasterBox(false);
    setNewListName("");
    setOpenedWorkspace({ kind: "master", key });
    setTableSearch("");
    setRowDraft({});
    flashMsg(`Created Master Table "${clean}". Add rows or import a CSV/Excel file!`);
  };

  const handleUploadNewSupportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = await parseCsvOrExcelTable(file);
      const baseName = file.name.replace(/\.(xlsx|xls|csv)$/i, "").replace(/[_-]+/g, " ").trim();
      if (!tableNameInput.trim()) setTableNameInput(baseName || "Support Table");
      setPendingUpload({
        columns: parsed.columns,
        rows: parsed.rows,
        primaryColumn: parsed.columns[0]
      });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleConfirmSaveSupportTable = async () => {
    if (!pendingUpload || !tableNameInput.trim()) return;
    const pCol = pendingUpload.primaryColumn || pendingUpload.columns[0];
    const seen = new Set();
    const dedupedRows = [];
    for (const r of pendingUpload.rows) {
      const key = String(r[pCol] || "").trim().toUpperCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      dedupedRows.push(r);
    }
    const newTable = {
      id: `st_${Date.now()}`,
      name: tableNameInput.trim(),
      columns: pendingUpload.columns,
      primaryColumn: pCol,
      rows: dedupedRows
    };
    await onSaveSupportTables([...supportTables, newTable]);
    setPendingUpload(null);
    setTableNameInput("");
    setShowUploadSupportBox(false);
    setOpenedWorkspace({ kind: "support", id: newTable.id });
    setTableSearch("");
    setRowDraft({});
    flashMsg(`Imported Support Table "${newTable.name}" (${dedupedRows.length} unique rows)!`);
  };

  const handleDownloadSampleCsv = () => {
    const csv =
      "Location,Area,Zone\nLokhandwala,Andheri,Western\nHiranandani,Powai,Central\nBandra West,Bandra,Western\nThane West,Thane,Central\nVashi Sector 17,Navi Mumbai,Harbour\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Sample_Location_Area_Table.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── OPENED WORKSPACE ACTIONS (Master OR Support Table) ──
  const handleAddMasterSingleValues = async (e) => {
    e.preventDefault();
    if (!activeMasterKey || !newValueInput.trim()) return;
    const rawItems = newValueInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!rawItems.length) return;
    const currentVals = Array.isArray(masterData?.[activeMasterKey]) ? masterData[activeMasterKey] : [];
    const merged = dedupeSortedList([...currentVals, ...rawItems]);
    const added = merged.length - currentVals.length;
    await onSaveMasterData({ ...masterData, [activeMasterKey]: merged });
    setNewValueInput("");
    flashMsg(added > 0 ? `Added ${added} unique value(s)!` : "Value(s) already exist.");
  };

  const handleAddMultiColRow = async (e) => {
    e.preventDefault();
    if (!activeTableObj) return;
    const cols = activeTableObj.columns;
    const pCol = activeTableObj.primaryColumn;
    const pVal = String(rowDraft[pCol] || "").trim();
    if (!pVal) return;

    const cleanRow = {};
    cols.forEach((c) => {
      cleanRow[c] = String(rowDraft[c] || "").trim();
    });

    const nextRows = [
      cleanRow,
      ...(activeTableObj.rows || []).filter(
        (r) => String(r?.[pCol] || "").trim().toUpperCase() !== pVal.toUpperCase()
      )
    ].sort((a, b) => String(a[pCol] || "").localeCompare(String(b[pCol] || "")));

    if (activeMasterKey) {
      const nextMasterData = {
        ...masterData,
        [activeMasterKey]: dedupeSortedList(nextRows.map((r) => r[pCol]))
      };
      const nextMasterTables = {
        ...masterTables,
        [activeMasterKey]: { ...activeMasterTable, rows: nextRows }
      };
      if (onSaveMasterTables) await onSaveMasterTables(nextMasterTables, nextMasterData);
      else await onSaveMasterData(nextMasterData);
    } else if (activeSupportTable) {
      const nextTables = supportTables.map((t) =>
        t.id === activeSupportTable.id ? { ...t, rows: nextRows } : t
      );
      await onSaveSupportTables(nextTables);
    }
    setRowDraft({});
    flashMsg(`Saved row "${pVal}"!`);
  };

  const handleImportCsvIntoOpenedTable = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeTableObj) return;
    try {
      const parsed = await parseCsvOrExcelTable(file);
      const firstCol = parsed.columns[0];

      if (activeMasterKey) {
        const existingTbl = masterTables?.[activeMasterKey];
        const mergedCols =
          existingTbl && existingTbl.columns?.length > 1
            ? Array.from(new Set([...existingTbl.columns, ...parsed.columns]))
            : parsed.columns;
        const pCol = existingTbl && existingTbl.columns?.length > 1 ? existingTbl.primaryColumn : firstCol;

        const rowMap = new Map();
        if (existingTbl && Array.isArray(existingTbl.rows)) {
          for (const r of existingTbl.rows) {
            const k = String(r?.[pCol] || "").trim().toUpperCase();
            if (k) rowMap.set(k, r);
          }
        } else {
          const vals = Array.isArray(masterData?.[activeMasterKey]) ? masterData[activeMasterKey] : [];
          for (const v of vals) {
            const k = String(v || "").trim().toUpperCase();
            if (k) rowMap.set(k, { [pCol]: v });
          }
        }

        for (const r of parsed.rows) {
          const val = String(r?.[firstCol] || "").trim();
          if (!val) continue;
          const k = val.toUpperCase();
          rowMap.set(k, { ...(rowMap.get(k) || {}), ...r, [pCol]: val });
        }

        const finalRows = Array.from(rowMap.values()).sort((a, b) =>
          String(a[pCol] || "").localeCompare(String(b[pCol] || ""))
        );
        const nextMasterData = {
          ...masterData,
          [activeMasterKey]: dedupeSortedList(finalRows.map((r) => r[pCol]))
        };
        const nextMasterTables = {
          ...masterTables,
          [activeMasterKey]: { columns: mergedCols, primaryColumn: pCol, rows: finalRows }
        };
        if (onSaveMasterTables) await onSaveMasterTables(nextMasterTables, nextMasterData);
        else await onSaveMasterData(nextMasterData);
        flashMsg(`Imported "${file.name}" (${finalRows.length} rows, ${mergedCols.length} column(s))!`);
      } else if (activeSupportTable) {
        const pCol = activeSupportTable.primaryColumn;
        const mergedCols = Array.from(new Set([...activeSupportTable.columns, ...parsed.columns]));
        const rowMap = new Map();
        for (const r of activeSupportTable.rows || []) {
          const k = String(r?.[pCol] || "").trim().toUpperCase();
          if (k) rowMap.set(k, r);
        }
        let added = 0;
        for (const r of parsed.rows) {
          const k = String(r?.[pCol] || r?.[firstCol] || "").trim().toUpperCase();
          if (!k) continue;
          if (!rowMap.has(k)) added++;
          rowMap.set(k, { ...(rowMap.get(k) || {}), ...r });
        }
        const nextTables = supportTables.map((t) =>
          t.id === activeSupportTable.id
            ? { ...t, columns: mergedCols, rows: Array.from(rowMap.values()) }
            : t
        );
        await onSaveSupportTables(nextTables);
        flashMsg(`Updated "${activeSupportTable.name}" with ${added} new row(s)!`);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteRow = async (primaryVal) => {
    if (!activeTableObj) return;
    const keyUpper = String(primaryVal || "").trim().toUpperCase();
    const pCol = activeTableObj.primaryColumn;

    if (activeMasterKey) {
      const currentVals = Array.isArray(masterData?.[activeMasterKey]) ? masterData[activeMasterKey] : [];
      const nextVals = currentVals.filter((v) => String(v || "").trim().toUpperCase() !== keyUpper);
      const existingTbl = masterTables?.[activeMasterKey];
      if (existingTbl && Array.isArray(existingTbl.rows) && onSaveMasterTables) {
        const nextRows = existingTbl.rows.filter(
          (r) => String(r?.[pCol] || "").trim().toUpperCase() !== keyUpper
        );
        await onSaveMasterTables(
          { ...masterTables, [activeMasterKey]: { ...existingTbl, rows: nextRows } },
          { ...masterData, [activeMasterKey]: nextVals }
        );
      } else {
        await onSaveMasterData({ ...masterData, [activeMasterKey]: nextVals });
      }
    } else if (activeSupportTable) {
      const nextTables = supportTables.map((t) =>
        t.id === activeSupportTable.id
          ? {
              ...t,
              rows: (t.rows || []).filter(
                (r) => String(r?.[pCol] || "").trim().toUpperCase() !== keyUpper
              )
            }
          : t
      );
      await onSaveSupportTables(nextTables);
    }
  };

  const handleClearRowsOnly = async () => {
    if (!activeMasterKey) return;
    const label = getMasterDisplay(activeMasterKey).label;
    if (!window.confirm(`Clear all rows in "${label}"?`)) return;
    const nextMD = { ...masterData, [activeMasterKey]: [] };
    const nextMT = { ...masterTables };
    delete nextMT[activeMasterKey];
    if (onSaveMasterTables) await onSaveMasterTables(nextMT, nextMD);
    else await onSaveMasterData(nextMD);
    flashMsg(`Cleared all rows in "${label}".`);
  };

  const handleClearOrDeleteTable = async () => {
    if (activeMasterKey) {
      const label = getMasterDisplay(activeMasterKey).label;
      if (!window.confirm(`Delete table "${label}" from Master Data Workspace?`)) return;
      const nextMD = { ...masterData };
      const nextMT = { ...masterTables };
      delete nextMT[activeMasterKey];
      if (MASTER_LIST_LABELS[activeMasterKey]) {
        nextMD[activeMasterKey] = [];
        nextMT.__deletedBuiltInKeys = Array.from(new Set([...deletedBuiltInKeys, activeMasterKey]));
      } else {
        delete nextMD[activeMasterKey];
      }
      if (onSaveMasterTables) await onSaveMasterTables(nextMT, nextMD);
      else await onSaveMasterData(nextMD);
      setOpenedWorkspace(null);
      flashMsg(`Deleted table "${label}".`);
    } else if (activeSupportTable) {
      if (!window.confirm(`Delete Support Table "${activeSupportTable.name}"?`)) return;
      await onSaveSupportTables(supportTables.filter((t) => t.id !== activeSupportTable.id));
      setOpenedWorkspace(null);
      flashMsg(`Deleted Support Table "${activeSupportTable.name}".`);
    }
  };

  const handleRestoreDeletedBuiltIn = async (keyToRestore) => {
    const nextMT = {
      ...masterTables,
      __deletedBuiltInKeys: deletedBuiltInKeys.filter((k) => k !== keyToRestore)
    };
    if (onSaveMasterTables) await onSaveMasterTables(nextMT, masterData);
    setOpenedWorkspace({ kind: "master", key: keyToRestore });
    flashMsg(`Restored "${getMasterDisplay(keyToRestore).label}" table!`);
  };

  const handleExportOpenedCsv = () => {
    if (!activeTableObj) return;
    const cols = activeTableObj.columns || [];
    const escapeCsv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      cols.map(escapeCsv).join(","),
      ...(activeTableObj.rows || []).map((r) => cols.map((c) => escapeCsv(r?.[c] || "")).join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const baseName = activeMasterKey || (activeSupportTable?.name || "support_table").replace(/\s+/g, "_");
    a.download = `${baseName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── UNIFIED SPLIT WORKSPACE: LEFT TABLE LIST (ALWAYS VISIBLE) + RIGHT OPENED TABLE PANEL ──
  const renderOpenedTablePanel = () => {
    if (!openedWorkspace || !activeTableObj) {
      return (
        <div
          style={{
            background: "#F8FAFC",
            border: "2px dashed #CBD5E1",
            borderRadius: 14,
            padding: "48px 24px",
            textAlign: "center",
            color: "#64748B"
          }}
        >
          <div style={{ fontSize: "2.2rem", marginBottom: 8 }}>📚</div>
          <div style={{ fontWeight: 700, color: "#0D4B5E", fontSize: "0.98rem", marginBottom: 6 }}>
            Select any Master Table or Support Table on the left
          </div>
          <div style={{ fontSize: "0.82rem" }}>
            Click any table card to view, search, add rows, or import CSV/Excel — you can switch directly between tables anytime!
          </div>
        </div>
      );
    }

    const title = activeMasterKey
      ? `${getMasterDisplay(activeMasterKey).icon} ${getMasterDisplay(activeMasterKey).label}`
      : `📊 ${activeSupportTable.name}`;
    const isMultiCol = (activeTableObj.columns || []).length > 1;
    const secondaryCols = (activeTableObj.columns || []).filter((c) => c !== activeTableObj.primaryColumn);

    return (
      <div
        className="mat-card"
        style={{
          marginBottom: 0,
          borderTop: `4px solid ${activeSupportTable ? "#15803D" : "#0D4B5E"}`
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            paddingBottom: 14,
            marginBottom: 14,
            borderBottom: "1px solid #E2E8F0"
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.08rem", color: "#0D4B5E" }}>{title}</div>
            <div style={{ fontSize: "0.78rem", color: "#475569" }}>
              {(activeTableObj.rows || []).length} unique row(s) • {activeTableObj.columns.length} column(s)
              {isMultiCol && (
                <span style={{ color: "#15803D", fontWeight: 700, marginLeft: 8 }}>
                  ({activeTableObj.primaryColumn} → {secondaryCols.join(", ")})
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <label className="mat-btn mat-btn-success mat-btn-sm" style={{ cursor: "pointer", margin: 0 }}>
              📥 Import / Append CSV-Excel
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: "none" }}
                onChange={handleImportCsvIntoOpenedTable}
              />
            </label>
            <button type="button" className="mat-btn mat-btn-outline mat-btn-sm" onClick={handleExportOpenedCsv}>
              📤 Export CSV
            </button>
            {activeMasterKey && (
              <button
                type="button"
                className="mat-btn mat-btn-outline mat-btn-sm"
                onClick={handleClearRowsOnly}
                title="Empty all rows while keeping the table"
              >
                🧹 Clear Rows
              </button>
            )}
            <button
              type="button"
              className="mat-btn mat-btn-danger mat-btn-sm"
              onClick={handleClearOrDeleteTable}
            >
              🗑️ Delete Table
            </button>
            <button
              type="button"
              className="mat-btn mat-btn-outline mat-btn-sm"
              onClick={() => {
                setOpenedWorkspace(null);
                setTableSearch("");
                setRowDraft({});
              }}
              title="Close this table"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Add Row Bar */}
        {isMultiCol ? (
          <form
            onSubmit={handleAddMultiColRow}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}
          >
            {activeTableObj.columns.map((col) => (
              <div key={col} className="mat-field" style={{ flex: 1, minWidth: 150 }}>
                <label className="mat-label">
                  {col} {col === activeTableObj.primaryColumn ? "*" : ""}
                </label>
                <input
                  className="mat-input"
                  required={col === activeTableObj.primaryColumn}
                  placeholder={`Enter ${col}`}
                  value={rowDraft[col] || ""}
                  onChange={(e) => setRowDraft({ ...rowDraft, [col]: e.target.value })}
                />
              </div>
            ))}
            <button type="submit" className="mat-btn mat-btn-teal" disabled={saving}>
              + Add Row
            </button>
          </form>
        ) : (
          <form onSubmit={handleAddMasterSingleValues} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <input
              className="mat-input"
              style={{ flex: 1, minWidth: "min(100%, 200px)" }}
              placeholder="Add one or more values separated by commas (e.g. Value 1, Value 2)..."
              value={newValueInput}
              onChange={(e) => setNewValueInput(e.target.value)}
            />
            <button type="submit" className="mat-btn mat-btn-teal" disabled={saving}>
              + Add Unique Value(s)
            </button>
          </form>
        )}

        {/* Search Box */}
        <div style={{ marginBottom: 10 }}>
          <input
            className="mat-input"
            style={{ maxWidth: 360, padding: "8px 11px", fontSize: "0.82rem" }}
            placeholder={`Search ${(activeTableObj.rows || []).length} rows across all columns...`}
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
          />
        </div>

        {/* Active Column Filters / Sort Bar */}
        <ActiveTableFiltersBar tableState={masterTableState} />

        {/* Full Scrollable Table */}
        {masterTableState.rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: 28, color: "#64748B", fontSize: "0.84rem" }}>
            No rows found. Add rows above or click <strong>📥 Import / Append CSV-Excel</strong>.
          </div>
        ) : (
          <div className="mat-table-wrap" style={{ maxHeight: 480 }}>
            <table className="mat-table">
              <thead>
                <tr>
                  <th style={{ width: 52 }}>#</th>
                  {activeTableObj.columns.map((col) => (
                    <th key={col}>
                      <ColumnHeaderFilter
                        label={`${col}${col === activeTableObj.primaryColumn && isMultiCol ? " ⭐" : ""}`}
                        colKey={col}
                        tableState={masterTableState}
                      />
                    </th>
                  ))}
                  <th style={{ width: 74 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {masterTableState.rows.map((row, idx) => {
                  const pVal = row?.[activeTableObj.primaryColumn] || "";
                  return (
                    <tr key={`${pVal}_${idx}`}>
                      <td style={{ color: "#64748B", fontSize: "0.78rem" }}>{idx + 1}</td>
                      {activeTableObj.columns.map((col) => (
                        <td
                          key={col}
                          style={{
                            fontWeight: col === activeTableObj.primaryColumn ? 700 : 400,
                            color: col === activeTableObj.primaryColumn ? "#0D4B5E" : "#1E293B"
                          }}
                        >
                          {row?.[col] || "-"}
                        </td>
                      ))}
                      <td>
                        <button
                          type="button"
                          className="mat-btn mat-btn-danger mat-btn-sm"
                          onClick={() => handleDeleteRow(pVal)}
                          title={`Delete ${pVal}`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Top Action Header */}
      <div className="mat-card" style={{ borderTop: "4px solid #0D4B5E", marginBottom: 16 }}>
        <h3 className="mat-card-title">
          <span>📚 Master Data &amp; Support Tables Workspace</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="mat-btn mat-btn-outline mat-btn-sm"
              disabled={saving}
              onClick={handleSyncFromProfiles}
            >
              ✨ Sync from Profiles
            </button>
            <button
              type="button"
              className="mat-btn mat-btn-teal mat-btn-sm"
              onClick={() => {
                setShowUploadSupportBox(false);
                setShowNewMasterBox((p) => !p);
              }}
            >
              + New Master Table
            </button>
            <button
              type="button"
              className="mat-btn mat-btn-success mat-btn-sm"
              onClick={() => {
                setShowNewMasterBox(false);
                setShowUploadSupportBox((p) => !p);
              }}
            >
              📤 Upload CSV / Excel Table
            </button>
          </div>
        </h3>
        <p className="mat-card-sub" style={{ marginBottom: statusMsg || showNewMasterBox || showUploadSupportBox ? 12 : 0 }}>
          Click any table card to open or switch instantly without closing. To add or edit fields on the registration form, use <strong>+ Add New Field</strong> or <strong>⚙️ Edit / Reorder Fields</strong> inside <strong>📝 Submit Biodata</strong>.
        </p>

        {statusMsg && (
          <div
            style={{
              background: "#DCFCE7",
              color: "#166534",
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: "0.82rem",
              fontWeight: 700,
              marginBottom: 10
            }}
          >
            ✓ {statusMsg}
          </div>
        )}

        {showNewMasterBox && (
          <form
            onSubmit={handleCreateCustomMasterList}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              background: "#FFFBEB",
              border: "1px solid #FCD34D",
              padding: 12,
              borderRadius: 10,
              marginBottom: 10
            }}
          >
            <input
              className="mat-input"
              style={{ maxWidth: 280 }}
              placeholder="New Master Table Name (e.g. Rashi / Manglik)"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              required
            />
            <button type="submit" className="mat-btn mat-btn-teal mat-btn-sm" disabled={saving}>
              Create &amp; Open
            </button>
            <button
              type="button"
              className="mat-btn mat-btn-outline mat-btn-sm"
              onClick={() => setShowNewMasterBox(false)}
            >
              Cancel
            </button>
          </form>
        )}

        {showUploadSupportBox && (
          <div
            style={{
              background: "#F0FDF4",
              border: "1px dashed #86EFAC",
              borderRadius: 10,
              padding: 14
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="mat-field" style={{ flex: 1, minWidth: 200 }}>
                <label className="mat-label">Support Table Name</label>
                <input
                  className="mat-input"
                  placeholder="e.g. Surname Data / Mumbai Locations"
                  value={tableNameInput}
                  onChange={(e) => setTableNameInput(e.target.value)}
                />
              </div>
              <label className="mat-btn mat-btn-success" style={{ cursor: "pointer", margin: 0 }}>
                📤 Choose CSV / Excel File
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  style={{ display: "none" }}
                  onChange={handleUploadNewSupportFile}
                />
              </label>
              <button type="button" className="mat-btn mat-btn-outline mat-btn-sm" onClick={handleDownloadSampleCsv}>
                📥 Sample CSV
              </button>
            </div>

            {pendingUpload && (
              <div
                style={{
                  marginTop: 12,
                  background: "#FFFFFF",
                  border: "1px solid #BBF7D0",
                  borderRadius: 10,
                  padding: 12
                }}
              >
                <div style={{ fontWeight: 700, color: "#166534", marginBottom: 8, fontSize: "0.86rem" }}>
                  ✅ Parsed {pendingUpload.rows.length} row(s) • Columns: {pendingUpload.columns.join(" • ")}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Primary Dropdown Column:</span>
                  <select
                    className="mat-select"
                    style={{ width: "auto", padding: "5px 10px" }}
                    value={pendingUpload.primaryColumn}
                    onChange={(e) => setPendingUpload({ ...pendingUpload, primaryColumn: e.target.value })}
                  >
                    {pendingUpload.columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="mat-btn mat-btn-success mat-btn-sm"
                    disabled={saving || !tableNameInput.trim()}
                    onClick={handleConfirmSaveSupportTable}
                  >
                    💾 Save &amp; Open Table
                  </button>
                  <button
                    type="button"
                    className="mat-btn mat-btn-outline mat-btn-sm"
                    onClick={() => setPendingUpload(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Split Workspace: Left Table Switcher + Right Active Table */}
      <div className="mat-workspace-split">
        {/* Left Sidebar: Always-Visible Clickable Table Cards */}
        <div className="mat-card mat-workspace-sidebar">
          {supportTables.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "#15803D", marginBottom: 8, textTransform: "uppercase" }}>
                📊 Support Tables ({supportTables.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {supportTables.map((tbl) => {
                  const isSelected = openedWorkspace?.kind === "support" && openedWorkspace.id === tbl.id;
                  const secCols = (tbl.columns || []).filter((c) => c !== tbl.primaryColumn);
                  return (
                    <button
                      key={tbl.id}
                      type="button"
                      onClick={() => {
                        setOpenedWorkspace({ kind: "support", id: tbl.id });
                        setTableSearch("");
                        setRowDraft({});
                      }}
                      style={{
                        textAlign: "left",
                        width: "100%",
                        background: isSelected ? "#DCFCE7" : "#F0FDF4",
                        border: isSelected ? "2px solid #15803D" : "1px solid #86EFAC",
                        borderRadius: 10,
                        padding: "9px 11px",
                        cursor: "pointer",
                        fontFamily: "inherit"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: "0.84rem", color: "#166534" }}>
                          📊 {tbl.name}
                        </span>
                        <span className="mat-badge approved">{(tbl.rows || []).length}</span>
                      </div>
                      <div style={{ fontSize: "0.71rem", color: "#334155", marginTop: 2 }}>
                        {tbl.primaryColumn}
                        {secCols.length > 0 ? ` → ${secCols.join(", ")}` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "#0D4B5E", marginBottom: 8, textTransform: "uppercase" }}>
            📚 Master Data Tables ({allMasterKeys.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {allMasterKeys.map((key) => {
              const meta = getMasterDisplay(key);
              const tblView = getMasterTableView(key);
              const rowCount = (tblView.rows || []).length;
              const colCount = (tblView.columns || []).length;
              const isSelected = openedWorkspace?.kind === "master" && openedWorkspace.key === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setOpenedWorkspace({ kind: "master", key });
                    setTableSearch("");
                    setRowDraft({});
                  }}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    background: isSelected ? "#FFFBEB" : "#FFFFFF",
                    border: isSelected ? "2px solid #D97706" : "1px solid #CBD5E1",
                    borderRadius: 10,
                    padding: "9px 11px",
                    cursor: "pointer",
                    fontFamily: "inherit"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.83rem", color: isSelected ? "#92400E" : "#0D4B5E" }}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className="mat-badge male">{rowCount}</span>
                  </div>
                  {colCount > 1 && (
                    <div style={{ fontSize: "0.7rem", color: "#15803D", marginTop: 2, fontWeight: 600 }}>
                      {colCount} cols: {tblView.primaryColumn} →{" "}
                      {tblView.columns.filter((c) => c !== tblView.primaryColumn).join(", ")}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {deletedBuiltInKeys.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px dashed #CBD5E1" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748B", marginBottom: 6 }}>
                Deleted Default Tables (click to restore):
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {deletedBuiltInKeys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="mat-btn mat-btn-outline mat-btn-sm"
                    style={{ padding: "2px 7px", fontSize: "0.7rem" }}
                    onClick={() => handleRestoreDeletedBuiltIn(k)}
                  >
                    ↺ {getMasterDisplay(k).label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Active Table Editor */}
        <div>{renderOpenedTablePanel()}</div>
      </div>
    </div>
  );
}
