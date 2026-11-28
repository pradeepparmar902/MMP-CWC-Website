import React, { useEffect, useMemo, useState } from "react";
import "./matrimony.css";
import { MATRIMONY_TRANSLATIONS } from "./translations";
import MultiSelectFilter from "./MultiSelectFilter";
import MasterDataAndFormBuilder from "./MasterDataAndFormBuilder";
import ColumnHeaderFilter, { ActiveTableFiltersBar, useTableFilterSort } from "./ColumnHeaderFilter";
import { UserLoginModal } from "../CharitableTrust";
import {
  DEFAULT_MASTER_DATA,
  DEFAULT_MATRIMONY_DATA,
  DUMMY_CONTACT_REQUESTS,
  DUMMY_MATRIMONY_PROFILES,
  calculateAge,
  downloadProfilesImportTemplate,
  expandCustomFieldDescriptors,
  exportDirectoryPdf,
  exportMasterExcel,
  exportSingleBiodataPdf,
  exportSurnameSummaryExcel,
  generateNextProfileId,
  getMatrimonyStorageInfo,
  getStoredAdminAuth,
  importProfilesFromSpreadsheet,
  loadMatrimonyData,
  saveMatrimonyData,
  signInMatrimonyAdmin,
  signOutMatrimonyAdmin,
  uploadMatrimonyPhoto
} from "./matrimonyApi";

const AGE_BUCKETS = [
  { id: "18-23", label: "18 - 23", min: 18, max: 23 },
  { id: "24-27", label: "24 - 27", min: 24, max: 27 },
  { id: "28-31", label: "28 - 31", min: 28, max: 31 },
  { id: "32-35", label: "32 - 35", min: 32, max: 35 },
  { id: "36+", label: "36+", min: 36, max: 120 }
];

const CORE_LOCKED_FIELDS = new Set(["fullName", "surname", "gender", "dob", "mobile"]);

const DEFAULT_SECTION_FIELD_ORDER = {
  personal: ["fullName", "surname", "gender", "dob", "height", "maritalStatus", "diet", "photo"],
  community: ["nativeVillage", "mosal", "gotra", "city", "isNri"],
  career: ["education", "occupation", "company", "income"],
  family: ["fatherName", "motherName", "siblings", "managedBy", "mobile", "email"],
  extra: []
};

const EMPTY_FORM = {
  fullName: "",
  surname: "",
  gender: "Male",
  dob: "",
  height: "",
  maritalStatus: "Never Married",
  diet: "Vegetarian",
  photo: "",
  nativeVillage: "",
  mosal: "",
  gotra: "",
  city: "",
  isNri: false,
  education: "",
  occupation: "",
  company: "",
  income: "",
  fatherName: "",
  motherName: "",
  siblings: "",
  managedBy: "Parent",
  mobile: "",
  email: "",
  notes: "",
  paymentUtr: "",
  customFields: {}
};

// Reusable Master-Data-powered Dropdown with optional Admin-controlled "Other" free-text input
function MasterSelectInput({
  value,
  onChange,
  options = [],
  required = false,
  placeholder = "Select...",
  allowOther = false
}) {
  const list = Array.isArray(options) ? options : [];
  const rawVal = String(value || "");
  const cleanVal = rawVal.replace(/\s*\*$/, "").trim();
  const matchedOption = list.find((opt) => opt.toLowerCase() === cleanVal.toLowerCase()) || "";
  const isInList = !cleanVal || Boolean(matchedOption);
  const [otherSelected, setOtherSelected] = useState(false);

  useEffect(() => {
    if (!allowOther && otherSelected) setOtherSelected(false);
  }, [allowOther, otherSelected]);

  const showFreeBox = allowOther && (otherSelected || (!isInList && cleanVal !== ""));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <select
        className="mat-select"
        required={required && !showFreeBox}
        value={showFreeBox ? "__OTHER__" : matchedOption || (!allowOther ? rawVal : "")}
        onChange={(e) => {
          if (e.target.value === "__OTHER__") {
            setOtherSelected(true);
            onChange("");
          } else {
            setOtherSelected(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">-- {placeholder} --</option>
        {list.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        {!allowOther && !isInList && cleanVal && <option value={rawVal}>{rawVal}</option>}
        {allowOther && <option value="__OTHER__">Other</option>}
      </select>
      {showFreeBox && (
        <div>
          <input
            className="mat-input"
            required={required}
            value={rawVal.replace(/\s*\*$/, "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter other ${placeholder.toLowerCase()}...`}
          />
          <div style={{ fontSize: "0.7rem", color: "#92400E", marginTop: 3, fontWeight: 600 }}>
            * Custom &quot;Other&quot; entry will be saved with a <strong>*</strong> mark
          </div>
        </div>
      )}
    </div>
  );
}

export default function MatrimonyPage({ onBack }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem("matrimony_lang") || "en";
    } catch {
      return "en";
    }
  });
  const t = MATRIMONY_TRANSLATIONS[lang] || MATRIMONY_TRANSLATIONS.en;

  const [store, setStore] = useState(DEFAULT_MATRIMONY_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Admin auth
  const [adminAuth, setAdminAuth] = useState(() => getStoredAdminAuth());
  const isAdmin = Boolean(adminAuth);

  // Public Member Auth (reuses main portal's SMS OTP UserLoginModal & session)
  const [publicAuthToken, setPublicAuthToken] = useState(() => {
    try {
      return localStorage.getItem("trustPublicAuthToken") || "";
    } catch {
      return "";
    }
  });
  const [publicUser, setPublicUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("trustPublicProfile") || "null");
    } catch {
      return null;
    }
  });
  const [showPublicLogin, setShowPublicLogin] = useState(false);
  const [pendingLoginAction, setPendingLoginAction] = useState(null);
  const isPublicLoggedIn = Boolean(publicAuthToken && publicUser);
  const isAuthenticatedForAction = isAdmin || isPublicLoggedIn;

  const handlePublicLoginSuccess = (token, profile) => {
    setPublicAuthToken(token || "");
    setPublicUser(profile || null);
    try {
      if (token) localStorage.setItem("trustPublicAuthToken", token);
      if (profile) localStorage.setItem("trustPublicProfile", JSON.stringify(profile));
    } catch {
      // ignore storage errors
    }
    // Pre-fill mobile/email in biodata form if currently blank
    setForm((prev) => ({
      ...prev,
      mobile: prev.mobile || profile?.mobile || "",
      email: prev.email || profile?.email || ""
    }));
    // Execute pending action (e.g. Request Info or Submit Biodata) immediately after login
    if (pendingLoginAction?.type === "request" && pendingLoginAction.profile) {
      setContactModalProfile(pendingLoginAction.profile);
      setContactSent(false);
      setContactForm((prev) => ({
        ...prev,
        name: prev.name || profile?.name || "",
        mobile: prev.mobile || profile?.mobile || ""
      }));
    } else if (pendingLoginAction?.type === "register") {
      setActiveTab("register");
    }
    setPendingLoginAction(null);
    setShowPublicLogin(false);
  };

  const handlePublicLogout = () => {
    setPublicAuthToken("");
    setPublicUser(null);
    try {
      localStorage.removeItem("trustPublicAuthToken");
      localStorage.removeItem("trustPublicProfile");
    } catch {
      // ignore
    }
  };

  // Active tab
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mobileTabsExpanded, setMobileTabsExpanded] = useState(false);

  // Public / Directory filters (multi-select arrays; empty = All)
  const [filterGender, setFilterGender] = useState("All");
  const [filterAgeBuckets, setFilterAgeBuckets] = useState([]);
  const [filterMinAge, setFilterMinAge] = useState("");
  const [filterMaxAge, setFilterMaxAge] = useState("");
  const [filterSurnames, setFilterSurnames] = useState([]);
  const [filterEducations, setFilterEducations] = useState([]);
  const [filterOccupations, setFilterOccupations] = useState([]);
  const [filterCities, setFilterCities] = useState([]);
  const [filterVillages, setFilterVillages] = useState([]);
  const [filterMaritals, setFilterMaritals] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Admin filters
  const [adminStatusFilter, setAdminStatusFilter] = useState("all");
  const [adminGenderFilter, setAdminGenderFilter] = useState("All");
  const [adminSearch, setAdminSearch] = useState("");

  // Admin 3-Column Matchmaker state (multi-select arrays; empty = All)
  const [matchBaseId, setMatchBaseId] = useState("");
  const [matchSelectedId, setMatchSelectedId] = useState("");
  const [matchGender, setMatchGender] = useState("Opposite");
  const [matchAgeBuckets, setMatchAgeBuckets] = useState([]);
  const [matchMinAge, setMatchMinAge] = useState("");
  const [matchMaxAge, setMatchMaxAge] = useState("");
  const [matchSurnames, setMatchSurnames] = useState([]);
  const [matchEducations, setMatchEducations] = useState([]);
  const [matchOccupations, setMatchOccupations] = useState([]);
  const [matchCities, setMatchCities] = useState([]);
  const [matchVillages, setMatchVillages] = useState([]);
  const [matchDiets, setMatchDiets] = useState([]);
  const [matchHeights, setMatchHeights] = useState([]);
  const [matchMosals, setMatchMosals] = useState([]);
  const [matchGotras, setMatchGotras] = useState([]);
  const [matchCompanies, setMatchCompanies] = useState([]);
  const [matchIncomes, setMatchIncomes] = useState([]);
  const [matchManagedBys, setMatchManagedBys] = useState([]);
  const [matchPaymentFilter, setMatchPaymentFilter] = useState("All");
  const [matchPhotoFilter, setMatchPhotoFilter] = useState("All");
  const [matchExcludeSameSurname, setMatchExcludeSameSurname] = useState(true);
  const [matchMaritals, setMatchMaritals] = useState([]);
  const [matchNriFilter, setMatchNriFilter] = useState("All");
  const [matchStatusFilter, setMatchStatusFilter] = useState("approved");
  const [matchSearch, setMatchSearch] = useState("");
  const [matchCustomFilters, setMatchCustomFilters] = useState({});
  const [showMoreMatchFilters, setShowMoreMatchFilters] = useState(false);

  const activeMasterData = store.masterData || DEFAULT_MASTER_DATA;
  const activeMasterTables = useMemo(
    () => (store.masterTables && typeof store.masterTables === "object" ? store.masterTables : {}),
    [store.masterTables]
  );
  const activeSupportTables = useMemo(
    () => (Array.isArray(store.supportTables) ? store.supportTables : []),
    [store.supportTables]
  );
  const activeCustomFields = useMemo(
    () => (Array.isArray(store.customFields) ? store.customFields : []),
    [store.customFields]
  );
  const expandedCustomDescriptors = useMemo(
    () =>
      expandCustomFieldDescriptors(
        activeCustomFields,
        activeSupportTables,
        activeMasterTables,
        store.formFieldConfig || {}
      ),
    [activeCustomFields, activeSupportTables, activeMasterTables, store.formFieldConfig]
  );
  const publicCustomColumns = useMemo(
    () => expandedCustomDescriptors.filter((d) => d.visibility === "public" && d.type !== "file"),
    [expandedCustomDescriptors]
  );

  // Registration Form state
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editingReturnTab, setEditingReturnTab] = useState("adminProfiles");
  const [adminEditNote, setAdminEditNote] = useState("");
  const [adminEditSavedMsg, setAdminEditSavedMsg] = useState("");
  const [formError, setFormError] = useState("");
  const [submittedProfileId, setSubmittedProfileId] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const [orderDraft, setOrderDraft] = useState({});
  const [fieldConfigDraft, setFieldConfigDraft] = useState({});
  const [editingFieldKey, setEditingFieldKey] = useState(null);
  const [dragFieldInfo, setDragFieldInfo] = useState(null);
  const [dragOverInfo, setDragOverInfo] = useState(null);
  const [orderSavedMsg, setOrderSavedMsg] = useState("");
  const [showQuickAddField, setShowQuickAddField] = useState(false);
  const [quickFieldDraft, setQuickFieldDraft] = useState({
    labelEn: "",
    labelGu: "",
    placeholder: "",
    section: "personal",
    type: "dropdown",
    masterKey: "",
    supportTableId: "",
    sourceColumn: "",
    extractColumns: [],
    showExtractedOnForm: false,
    allowOther: false,
    inlineOptionsText: "",
    required: false,
    visibility: "public",
    filterable: true
  });

  // Modals
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [contactModalProfile, setContactModalProfile] = useState(null);
  const [contactForm, setContactForm] = useState({ name: "", mobile: "", senderProfileId: "", message: "" });
  const [contactSent, setContactSent] = useState(false);

  const [adminViewProfile, setAdminViewProfile] = useState(null);

  // Admin Settings Draft
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_MATRIMONY_DATA.settings);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState("");

  // Persist language preference
  useEffect(() => {
    try {
      localStorage.setItem("matrimony_lang", lang);
    } catch {}
  }, [lang]);

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data } = await loadMatrimonyData();
      if (mounted) {
        setStore(data);
        setSettingsDraft(data.settings);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const persistStore = async (nextData) => {
    setSaving(true);
    setStore(nextData);
    const res = await saveMatrimonyData(nextData, adminAuth?.idToken || "");
    setStore(res.data);
    setSaving(false);
    return res;
  };

  // Approved active profiles (used for public dashboard, age distribution, surname table, public directory)
  const approvedProfiles = useMemo(
    () => (store.profiles || []).filter((p) => p.status === "approved"),
    [store.profiles]
  );

  // KPIs
  const kpis = useMemo(() => {
    const all = store.profiles || [];
    const approved = approvedProfiles;
    const male = approved.filter((p) => p.gender === "Male").length;
    const female = approved.filter((p) => p.gender === "Female").length;
    const pending = all.filter((p) => p.status === "pending").length;
    const married = all.filter((p) => p.status === "married").length;
    const surnameSet = new Set(approved.map((p) => (p.surname || "").trim().toUpperCase()).filter(Boolean));
    const openRequests = (store.contactRequests || []).filter((r) => r.status !== "closed").length;
    return {
      totalActive: approved.length,
      male,
      female,
      surnamesCount: surnameSet.size,
      pending,
      married,
      openRequests
    };
  }, [store.profiles, store.contactRequests, approvedProfiles]);

  // Age-wise breakdown (Male vs Female)
  const ageBreakdown = useMemo(() => {
    return AGE_BUCKETS.map((b) => {
      let male = 0;
      let female = 0;
      for (const p of approvedProfiles) {
        const age = calculateAge(p.dob);
        if (age !== null && age >= b.min && age <= b.max) {
          if (p.gender === "Male") male++;
          else if (p.gender === "Female") female++;
        }
      }
      return { ...b, male, female, total: male + female };
    });
  }, [approvedProfiles]);

  // Surname-wise summary table (Both Male & Female)
  const surnameSummary = useMemo(() => {
    const map = new Map();
    for (const p of approvedProfiles) {
      const raw = (p.surname || "Other").trim();
      const key = raw.toUpperCase();
      if (!map.has(key)) {
        map.set(key, { surname: raw, male: 0, female: 0, total: 0 });
      }
      const entry = map.get(key);
      if (p.gender === "Male") entry.male++;
      else if (p.gender === "Female") entry.female++;
      entry.total++;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total || a.surname.localeCompare(b.surname));
  }, [approvedProfiles]);

  // Helper to build sorted multi-select options with counts
  const buildFacetOptions = (list, field) => {
    const map = new Map();
    for (const p of list || []) {
      const raw = String(p?.[field] || "").trim();
      if (!raw) continue;
      const key = raw.toUpperCase();
      if (!map.has(key)) map.set(key, { value: raw, label: raw, count: 0 });
      map.get(key).count++;
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  };

  const matchesMulti = (selectedArr, fieldVal) => {
    if (!selectedArr || selectedArr.length === 0) return true;
    const norm = String(fieldVal || "").trim().toUpperCase();
    return selectedArr.some((s) => String(s).trim().toUpperCase() === norm);
  };

  const matchesAgeBuckets = (selectedBucketIds, age) => {
    if (!selectedBucketIds || selectedBucketIds.length === 0) return true;
    if (age === null) return false;
    return selectedBucketIds.some((id) => {
      const b = AGE_BUCKETS.find((x) => x.id === id);
      return b && age >= b.min && age <= b.max;
    });
  };

  // Public facet options (from approved profiles)
  const publicFacets = useMemo(
    () => ({
      surnames: buildFacetOptions(approvedProfiles, "surname"),
      educations: buildFacetOptions(approvedProfiles, "education"),
      occupations: buildFacetOptions(approvedProfiles, "occupation"),
      cities: buildFacetOptions(approvedProfiles, "city"),
      villages: buildFacetOptions(approvedProfiles, "nativeVillage"),
      maritals: buildFacetOptions(approvedProfiles, "maritalStatus")
    }),
    [approvedProfiles]
  );

  // Admin matchmaker facet options (from all profiles — covers every column)
  const adminFacets = useMemo(
    () => ({
      surnames: buildFacetOptions(store.profiles || [], "surname"),
      educations: buildFacetOptions(store.profiles || [], "education"),
      occupations: buildFacetOptions(store.profiles || [], "occupation"),
      cities: buildFacetOptions(store.profiles || [], "city"),
      villages: buildFacetOptions(store.profiles || [], "nativeVillage"),
      maritals: buildFacetOptions(store.profiles || [], "maritalStatus"),
      diets: buildFacetOptions(store.profiles || [], "diet"),
      heights: buildFacetOptions(store.profiles || [], "height"),
      mosals: buildFacetOptions(store.profiles || [], "mosal"),
      gotras: buildFacetOptions(store.profiles || [], "gotra"),
      companies: buildFacetOptions(store.profiles || [], "company"),
      incomes: buildFacetOptions(store.profiles || [], "income"),
      managedBys: buildFacetOptions(store.profiles || [], "managedBy")
    }),
    [store.profiles]
  );

  const moreMatchFiltersActiveCount = useMemo(() => {
    let n = 0;
    if (matchOccupations.length) n++;
    if (matchVillages.length) n++;
    if (matchMaritals.length) n++;
    if (matchDiets.length) n++;
    if (matchHeights.length) n++;
    if (matchMosals.length) n++;
    if (matchGotras.length) n++;
    if (matchCompanies.length) n++;
    if (matchIncomes.length) n++;
    if (matchManagedBys.length) n++;
    if (matchMinAge !== "" || matchMaxAge !== "") n++;
    if (matchNriFilter !== "All") n++;
    if (matchStatusFilter !== "approved") n++;
    if (matchPaymentFilter !== "All") n++;
    if (matchPhotoFilter !== "All") n++;
    for (const arr of Object.values(matchCustomFilters || {})) {
      if (Array.isArray(arr) && arr.length > 0) n++;
    }
    return n;
  }, [
    matchOccupations,
    matchVillages,
    matchMaritals,
    matchDiets,
    matchHeights,
    matchMosals,
    matchGotras,
    matchCompanies,
    matchIncomes,
    matchManagedBys,
    matchMinAge,
    matchMaxAge,
    matchNriFilter,
    matchStatusFilter,
    matchPaymentFilter,
    matchPhotoFilter,
    matchCustomFilters
  ]);

  // Filtered Public Profiles (Restricted: only approved, no name/mobile/photo exposed)
  const filteredPublicProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const minA = filterMinAge !== "" ? Number(filterMinAge) : null;
    const maxA = filterMaxAge !== "" ? Number(filterMaxAge) : null;

    return approvedProfiles.filter((p) => {
      if (filterGender !== "All" && p.gender !== filterGender) return false;
      if (!matchesMulti(filterSurnames, p.surname)) return false;
      if (!matchesMulti(filterEducations, p.education)) return false;
      if (!matchesMulti(filterOccupations, p.occupation)) return false;
      if (!matchesMulti(filterCities, p.city)) return false;
      if (!matchesMulti(filterVillages, p.nativeVillage)) return false;
      if (!matchesMulti(filterMaritals, p.maritalStatus)) return false;

      const age = calculateAge(p.dob);
      if (minA !== null && (age === null || age < minA)) return false;
      if (maxA !== null && (age === null || age > maxA)) return false;
      if (minA === null && maxA === null && !matchesAgeBuckets(filterAgeBuckets, age)) return false;

      if (q) {
        // Notice: deliberately do NOT match against fullName or mobile in public search so private fields cannot be probed
        const searchable = [
          p.profileId,
          p.surname,
          p.education,
          p.occupation,
          p.city,
          p.nativeVillage,
          p.mosal,
          p.maritalStatus
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [
    approvedProfiles,
    filterGender,
    filterAgeBuckets,
    filterMinAge,
    filterMaxAge,
    filterSurnames,
    filterEducations,
    filterOccupations,
    filterCities,
    filterVillages,
    filterMaritals,
    searchQuery
  ]);

  // Filtered Admin Profiles (Full access)
  const filteredAdminProfiles = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();
    return (store.profiles || []).filter((p) => {
      if (adminStatusFilter !== "all" && p.status !== adminStatusFilter) return false;
      if (adminGenderFilter !== "All" && p.gender !== adminGenderFilter) return false;
      if (q) {
        const searchable = [
          p.profileId,
          p.fullName,
          p.surname,
          p.mobile,
          p.email,
          p.city,
          p.nativeVillage,
          p.education,
          p.occupation,
          p.fatherName
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [store.profiles, adminStatusFilter, adminGenderFilter, adminSearch]);

  // ── EXCEL-STYLE COLUMN DROPDOWN FILTER & SORT FOR ALL 4 TABLES ──
  const publicTableGetters = useMemo(() => {
    const map = {
      profileId: (p) => p.profileId || "",
      gender: (p) => p.gender || "",
      surname: (p) => p.surname || "",
      age: (p) => {
        const a = calculateAge(p.dob);
        return a !== null ? String(a) : "";
      },
      height: (p) => p.height || "",
      maritalStatus: (p) => p.maritalStatus || "",
      education: (p) => p.education || "",
      occupation: (p) => p.occupation || "",
      nativeVillage: (p) => p.nativeVillage || "",
      city: (p) => (p.city ? `${p.city}${p.isNri ? " (NRI)" : ""}` : "")
    };
    for (const col of publicCustomColumns) {
      map[`cf_${col.key}`] = (p) => {
        const raw = p.customFields?.[col.key];
        if (Array.isArray(raw)) return raw.join(", ");
        if (typeof raw === "boolean") return raw ? "Yes" : "No";
        return raw || "";
      };
    }
    return map;
  }, [publicCustomColumns]);

  const publicTable = useTableFilterSort(filteredPublicProfiles, publicTableGetters);

  const surnameTableGetters = useMemo(
    () => ({
      surname: (r) => r.surname || "",
      male: (r) => String(r.male ?? 0),
      female: (r) => String(r.female ?? 0),
      total: (r) => String(r.total ?? 0)
    }),
    []
  );
  const surnameTableState = useTableFilterSort(surnameSummary, surnameTableGetters);

  const adminProfilesGetters = useMemo(
    () => ({
      profileId: (p) => p.profileId || "",
      fullName: (p) => p.fullName || "",
      surname: (p) => p.surname || "",
      genderAge: (p) => {
        const a = calculateAge(p.dob);
        return `${p.gender || ""}${a !== null ? ` • ${a}` : ""}`;
      },
      mobile: (p) => p.mobile || "",
      eduCity: (p) => [p.education, p.city].filter(Boolean).join(" / "),
      status: (p) => p.status || "",
      submittedBy: (p) => p.submittedBy || "",
      updatedBy: (p) => p.updatedBy || "",
      verifiedBy: (p) => p.verifiedBy || "",
      approvedBy: (p) => p.approvedBy || ""
    }),
    []
  );
  const adminProfilesTable = useTableFilterSort(filteredAdminProfiles, adminProfilesGetters);

  const adminRequestsGetters = useMemo(
    () => ({
      date: (req) => (req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ""),
      targetProfile: (req) => {
        const target = (store.profiles || []).find((p) => p.profileId === req.targetProfileId);
        return target ? `${req.targetProfileId} - ${target.fullName}` : `${req.targetProfileId || ""} ${req.targetSurname || ""}`.trim();
      },
      requesterName: (req) => req.requesterName || "",
      requesterMobile: (req) => req.requesterMobile || "",
      message: (req) => req.message || "",
      status: (req) => req.status || "open"
    }),
    [store.profiles]
  );
  const adminRequestsTable = useTableFilterSort(store.contactRequests || [], adminRequestsGetters);

  const resetPublicFilters = () => {
    setFilterGender("All");
    setFilterAgeBuckets([]);
    setFilterMinAge("");
    setFilterMaxAge("");
    setFilterSurnames([]);
    setFilterEducations([]);
    setFilterOccupations([]);
    setFilterCities([]);
    setFilterVillages([]);
    setFilterMaritals([]);
    setSearchQuery("");
  };

  // Base candidate (Column 1) — defaults to first profile if none picked yet
  const matchBaseProfile = useMemo(() => {
    const all = store.profiles || [];
    if (!all.length) return null;
    if (matchBaseId) {
      const found = all.find((p) => p.profileId === matchBaseId);
      if (found) return found;
    }
    return all.find((p) => p.status === "approved") || all[0];
  }, [store.profiles, matchBaseId]);

  // Proposed matching candidates (Column 2) using extended multi-select filters
  const matchCandidates = useMemo(() => {
    const all = store.profiles || [];
    const base = matchBaseProfile;
    const q = matchSearch.trim().toLowerCase();
    const minA = matchMinAge !== "" ? Number(matchMinAge) : null;
    const maxA = matchMaxAge !== "" ? Number(matchMaxAge) : null;

    return all.filter((p) => {
      if (base && p.profileId === base.profileId) return false;
      if (matchStatusFilter !== "all" && p.status !== matchStatusFilter) return false;

      if (matchGender === "Opposite" && base) {
        const opp = base.gender === "Male" ? "Female" : "Male";
        if (p.gender !== opp) return false;
      } else if (matchGender === "Male" || matchGender === "Female") {
        if (p.gender !== matchGender) return false;
      }

      if (
        matchExcludeSameSurname &&
        base?.surname &&
        (p.surname || "").trim().toUpperCase() === base.surname.trim().toUpperCase()
      ) {
        return false;
      }

      if (!matchesMulti(matchSurnames, p.surname)) return false;
      if (!matchesMulti(matchEducations, p.education)) return false;
      if (!matchesMulti(matchOccupations, p.occupation)) return false;
      if (!matchesMulti(matchCities, p.city)) return false;
      if (!matchesMulti(matchVillages, p.nativeVillage)) return false;
      if (!matchesMulti(matchMaritals, p.maritalStatus)) return false;
      if (!matchesMulti(matchDiets, p.diet)) return false;
      if (!matchesMulti(matchHeights, p.height)) return false;
      if (!matchesMulti(matchMosals, p.mosal)) return false;
      if (!matchesMulti(matchGotras, p.gotra)) return false;
      if (!matchesMulti(matchCompanies, p.company)) return false;
      if (!matchesMulti(matchIncomes, p.income)) return false;
      if (!matchesMulti(matchManagedBys, p.managedBy)) return false;

      if (matchPaymentFilter !== "All" && (p.paymentMode || "free") !== matchPaymentFilter) return false;
      if (matchPhotoFilter === "with" && !p.photo) return false;
      if (matchPhotoFilter === "without" && p.photo) return false;

      // Custom field multi-select filters (supports single values, booleans, and multiselect arrays)
      for (const [cfId, selArr] of Object.entries(matchCustomFilters || {})) {
        if (!Array.isArray(selArr) || selArr.length === 0) continue;
        const rawVal = p.customFields?.[cfId];
        if (Array.isArray(rawVal)) {
          const anyMatch = rawVal.some((item) => matchesMulti(selArr, String(item || "")));
          if (!anyMatch) return false;
        } else {
          const strVal = typeof rawVal === "boolean" ? (rawVal ? "Yes" : "No") : String(rawVal || "");
          if (!matchesMulti(selArr, strVal)) return false;
        }
      }

      if (matchNriFilter === "NRI" && !p.isNri) return false;
      if (matchNriFilter === "India" && p.isNri) return false;

      const age = calculateAge(p.dob);
      if (minA !== null && (age === null || age < minA)) return false;
      if (maxA !== null && (age === null || age > maxA)) return false;
      if (minA === null && maxA === null && !matchesAgeBuckets(matchAgeBuckets, age)) return false;

      if (q) {
        const searchable = [
          p.profileId,
          p.fullName,
          p.surname,
          p.education,
          p.occupation,
          p.company,
          p.city,
          p.nativeVillage,
          p.mosal,
          p.gotra,
          p.fatherName,
          p.mobile
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [
    store.profiles,
    matchBaseProfile,
    matchStatusFilter,
    matchGender,
    matchExcludeSameSurname,
    matchSurnames,
    matchEducations,
    matchOccupations,
    matchCities,
    matchVillages,
    matchMaritals,
    matchDiets,
    matchHeights,
    matchMosals,
    matchGotras,
    matchCompanies,
    matchIncomes,
    matchManagedBys,
    matchPaymentFilter,
    matchPhotoFilter,
    matchCustomFilters,
    matchNriFilter,
    matchAgeBuckets,
    matchMinAge,
    matchMaxAge,
    matchSearch
  ]);

  // Selected proposed match (Column 3)
  const matchSelectedProfile = useMemo(() => {
    if (!matchCandidates.length) return null;
    if (matchSelectedId) {
      const found = matchCandidates.find((p) => p.profileId === matchSelectedId);
      if (found) return found;
    }
    return matchCandidates[0];
  }, [matchCandidates, matchSelectedId]);

  const resetMatchFilters = () => {
    setMatchGender("Opposite");
    setMatchAgeBuckets([]);
    setMatchMinAge("");
    setMatchMaxAge("");
    setMatchSurnames([]);
    setMatchEducations([]);
    setMatchOccupations([]);
    setMatchCities([]);
    setMatchVillages([]);
    setMatchDiets([]);
    setMatchHeights([]);
    setMatchMosals([]);
    setMatchGotras([]);
    setMatchCompanies([]);
    setMatchIncomes([]);
    setMatchManagedBys([]);
    setMatchPaymentFilter("All");
    setMatchPhotoFilter("All");
    setMatchCustomFilters({});
    setMatchExcludeSameSurname(true);
    setMatchMaritals([]);
    setMatchNriFilter("All");
    setMatchStatusFilter("approved");
    setMatchSearch("");
  };

  const openInMatcher = (profileId) => {
    setMatchBaseId(profileId);
    setMatchSelectedId("");
    setMatchGender("Opposite");
    setActiveTab("adminMatcher");
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSaving(true);
      const uploadedUrl = await uploadMatrimonyPhoto(file, adminAuth?.idToken || "");
      setForm((prev) => ({ ...prev, photo: uploadedUrl }));
    } catch {
      setFormError("Could not process image. Please try a JPG or PNG file.");
    } finally {
      setSaving(false);
    }
  };

  const getCurrentActorLabel = () => {
    if (isAdmin) return adminAuth?.name || adminAuth?.email || "Admin";
    if (publicUser?.name) return publicUser.name;
    if (publicUser?.mobile) return publicUser.mobile;
    return "Member";
  };

  const formatAuditDateTime = (iso) => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return String(iso);
    }
  };

  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!isAuthenticatedForAction) {
      setPendingLoginAction({ type: "register" });
      setShowPublicLogin(true);
      return;
    }

    if (!form.fullName.trim() || !form.surname.trim() || !form.dob || !form.mobile.trim()) {
      setFormError(
        lang === "en"
          ? "Please fill all required fields (Full Name, Surname, Date of Birth, Mobile)."
          : "કૃપા કરીને બધી જરૂરી વિગતો ભરો (પૂરું નામ, અટક, જન્મ તારીખ, મોબાઇલ)."
      );
      return;
    }

    if (store.settings.isPaidMode && !isAdmin && !form.paymentUtr.trim()) {
      setFormError(
        lang === "en"
          ? "Paid registration is active. Please enter your Payment Transaction ID / UTR."
          : "પેઇડ નોંધણી ચાલુ છે. કૃપા કરીને પેમેન્ટ ટ્રાન્ઝેક્શન ID / UTR દાખલ કરો."
      );
      return;
    }

    // Guarantee all dependent/supporting columns from linked Master/Support Tables are extracted directly into transaction data
    const resolvedCustomFields = { ...(form.customFields || {}) };
    for (const cf of activeCustomFields) {
      if (cf.type !== "dropdown") continue;
      const tbl = getLinkedTableForSource(cf.masterKey, cf.supportTableId);
      if (!tbl || !Array.isArray(tbl.columns) || tbl.columns.length <= 1) continue;
      const sourceCol = cf.sourceColumn || tbl.primaryColumn || tbl.columns[0];
      const extractCols = Array.isArray(cf.extractColumns)
        ? cf.extractColumns.filter((c) => tbl.columns.includes(c) && c !== sourceCol)
        : [];
      if (!extractCols.length) continue;
      const selectedVal = String(resolvedCustomFields[cf.id] || "").trim();
      const matchedRow = selectedVal
        ? (tbl.rows || []).find(
            (r) => String(r?.[sourceCol] || "").trim().toUpperCase() === selectedVal.toUpperCase()
          )
        : null;
      for (const colName of extractCols) {
        resolvedCustomFields[`${cf.id}__${colName}`] = matchedRow ? matchedRow[colName] || "" : "";
      }
    }

    // Also extract dependent columns for any built-in field connected to a Support/Master table via formFieldConfig
    for (const [bKey, cfg] of Object.entries(store.formFieldConfig || {})) {
      if (!cfg || (!cfg.supportTableId && !cfg.masterKey)) continue;
      const tbl = getLinkedTableForSource(cfg.masterKey, cfg.supportTableId);
      if (!tbl || !Array.isArray(tbl.columns) || tbl.columns.length <= 1) continue;
      const sourceCol = cfg.sourceColumn || tbl.primaryColumn || tbl.columns[0];
      const extractCols = Array.isArray(cfg.extractColumns)
        ? cfg.extractColumns.filter((c) => tbl.columns.includes(c) && c !== sourceCol)
        : [];
      if (!extractCols.length) continue;
      const selectedVal = String(form?.[bKey] || "").trim();
      const matchedRow = selectedVal
        ? (tbl.rows || []).find(
            (r) => String(r?.[sourceCol] || "").trim().toUpperCase() === selectedVal.toUpperCase()
          )
        : null;
      for (const colName of extractCols) {
        resolvedCustomFields[`bf_${bKey}__${colName}`] = matchedRow ? matchedRow[colName] || "" : "";
      }
    }

    // Apply "*" mark to custom "Other" entries on dropdowns that have allowOther enabled
    const resolvedForm = { ...form };
    const BUILTIN_MASTER_KEYS = {
      surname: "surnames",
      height: "heights",
      maritalStatus: "maritalStatuses",
      diet: "diets",
      nativeVillage: "nativeVillages",
      gotra: "gotras",
      city: "cities",
      education: "educations",
      occupation: "occupations",
      income: "incomes",
      managedBy: "managedBys"
    };

    for (const cf of activeCustomFields) {
      if (cf.type !== "dropdown" || !cf.allowOther) continue;
      const rawVal = String(resolvedCustomFields[cf.id] || "").trim();
      if (!rawVal) continue;
      const cleanVal = rawVal.replace(/\s*\*$/, "").trim();
      const opts = getCustomFieldOptions(cf);
      const inList = opts.some((o) => String(o).trim().toLowerCase() === cleanVal.toLowerCase());
      if (!inList && cleanVal) {
        resolvedCustomFields[cf.id] = `${cleanVal} *`;
      }
    }

    for (const [bKey, cfg] of Object.entries(store.formFieldConfig || {})) {
      if (!cfg?.allowOther) continue;
      const rawVal = String(resolvedForm[bKey] || "").trim();
      if (!rawVal) continue;
      const cleanVal = rawVal.replace(/\s*\*$/, "").trim();
      let opts = [];
      if (cfg.masterKey || cfg.supportTableId || (Array.isArray(cfg.options) && cfg.options.length > 0)) {
        const tbl = getLinkedTableForSource(cfg.masterKey, cfg.supportTableId);
        const sourceCol = tbl ? cfg.sourceColumn || tbl.primaryColumn || tbl.columns?.[0] : "";
        opts = getCustomFieldOptions({
          masterKey: cfg.masterKey || "",
          supportTableId: cfg.supportTableId || "",
          sourceColumn: sourceCol,
          options: Array.isArray(cfg.options) ? cfg.options : []
        });
      } else if (BUILTIN_MASTER_KEYS[bKey]) {
        opts = activeMasterData[BUILTIN_MASTER_KEYS[bKey]] || [];
      }
      const inList = opts.some((o) => String(o).trim().toLowerCase() === cleanVal.toLowerCase());
      if (!inList && cleanVal) {
        resolvedForm[bKey] = `${cleanVal} *`;
      }
    }

    if (editingProfileId) {
      const nowIso = new Date().toISOString();
      const savedId = editingProfileId;
      const actor = getCurrentActorLabel();
      const updatedProfiles = (store.profiles || []).map((p) => {
        if (p.profileId !== editingProfileId) return p;
        const nextStatus = resolvedForm.status || p.status || "approved";
        const becameApproved = nextStatus === "approved" && p.status !== "approved";
        return {
          ...p,
          ...resolvedForm,
          customFields: resolvedCustomFields,
          surname: String(resolvedForm.surname || "").trim(),
          fullName: String(resolvedForm.fullName || "").trim(),
          status: nextStatus,
          submittedBy: p.submittedBy || actor,
          submittedAt: p.submittedAt || p.createdAt || nowIso,
          updatedBy: actor,
          updatedAt: nowIso,
          ...(becameApproved
            ? {
                approvedBy: actor,
                approvedAt: nowIso,
                verifiedBy: p.verifiedBy || actor,
                verifiedAt: p.verifiedAt || nowIso
              }
            : {}),
          lastEditedByAdminAt: isAdmin ? nowIso : p.lastEditedByAdminAt,
          editHistory: [
            {
              editedAt: nowIso,
              by: actor,
              note: adminEditNote.trim() || (isAdmin ? "Profile details updated by Admin" : "Profile updated by Member")
            },
            ...(Array.isArray(p.editHistory) ? p.editHistory : [])
          ].slice(0, 20)
        };
      });
      await persistStore({ ...store, profiles: updatedProfiles });
      setEditingProfileId(null);
      setAdminEditNote("");
      setForm(EMPTY_FORM);
      setActiveTab(editingReturnTab || "adminProfiles");
      setAdminEditSavedMsg(`Profile ${savedId} updated successfully!`);
      setTimeout(() => setAdminEditSavedMsg(""), 4000);
      return;
    }

    const nowIso = new Date().toISOString();
    const actor = getCurrentActorLabel();
    const newId = generateNextProfileId(store.profiles);
    const newProfile = {
      ...resolvedForm,
      customFields: resolvedCustomFields,
      profileId: newId,
      fullName: String(resolvedForm.fullName || "").trim(),
      surname: String(resolvedForm.surname || "").trim(),
      status: isAdmin ? "approved" : "pending",
      paymentMode: store.settings.isPaidMode ? "paid" : "free",
      feeAmount: store.settings.isPaidMode ? Number(store.settings.feeAmount || 0) : 0,
      submittedBy: actor,
      submittedByMobile: publicUser?.mobile || "",
      submittedAt: nowIso,
      updatedBy: actor,
      updatedAt: nowIso,
      ...(isAdmin
        ? {
            verifiedBy: actor,
            verifiedAt: nowIso,
            approvedBy: actor,
            approvedAt: nowIso
          }
        : {
            verifiedBy: "",
            verifiedAt: "",
            approvedBy: "",
            approvedAt: ""
          }),
      createdAt: nowIso
    };

    await persistStore({
      ...store,
      profiles: [newProfile, ...(store.profiles || [])]
    });

    setForm(EMPTY_FORM);
    setSubmittedProfileId(newId);
  };

  const handleAdminStatusChange = async (profileId, newStatus) => {
    const nowIso = new Date().toISOString();
    const actor = getCurrentActorLabel();
    let updatedTarget = null;
    const updated = (store.profiles || []).map((p) => {
      if (p.profileId !== profileId) return p;
      const patch = {
        ...p,
        status: newStatus,
        updatedBy: actor,
        updatedAt: nowIso
      };
      if (newStatus === "approved") {
        patch.approvedBy = actor;
        patch.approvedAt = nowIso;
        if (!p.verifiedBy) {
          patch.verifiedBy = actor;
          patch.verifiedAt = nowIso;
        }
      } else if (newStatus === "rejected") {
        patch.rejectedBy = actor;
        patch.rejectedAt = nowIso;
      } else if (newStatus === "married") {
        patch.marriedMarkedBy = actor;
        patch.marriedMarkedAt = nowIso;
      }
      updatedTarget = patch;
      return patch;
    });
    await persistStore({ ...store, profiles: updated });
    if (adminViewProfile?.profileId === profileId && updatedTarget) {
      setAdminViewProfile(updatedTarget);
    }
  };

  const handleAdminVerifyProfile = async (profileId) => {
    const nowIso = new Date().toISOString();
    const actor = getCurrentActorLabel();
    let updatedTarget = null;
    const updated = (store.profiles || []).map((p) => {
      if (p.profileId !== profileId) return p;
      const patch = {
        ...p,
        verifiedBy: actor,
        verifiedAt: nowIso,
        updatedBy: actor,
        updatedAt: nowIso
      };
      updatedTarget = patch;
      return patch;
    });
    await persistStore({ ...store, profiles: updated });
    if (adminViewProfile?.profileId === profileId && updatedTarget) {
      setAdminViewProfile(updatedTarget);
    }
  };

  const handleAdminDeleteProfile = async (profileId) => {
    if (!window.confirm(`Delete profile ${profileId}? This cannot be undone.`)) return;
    const updated = (store.profiles || []).filter((p) => p.profileId !== profileId);
    await persistStore({ ...store, profiles: updated });
    if (adminViewProfile?.profileId === profileId) setAdminViewProfile(null);
  };

  const handleBulkUploadProfilesFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isAdmin) return;
    try {
      const { nextProfiles, addedCount, updatedCount, skippedCount } =
        await importProfilesFromSpreadsheet(
          file,
          store.profiles || [],
          activeCustomFields,
          activeSupportTables,
          activeMasterTables,
          getCurrentActorLabel()
        );
      if (addedCount === 0 && updatedCount === 0) {
        alert("No valid profile rows were found in the uploaded file. Please check column headers or use the Sample Template.");
        return;
      }
      await persistStore({ ...store, profiles: nextProfiles, demoCleared: false });
      setAdminEditSavedMsg(
        `Database Upload Complete: ${addedCount} added, ${updatedCount} updated${skippedCount ? `, ${skippedCount} skipped` : ""}!`
      );
      setTimeout(() => setAdminEditSavedMsg(""), 6000);
    } catch (err) {
      alert(`Upload failed: ${err?.message || "Invalid Excel / CSV file"}`);
    }
  };

  const handleExportFullDatabaseJson = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `Matrimony_Full_Database_Backup_${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreDatabaseJson = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isAdmin) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.profiles)) {
        alert("Invalid Matrimony database JSON backup file (missing profiles list).");
        return;
      }
      if (
        !window.confirm(
          `Restore full Matrimony database from "${file.name}"?\n\nThis will load ${parsed.profiles.length} profiles, master tables, custom fields, and settings.`
        )
      ) {
        return;
      }
      await persistStore({
        ...DEFAULT_MATRIMONY_DATA,
        ...parsed,
        settings: { ...DEFAULT_MATRIMONY_DATA.settings, ...(parsed.settings || {}) }
      });
      setAdminEditSavedMsg(`Full Database restored (${parsed.profiles.length} profiles loaded)!`);
      setTimeout(() => setAdminEditSavedMsg(""), 6000);
    } catch (err) {
      alert(`JSON restore failed: ${err?.message || "Invalid JSON file"}`);
    }
  };

  const handleStartEditProfile = (profile) => {
    if (!isAdmin || !profile) return;
    setForm({
      ...EMPTY_FORM,
      ...profile,
      customFields: { ...(profile.customFields || {}) }
    });
    setEditingProfileId(profile.profileId);
    setEditingReturnTab(activeTab === "register" ? "adminProfiles" : activeTab);
    setAdminEditNote("");
    setSubmittedProfileId("");
    setAdminViewProfile(null);
    setActiveTab("register");
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // ignore
    }
  };

  const handleContactRequestSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticatedForAction) {
      setPendingLoginAction({ type: "request", profile: contactModalProfile });
      setShowPublicLogin(true);
      return;
    }
    if (!contactModalProfile || !contactForm.name.trim() || !contactForm.mobile.trim()) return;
    const newReq = {
      id: `REQ-${Date.now()}`,
      targetProfileId: contactModalProfile.profileId,
      targetSurname: contactModalProfile.surname,
      targetGender: contactModalProfile.gender,
      requesterName: contactForm.name.trim(),
      requesterMobile: contactForm.mobile.trim(),
      requesterProfileId: contactForm.senderProfileId.trim(),
      message: contactForm.message.trim(),
      status: "new",
      createdAt: new Date().toISOString()
    };
    await persistStore({
      ...store,
      contactRequests: [newReq, ...(store.contactRequests || [])]
    });
    setContactSent(true);
    setContactForm({ name: "", mobile: "", senderProfileId: "", message: "" });
  };

  const handleUpdateRequestStatus = async (reqId, status) => {
    const updated = (store.contactRequests || []).map((r) => (r.id === reqId ? { ...r, status } : r));
    await persistStore({ ...store, contactRequests: updated });
  };

  const handleAdminLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const authObj = await signInMatrimonyAdmin(loginEmail, loginPass);
      setAdminAuth(authObj);
      setShowAdminLogin(false);
      setLoginEmail("");
      setLoginPass("");
      setActiveTab("adminProfiles");
    } catch (err) {
      setLoginError(err.message || "Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    signOutMatrimonyAdmin();
    setAdminAuth(null);
    if (activeTab.startsWith("admin")) setActiveTab("dashboard");
  };

  const handleTogglePaidModeImmediate = async (checked) => {
    const nextSettings = { ...settingsDraft, isPaidMode: checked };
    setSettingsDraft(nextSettings);
    await persistStore({ ...store, settings: nextSettings });
    setSettingsSavedMsg(t.settingsSaved);
    setTimeout(() => setSettingsSavedMsg(""), 2500);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    await persistStore({ ...store, settings: settingsDraft });
    setSettingsSavedMsg(t.settingsSaved);
    setTimeout(() => setSettingsSavedMsg(""), 2500);
  };

  const handleSaveMasterData = async (nextMasterData) => {
    await persistStore({ ...store, masterData: nextMasterData });
  };

  const handleSaveMasterTables = async (nextMasterTables, nextMasterData = null) => {
    await persistStore({
      ...store,
      masterTables: nextMasterTables,
      ...(nextMasterData ? { masterData: nextMasterData } : {})
    });
  };

  // Auto-fill linked secondary columns when a standard Master Data dropdown has a multi-column table (e.g. surnames -> Surname Category)
  const handleMasterFieldSelect = (fieldName, masterKey, nextVal) => {
    setForm((prev) => {
      const nextCustom = { ...(prev.customFields || {}) };
      const tbl = activeMasterTables?.[masterKey];
      if (tbl && Array.isArray(tbl.columns) && tbl.columns.length > 1) {
        const pCol = tbl.primaryColumn;
        const secondaryCols = tbl.columns.filter((c) => c !== pCol);
        const matchedRow = (tbl.rows || []).find(
          (r) =>
            String(r?.[pCol] || "").trim().toUpperCase() ===
            String(nextVal || "").trim().toUpperCase()
        );
        for (const colName of secondaryCols) {
          nextCustom[`mt_${masterKey}__${colName}`] = matchedRow ? matchedRow[colName] || "" : "";
        }
      }
      return { ...prev, [fieldName]: nextVal, customFields: nextCustom };
    });
  };

  const renderMasterLinkedPreview = (masterKey, currentVal) => {
    const tbl = activeMasterTables?.[masterKey];
    if (!tbl || !Array.isArray(tbl.columns) || tbl.columns.length <= 1 || !currentVal) return null;
    const secondaryCols = tbl.columns.filter((c) => c !== tbl.primaryColumn);
    return (
      <div
        style={{
          marginTop: 5,
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          background: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: 8,
          padding: "4px 8px",
          fontSize: "0.74rem",
          color: "#166534",
          fontWeight: 600
        }}
      >
        {secondaryCols.map((colName) => (
          <span key={colName}>
            {colName}: <strong>{form.customFields?.[`mt_${masterKey}__${colName}`] || "-"}</strong>
          </span>
        ))}
      </div>
    );
  };

  const handleSaveSupportTables = async (nextSupportTables) => {
    await persistStore({ ...store, supportTables: nextSupportTables });
  };

  const handleSaveCustomFields = async (nextCustomFields) => {
    await persistStore({ ...store, customFields: nextCustomFields });
  };

  const getLinkedTableForSource = (masterKey, supportTableId) => {
    if (supportTableId) {
      return activeSupportTables.find((t) => t.id === supportTableId) || null;
    }
    if (masterKey && activeMasterTables?.[masterKey]?.columns?.length > 0) {
      return activeMasterTables[masterKey];
    }
    return null;
  };

  const getCustomFieldOptions = (cf) => {
    const tbl = getLinkedTableForSource(cf.masterKey, cf.supportTableId);
    if (tbl && Array.isArray(tbl.rows) && tbl.rows.length > 0) {
      const col = cf.sourceColumn || tbl.primaryColumn || tbl.columns?.[0];
      const seen = new Set();
      const opts = [];
      for (const r of tbl.rows) {
        const v = String(r?.[col] || "").trim();
        if (v && !seen.has(v.toUpperCase())) {
          seen.add(v.toUpperCase());
          opts.push(v);
        }
      }
      if (opts.length) return opts.sort((a, b) => a.localeCompare(b));
    }
    if (cf.masterKey && Array.isArray(activeMasterData?.[cf.masterKey])) {
      return activeMasterData[cf.masterKey];
    }
    return Array.isArray(cf.options) ? cf.options : [];
  };

  const handleCustomFileUpload = async (file, setVal) => {
    if (!file) return;
    try {
      setSaving(true);
      if (file.type.startsWith("image/")) {
        const uploadedUrl = await uploadMatrimonyPhoto(file, adminAuth?.idToken || "");
        setVal(uploadedUrl);
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => setVal(ev.target.result || "");
        reader.readAsDataURL(file);
      }
    } catch {
      setFormError("Could not upload file. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const renderCustomFieldsForSection = (sectionKey) => {
    const fields = activeCustomFields.filter((f) => (f.section || "extra") === sectionKey);
    if (!fields.length) return null;
    return fields.map((cf) => {
      const lbl = lang === "gu" ? cf.labelGu || cf.labelEn : cf.labelEn;
      const val = form.customFields?.[cf.id];
      const setVal = (nextVal) =>
        setForm((prev) => ({
          ...prev,
          customFields: { ...(prev.customFields || {}), [cf.id]: nextVal }
        }));

      if (cf.type === "checkbox") {
        return (
          <div key={cf.id} className="mat-field" style={{ justifyContent: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
              <input type="checkbox" checked={Boolean(val)} onChange={(e) => setVal(e.target.checked)} />
              {lbl} {cf.required ? "*" : ""}
            </label>
          </div>
        );
      }

      if (cf.type === "dropdown") {
        const linkedTable = getLinkedTableForSource(cf.masterKey, cf.supportTableId);
        const sourceCol = linkedTable ? cf.sourceColumn || linkedTable.primaryColumn || linkedTable.columns?.[0] : "";
        const secondaryCols = linkedTable
          ? Array.isArray(cf.extractColumns)
            ? cf.extractColumns.filter((c) => linkedTable.columns.includes(c) && c !== sourceCol)
            : (linkedTable.columns || []).filter((c) => c !== sourceCol)
          : [];

        const handleDropdownChange = (nextVal) => {
          setForm((prev) => {
            const nextCustom = { ...(prev.customFields || {}), [cf.id]: nextVal };
            if (linkedTable && secondaryCols.length > 0) {
              const matchedRow = (linkedTable.rows || []).find(
                (r) =>
                  String(r?.[sourceCol] || "").trim().toUpperCase() ===
                  String(nextVal || "").trim().toUpperCase()
              );
              for (const colName of secondaryCols) {
                nextCustom[`${cf.id}__${colName}`] = matchedRow ? matchedRow[colName] || "" : "";
              }
            }
            return { ...prev, customFields: nextCustom };
          });
        };

        return (
          <div key={cf.id} className="mat-field">
            <label className="mat-label">
              {lbl} {cf.required ? "*" : ""}
            </label>
            <MasterSelectInput
              value={val || ""}
              onChange={handleDropdownChange}
              options={getCustomFieldOptions(cf)}
              required={cf.required}
              placeholder={cf.placeholder || lbl}
              allowOther={Boolean(cf.allowOther)}
            />
            {linkedTable && secondaryCols.length > 0 && val && cf.showExtractedOnForm && (
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: 8,
                  padding: "5px 8px",
                  fontSize: "0.75rem",
                  color: "#166534",
                  fontWeight: 600
                }}
              >
                {secondaryCols.map((colName) => (
                  <span key={colName}>
                    {colName}: <strong>{form.customFields?.[`${cf.id}__${colName}`] || "-"}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      }

      if (cf.type === "multiselect") {
        const opts = getCustomFieldOptions(cf);
        const arr = Array.isArray(val) ? val : [];
        const toggleOpt = (opt) => {
          if (arr.includes(opt)) setVal(arr.filter((x) => x !== opt));
          else setVal([...arr, opt]);
        };
        return (
          <div key={cf.id} className="mat-field" style={{ gridColumn: "1 / -1" }}>
            <label className="mat-label">
              {lbl} {cf.required ? "*" : ""}
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "6px 0" }}>
              {opts.map((opt) => {
                const checked = arr.includes(opt);
                return (
                  <label
                    key={opt}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 10px",
                      borderRadius: 999,
                      border: `1px solid ${checked ? "#D97706" : "#CBD5E1"}`,
                      background: checked ? "#FFFBEB" : "#FFFFFF",
                      fontSize: "0.8rem",
                      fontWeight: checked ? 700 : 500,
                      cursor: "pointer"
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleOpt(opt)} />
                    {opt}
                  </label>
                );
              })}
            </div>
          </div>
        );
      }

      if (cf.type === "radio") {
        const opts = getCustomFieldOptions(cf);
        return (
          <div key={cf.id} className="mat-field">
            <label className="mat-label">
              {lbl} {cf.required ? "*" : ""}
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "6px 0" }}>
              {opts.map((opt) => (
                <label
                  key={opt}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.83rem", fontWeight: 600, cursor: "pointer" }}
                >
                  <input
                    type="radio"
                    name={`cf_radio_${cf.id}`}
                    required={cf.required}
                    checked={val === opt}
                    onChange={() => setVal(opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        );
      }

      if (cf.type === "file") {
        const isImg = typeof val === "string" && (val.startsWith("data:image") || /\.(jpg|jpeg|png|webp)/i.test(val) || val.includes("drive.google.com/thumbnail"));
        return (
          <div key={cf.id} className="mat-field">
            <label className="mat-label">
              {lbl} {cf.required ? "*" : ""}
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              className="mat-input"
              required={cf.required && !val}
              onChange={(e) => handleCustomFileUpload(e.target.files?.[0], setVal)}
            />
            {val && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                {isImg ? (
                  <img src={val} alt={lbl} className="mat-thumb" />
                ) : (
                  <span className="mat-badge approved">📎 File Attached</span>
                )}
                <button type="button" className="mat-btn mat-btn-outline mat-btn-sm" onClick={() => setVal("")}>
                  Remove
                </button>
              </div>
            )}
          </div>
        );
      }

      if (cf.type === "textarea") {
        return (
          <div key={cf.id} className="mat-field" style={{ gridColumn: "1 / -1" }}>
            <label className="mat-label">
              {lbl} {cf.required ? "*" : ""}
            </label>
            <textarea
              rows={2}
              className="mat-textarea"
              required={cf.required}
              placeholder={cf.placeholder || ""}
              value={val || ""}
              onChange={(e) => setVal(e.target.value)}
            />
          </div>
        );
      }

      const inputTypeMap = {
        number: "number",
        date: "date",
        time: "time",
        phone: "tel",
        email: "email",
        url: "url",
        text: "text"
      };

      return (
        <div key={cf.id} className="mat-field">
          <label className="mat-label">
            {lbl} {cf.required ? "*" : ""}
          </label>
          <input
            type={inputTypeMap[cf.type] || "text"}
            className="mat-input"
            required={cf.required}
            placeholder={cf.placeholder || ""}
            value={val || ""}
            onChange={(e) => setVal(e.target.value)}
          />
        </div>
      );
    });
  };

  // ── FORM FIELD EDIT / HIDE / REORDER HELPERS (Admin Drag & Drop + Inline Edit/Delete) ──
  const activeFieldConfig = reorderMode ? fieldConfigDraft : store.formFieldConfig || {};

  const getBuiltInLabel = (fieldKey, fallbackLabel) => {
    const cfg = activeFieldConfig?.[fieldKey];
    if (cfg) {
      if (lang === "gu" && cfg.labelGu) return cfg.labelGu;
      if (lang === "en" && cfg.labelEn) return cfg.labelEn;
      if (cfg.labelEn) return cfg.labelEn;
    }
    return fallbackLabel;
  };

  const isBuiltInRequired = (fieldKey, defaultReq = false) => {
    if (CORE_LOCKED_FIELDS.has(fieldKey)) return true;
    const cfg = activeFieldConfig?.[fieldKey];
    if (cfg && typeof cfg.required === "boolean") return cfg.required;
    return defaultReq;
  };

  const isFieldHidden = (fieldKey) => {
    if (CORE_LOCKED_FIELDS.has(fieldKey)) return false;
    return Boolean(activeFieldConfig?.[fieldKey]?.hidden);
  };

  // Compute unified section orders so EVERY field (built-in + custom) belongs to exactly 1 section and can be dragged across sections!
  const computeAllSectionOrders = (sourceOrderMap) => {
    const sections = Object.keys(DEFAULT_SECTION_FIELD_ORDER);
    const allBuiltIn = sections.flatMap((s) => DEFAULT_SECTION_FIELD_ORDER[s]);
    const allCustom = activeCustomFields.map((f) => f.id);
    const validSet = new Set([...allBuiltIn, ...allCustom]);

    const result = {};
    const placed = new Set();

    // 1. Place keys already saved in sourceOrderMap (preserving cross-section moves)
    for (const sec of sections) {
      const arr = Array.isArray(sourceOrderMap?.[sec]) ? sourceOrderMap[sec] : [];
      result[sec] = [];
      for (const k of arr) {
        if (validSet.has(k) && !placed.has(k)) {
          result[sec].push(k);
          placed.add(k);
        }
      }
    }

    // 2. Append any unplaced built-in fields to their default section
    for (const sec of sections) {
      for (const k of DEFAULT_SECTION_FIELD_ORDER[sec]) {
        if (!placed.has(k)) {
          result[sec].push(k);
          placed.add(k);
        }
      }
    }

    // 3. Append any unplaced custom fields to their configured section
    for (const cf of activeCustomFields) {
      if (!placed.has(cf.id)) {
        const targetSec = result[cf.section] ? cf.section : "extra";
        result[targetSec].push(cf.id);
        placed.add(cf.id);
      }
    }

    return result;
  };

  const effectiveOrders = useMemo(
    () => computeAllSectionOrders(reorderMode ? orderDraft : store.formFieldOrder),
    [reorderMode, orderDraft, store.formFieldOrder, activeCustomFields]
  );

  const getEffectiveSectionOrder = (sectionKey) => effectiveOrders[sectionKey] || [];

  const moveFieldAcrossSections = (fromSec, fromIdx, toSec, toIdx = null) => {
    const next = {};
    for (const sec of Object.keys(DEFAULT_SECTION_FIELD_ORDER)) {
      next[sec] = [...(effectiveOrders[sec] || [])];
    }
    if (!next[fromSec] || !next[toSec]) return;
    if (fromIdx < 0 || fromIdx >= next[fromSec].length) return;
    if (fromSec === toSec && toIdx !== null && fromIdx === toIdx) return;

    const [movedKey] = next[fromSec].splice(fromIdx, 1);
    if (!movedKey) return;

    if (toIdx === null || toIdx >= next[toSec].length) {
      next[toSec].push(movedKey);
    } else {
      const safeIdx = Math.max(0, toIdx);
      next[toSec].splice(safeIdx, 0, movedKey);
    }
    setOrderDraft(next);
  };

  const moveSectionField = (sectionKey, fromIdx, toIdx) => {
    moveFieldAcrossSections(sectionKey, fromIdx, sectionKey, toIdx);
  };

  const handleToggleReorderMode = () => {
    if (!reorderMode) {
      setOrderDraft(computeAllSectionOrders(store.formFieldOrder));
      setFieldConfigDraft(JSON.parse(JSON.stringify(store.formFieldConfig || {})));
      setEditingFieldKey(null);
      setReorderMode(true);
    } else {
      setReorderMode(false);
      setEditingFieldKey(null);
      setDragFieldInfo(null);
      setDragOverInfo(null);
    }
  };

  const handleSaveFieldOrder = async () => {
    // Also sync customFields' section property if any custom field was dragged to another section
    const nextCustomFields = activeCustomFields.map((cf) => {
      for (const sec of Object.keys(DEFAULT_SECTION_FIELD_ORDER)) {
        if ((orderDraft?.[sec] || []).includes(cf.id)) {
          return { ...cf, section: sec };
        }
      }
      return cf;
    });
    await persistStore({
      ...store,
      formFieldOrder: orderDraft,
      formFieldConfig: fieldConfigDraft,
      customFields: nextCustomFields
    });
    setReorderMode(false);
    setEditingFieldKey(null);
    setDragFieldInfo(null);
    setDragOverInfo(null);
    setOrderSavedMsg("Form layout, section moves & field edits saved!");
    setTimeout(() => setOrderSavedMsg(""), 3000);
  };

  const handleResetFieldOrder = async () => {
    if (!window.confirm("Reset all Submit Form sections back to default field order, labels, and visibility?")) return;
    await persistStore({ ...store, formFieldOrder: {}, formFieldConfig: {} });
    setOrderDraft({});
    setFieldConfigDraft({});
    setEditingFieldKey(null);
    setReorderMode(false);
    setOrderSavedMsg("Reset to default form layout!");
    setTimeout(() => setOrderSavedMsg(""), 3000);
  };

  const handleHideField = (fieldKey) => {
    if (CORE_LOCKED_FIELDS.has(fieldKey)) return;
    setFieldConfigDraft((prev) => ({
      ...prev,
      [fieldKey]: { ...(prev[fieldKey] || {}), hidden: true }
    }));
    if (editingFieldKey === fieldKey) setEditingFieldKey(null);
  };

  const handleDeleteCustomFieldInline = async (fieldKey) => {
    const customField = activeCustomFields.find((f) => f.id === fieldKey);
    if (!customField) return;
    if (!window.confirm(`Permanently delete custom field "${customField.labelEn}" from the form?`)) return;
    await handleSaveCustomFields(activeCustomFields.filter((f) => f.id !== fieldKey));
    if (editingFieldKey === fieldKey) setEditingFieldKey(null);
  };

  const handleRestoreHiddenField = (fieldKey) => {
    setFieldConfigDraft((prev) => ({
      ...prev,
      [fieldKey]: { ...(prev[fieldKey] || {}), hidden: false }
    }));
  };

  const handleUpdateInlineFieldMeta = (fieldKey, patch) => {
    const customField = activeCustomFields.find((f) => f.id === fieldKey);
    if (customField) {
      const updated = activeCustomFields.map((f) => (f.id === fieldKey ? { ...f, ...patch } : f));
      handleSaveCustomFields(updated);
    } else {
      setFieldConfigDraft((prev) => ({
        ...prev,
        [fieldKey]: { ...(prev[fieldKey] || {}), ...patch }
      }));
    }
  };

  const handleQuickAddFieldSubmit = async (e) => {
    e.preventDefault();
    if (!quickFieldDraft.labelEn.trim()) return;
    const isChoice = ["dropdown", "multiselect", "radio"].includes(quickFieldDraft.type);
    const hasSupportTable = quickFieldDraft.type === "dropdown" && Boolean(quickFieldDraft.supportTableId);
    const inlineOpts = Array.from(
      new Set(
        (quickFieldDraft.inlineOptionsText || "")
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );

    const linkedTbl = getLinkedTableForSource(
      isChoice && !hasSupportTable ? quickFieldDraft.masterKey : "",
      hasSupportTable ? quickFieldDraft.supportTableId : ""
    );
    const resolvedSourceCol = linkedTbl
      ? quickFieldDraft.sourceColumn || linkedTbl.primaryColumn || linkedTbl.columns?.[0] || ""
      : "";
    const resolvedExtractCols = linkedTbl
      ? Array.isArray(quickFieldDraft.extractColumns)
        ? quickFieldDraft.extractColumns.filter((c) => linkedTbl.columns.includes(c) && c !== resolvedSourceCol)
        : linkedTbl.columns.filter((c) => c !== resolvedSourceCol)
      : [];

    const newField = {
      id: `cf_${Date.now()}`,
      labelEn: quickFieldDraft.labelEn.trim(),
      labelGu: quickFieldDraft.labelGu.trim() || quickFieldDraft.labelEn.trim(),
      placeholder: (quickFieldDraft.placeholder || "").trim(),
      section: quickFieldDraft.section || "personal",
      type: quickFieldDraft.type || "dropdown",
      masterKey: isChoice && !hasSupportTable ? quickFieldDraft.masterKey || "" : "",
      supportTableId: hasSupportTable ? quickFieldDraft.supportTableId : "",
      sourceColumn: resolvedSourceCol,
      extractColumns: resolvedExtractCols,
      showExtractedOnForm: Boolean(quickFieldDraft.showExtractedOnForm),
      allowOther: quickFieldDraft.type === "dropdown" ? Boolean(quickFieldDraft.allowOther) : false,
      options: isChoice && !hasSupportTable && !quickFieldDraft.masterKey ? inlineOpts : [],
      required: Boolean(quickFieldDraft.required),
      visibility: quickFieldDraft.visibility || "public",
      filterable: quickFieldDraft.type === "file" ? false : Boolean(quickFieldDraft.filterable)
    };

    const nextFields = [...activeCustomFields, newField];
    const targetSec = newField.section;
    const currentOrders = computeAllSectionOrders(reorderMode ? orderDraft : store.formFieldOrder);
    const nextOrders = {
      ...currentOrders,
      [targetSec]: [...(currentOrders[targetSec] || []), newField.id]
    };

    await persistStore({
      ...store,
      customFields: nextFields,
      formFieldOrder: nextOrders
    });

    if (reorderMode) {
      setOrderDraft(nextOrders);
    }
    setShowQuickAddField(false);
    setQuickFieldDraft({
      labelEn: "",
      labelGu: "",
      placeholder: "",
      section: targetSec,
      type: "dropdown",
      masterKey: "",
      supportTableId: "",
      sourceColumn: "",
      extractColumns: [],
      showExtractedOnForm: false,
      allowOther: false,
      inlineOptionsText: "",
      required: false,
      visibility: "public",
      filterable: true
    });
    setOrderSavedMsg(`Added "${newField.labelEn}" — drag & drop to position!`);
    setTimeout(() => setOrderSavedMsg(""), 3500);
  };

  const hiddenFieldKeys = useMemo(() => {
    const allKeys = [
      ...Object.values(DEFAULT_SECTION_FIELD_ORDER).flat(),
      ...activeCustomFields.map((f) => f.id)
    ];
    return allKeys.filter((k) => !CORE_LOCKED_FIELDS.has(k) && Boolean(activeFieldConfig?.[k]?.hidden));
  }, [activeFieldConfig, activeCustomFields]);

  const getMasterKeyLabel = (k) => {
    const prettyMap = {
      surnames: "Surnames",
      nativeVillages: "Native Villages (Vatan)",
      educations: "Educations",
      occupations: "Occupations",
      cities: "Current Cities",
      heights: "Heights",
      maritalStatuses: "Marital Statuses",
      diets: "Diets",
      incomes: "Annual Incomes",
      gotras: "Gotra / Kuldevi",
      managedBys: "Profile Managed By"
    };
    const base =
      prettyMap[k] ||
      String(k || "")
        .replace(/^custom_/, "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    const tbl = activeMasterTables?.[k];
    const count = tbl?.rows?.length ?? (activeMasterData?.[k] || []).length;
    if (tbl && Array.isArray(tbl.columns) && tbl.columns.length > 1) {
      const sec = tbl.columns.filter((c) => c !== tbl.primaryColumn).join(", ");
      return `📊 ${base} (${count} rows: ${tbl.primaryColumn} → ${sec})`;
    }
    return `${base} (${count} items)`;
  };

  const renderMasterSourceDropdown = ({ masterKey, supportTableId, onSelect, allowSupport = true, compact = false }) => {
    const allMasterKeys = Array.from(
      new Set([...Object.keys(activeMasterData || {}), ...Object.keys(activeMasterTables || {})])
    );
    const val = supportTableId ? `st::${supportTableId}` : masterKey ? `md::${masterKey}` : "";
    return (
      <select
        className="mat-select"
        style={compact ? { padding: "5px 8px", fontSize: "0.76rem" } : undefined}
        value={val}
        onChange={(e) => {
          const v = e.target.value;
          if (v.startsWith("st::")) onSelect({ supportTableId: v.slice(4), masterKey: "" });
          else if (v.startsWith("md::")) onSelect({ masterKey: v.slice(4), supportTableId: "" });
          else onSelect({ masterKey: "", supportTableId: "" });
        }}
      >
        <option value="">-- Use Inline Options / None --</option>
        {allowSupport && activeSupportTables.length > 0 && (
          <optgroup label="📊 Support Lookup Tables (CSV / Excel)">
            {activeSupportTables.map((tbl) => (
              <option key={tbl.id} value={`st::${tbl.id}`}>
                📊 {tbl.name} ({(tbl.rows || []).length} rows: {tbl.primaryColumn} →{" "}
                {tbl.columns.filter((c) => c !== tbl.primaryColumn).join(", ") || "1 col"})
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="📚 Master Data Tables & Lists">
          {allMasterKeys.map((k) => (
            <option key={k} value={`md::${k}`}>
              {getMasterKeyLabel(k)}
            </option>
          ))}
        </optgroup>
      </select>
    );
  };

  const renderSupportingColumnsConfig = ({
    masterKey,
    supportTableId,
    sourceColumn,
    extractColumns,
    showExtractedOnForm,
    onChangeConfig,
    compact = false
  }) => {
    const tbl = getLinkedTableForSource(masterKey, supportTableId);
    if (!tbl || !Array.isArray(tbl.columns) || tbl.columns.length <= 1) return null;
    const activeSourceCol = sourceColumn && tbl.columns.includes(sourceColumn) ? sourceColumn : tbl.primaryColumn || tbl.columns[0];
    const otherCols = tbl.columns.filter((c) => c !== activeSourceCol);
    const activeExtract = Array.isArray(extractColumns) ? extractColumns : otherCols;
    const isAutoExtractMode = activeExtract.length > 0;

    const toggleExtractCol = (colName) => {
      const exists = activeExtract.includes(colName);
      const next = exists ? activeExtract.filter((c) => c !== colName) : [...activeExtract, colName];
      onChangeConfig({ extractColumns: next });
    };

    return (
      <div
        style={{
          gridColumn: compact ? undefined : "1 / -1",
          background: "#F0FDF4",
          border: "1px solid #86EFAC",
          borderRadius: 8,
          padding: compact ? "7px 8px" : "10px 12px",
          fontSize: compact ? "0.73rem" : "0.8rem",
          display: "flex",
          flexDirection: "column",
          gap: 8
        }}
      >
        <div style={{ fontWeight: 700, color: "#166534" }}>
          🔗 Master Table Column Mode ({tbl.columns.length} columns)
        </div>

        {/* Dropdown Column Picker (Always Unique Values) */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 600, color: "#334155" }}>Dropdown Column (Unique Values):</span>
          <select
            className="mat-select"
            style={{ width: "auto", padding: "4px 8px", fontSize: compact ? "0.74rem" : "0.8rem" }}
            value={activeSourceCol}
            onChange={(e) => {
              const nextSrc = e.target.value;
              const nextOther = isAutoExtractMode ? tbl.columns.filter((c) => c !== nextSrc) : [];
              onChangeConfig({ sourceColumn: nextSrc, extractColumns: nextOther });
            }}
          >
            {tbl.columns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* 2-Mode Switch: Normal Dropdown Only vs Auto-Extract Dependent Columns */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", fontWeight: 600 }}>
            <input
              type="radio"
              checked={!isAutoExtractMode}
              onChange={() => onChangeConfig({ extractColumns: [], showExtractedOnForm: false })}
            />
            Normal Dropdown Only (Unique Values)
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", fontWeight: 600, color: "#166534" }}>
            <input
              type="radio"
              checked={isAutoExtractMode}
              onChange={() => onChangeConfig({ extractColumns: otherCols, showExtractedOnForm: false })}
            />
            Auto-Extract Dependent Columns → DB &amp; Dashboard (Hidden on Form)
          </label>
        </div>

        {isAutoExtractMode && (
          <>
            <div>
              <div style={{ fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                Select Dependent Column(s) to Auto-Extract Directly to Transaction Data:
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {otherCols.map((col) => (
                  <label
                    key={col}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "#FFFFFF",
                      border: "1px solid #BBF7D0",
                      borderRadius: 999,
                      padding: "3px 8px",
                      cursor: "pointer",
                      fontWeight: 600
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={activeExtract.includes(col)}
                      onChange={() => toggleExtractCol(col)}
                    />
                    {col}
                  </label>
                ))}
              </div>
            </div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#475569" }}>
              <input
                type="checkbox"
                checked={Boolean(showExtractedOnForm)}
                onChange={(e) => onChangeConfig({ showExtractedOnForm: e.target.checked })}
              />
              Show extracted value preview on Submit Form (leave unchecked to keep hidden on form)
            </label>
          </>
        )}
      </div>
    );
  };

  const getReadableFieldName = (fieldKey) => {
    const customObj = activeCustomFields.find((f) => f.id === fieldKey);
    if (customObj) return customObj.labelEn || fieldKey;
    return activeFieldConfig?.[fieldKey]?.labelEn || fieldKey;
  };

  // If Admin changed a built-in field's Data Type (e.g. Mosal -> Dropdown) or connected a Master/Support Table, render it dynamically!
  const BUILTIN_DEFAULT_LABELS = {
    fullName: t.lblFullName,
    surname: t.lblSurname,
    gender: t.lblGender,
    dob: t.lblDob,
    height: t.lblHeight,
    maritalStatus: t.lblMarital,
    diet: t.lblDiet,
    photo: t.lblPhoto,
    nativeVillage: t.lblNativeVillage,
    mosal: t.lblMosal,
    gotra: t.lblGotra,
    city: t.lblCity,
    isNri: t.lblNri,
    education: t.lblEducation,
    occupation: t.lblOccupation,
    company: t.lblCompany,
    income: t.lblIncome,
    fatherName: t.lblFatherName,
    motherName: t.lblMotherName,
    siblings: t.lblSiblings,
    managedBy: t.lblManagedBy,
    mobile: t.lblMobile,
    email: t.lblEmail
  };

  const renderBuiltInWithOverrides = (fieldKey, defaultNode) => {
    const cfg = activeFieldConfig?.[fieldKey];
    if (!cfg || (!cfg.type && !cfg.supportTableId && !cfg.masterKey)) {
      return defaultNode;
    }
    const effectiveType = cfg.type || "dropdown";
    const lbl = getBuiltInLabel(fieldKey, BUILTIN_DEFAULT_LABELS[fieldKey] || fieldKey);
    const req = isBuiltInRequired(fieldKey, false);
    const val = form?.[fieldKey] ?? "";

    if (effectiveType === "dropdown") {
      const tbl = getLinkedTableForSource(cfg.masterKey, cfg.supportTableId);
      const sourceCol = tbl ? cfg.sourceColumn || tbl.primaryColumn || tbl.columns?.[0] : "";
      const extractCols = tbl
        ? Array.isArray(cfg.extractColumns)
          ? cfg.extractColumns.filter((c) => tbl.columns.includes(c) && c !== sourceCol)
          : []
        : [];
      const opts = getCustomFieldOptions({
        masterKey: cfg.masterKey || "",
        supportTableId: cfg.supportTableId || "",
        sourceColumn: sourceCol,
        options: Array.isArray(cfg.options) ? cfg.options : []
      });

      const handleChange = (nextVal) => {
        setForm((prev) => {
          const nextCustom = { ...(prev.customFields || {}) };
          if (tbl && extractCols.length > 0) {
            const matchedRow = (tbl.rows || []).find(
              (r) => String(r?.[sourceCol] || "").trim().toUpperCase() === String(nextVal || "").trim().toUpperCase()
            );
            for (const colName of extractCols) {
              nextCustom[`bf_${fieldKey}__${colName}`] = matchedRow ? matchedRow[colName] || "" : "";
            }
          }
          return { ...prev, [fieldKey]: nextVal, customFields: nextCustom };
        });
      };

      return (
        <div className="mat-field">
          <label className="mat-label">
            {lbl} {req && !String(lbl).includes("*") ? "*" : ""}
          </label>
          <MasterSelectInput
            required={req}
            value={val}
            onChange={handleChange}
            options={opts}
            placeholder={lbl}
            allowOther={Boolean(cfg.allowOther)}
          />
          {tbl && extractCols.length > 0 && val && cfg.showExtractedOnForm && (
            <div
              style={{
                marginTop: 5,
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: 8,
                padding: "4px 8px",
                fontSize: "0.74rem",
                color: "#166534",
                fontWeight: 600
              }}
            >
              {extractCols.map((colName) => (
                <span key={colName}>
                  {colName}: <strong>{form.customFields?.[`bf_${fieldKey}__${colName}`] || "-"}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (effectiveType === "textarea") {
      return (
        <div className="mat-field">
          <label className="mat-label">
            {lbl} {req && !String(lbl).includes("*") ? "*" : ""}
          </label>
          <textarea
            rows={2}
            className="mat-textarea"
            required={req}
            value={val}
            onChange={(e) => setForm({ ...form, [fieldKey]: e.target.value })}
          />
        </div>
      );
    }

    const inputMap = { number: "number", date: "date", time: "time", phone: "tel", email: "email", url: "url", text: "text" };
    return (
      <div className="mat-field">
        <label className="mat-label">
          {lbl} {req && !String(lbl).includes("*") ? "*" : ""}
        </label>
        <input
          type={inputMap[effectiveType] || "text"}
          className="mat-input"
          required={req}
          value={val}
          onChange={(e) => setForm({ ...form, [fieldKey]: e.target.value })}
        />
      </div>
    );
  };

  const renderOrderedSectionFields = (sectionKey, allBuiltInMap = {}) => {
    // Build unified custom node map across ALL sections so any custom field dragged into this section renders here!
    const allCustomMap = {};
    for (const sec of Object.keys(DEFAULT_SECTION_FIELD_ORDER)) {
      const list = renderCustomFieldsForSection(sec) || [];
      for (const node of list) {
        if (node?.key) allCustomMap[node.key] = node;
      }
    }

    const keys = getEffectiveSectionOrder(sectionKey);
    const renderedCards = keys.map((fieldKey, idx) => {
      if (isFieldHidden(fieldKey)) return null;
      const node = allBuiltInMap[fieldKey]
        ? renderBuiltInWithOverrides(fieldKey, allBuiltInMap[fieldKey])
        : allCustomMap[fieldKey];
      if (!node) return null;

      if (!isAdmin || !reorderMode) {
        return <React.Fragment key={fieldKey}>{node}</React.Fragment>;
      }

      const isCore = CORE_LOCKED_FIELDS.has(fieldKey);
      const customObj = activeCustomFields.find((f) => f.id === fieldKey);
      const isEditingThis = editingFieldKey === fieldKey;
      const isDragging = dragFieldInfo?.sectionKey === sectionKey && dragFieldInfo?.idx === idx;
      const isDragOver =
        dragOverInfo?.sectionKey === sectionKey &&
        dragOverInfo?.idx === idx &&
        Boolean(dragFieldInfo) &&
        !(dragFieldInfo.sectionKey === sectionKey && dragFieldInfo.idx === idx);

      const curLabelEn = customObj ? customObj.labelEn : fieldConfigDraft?.[fieldKey]?.labelEn || "";
      const curLabelGu = customObj ? customObj.labelGu : fieldConfigDraft?.[fieldKey]?.labelGu || "";
      const curReq = customObj ? Boolean(customObj.required) : isBuiltInRequired(fieldKey, false);

      return (
        <div
          key={fieldKey}
          draggable={!isEditingThis}
          onDragStart={(e) => {
            if (isEditingThis) return;
            e.dataTransfer.effectAllowed = "move";
            try {
              e.dataTransfer.setData("text/plain", `${sectionKey}:${idx}:${fieldKey}`);
            } catch {}
            setDragFieldInfo({ sectionKey, idx, fieldKey });
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            if (dragFieldInfo) setDragOverInfo({ sectionKey, idx });
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (dragFieldInfo && (dragOverInfo?.sectionKey !== sectionKey || dragOverInfo?.idx !== idx)) {
              setDragOverInfo({ sectionKey, idx });
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragFieldInfo) {
              moveFieldAcrossSections(dragFieldInfo.sectionKey, dragFieldInfo.idx, sectionKey, idx);
            }
            setDragFieldInfo(null);
            setDragOverInfo(null);
          }}
          onDragEnd={() => {
            setDragFieldInfo(null);
            setDragOverInfo(null);
          }}
          style={{
            border: isDragOver
              ? "2.5px solid #0D4B5E"
              : `2px dashed ${isDragging ? "#0284C7" : "#F59E0B"}`,
            borderRadius: 10,
            padding: 8,
            background: isDragOver ? "#E0F2FE" : isDragging ? "#F0F9FF" : "#FFFBEB",
            opacity: isDragging ? 0.55 : 1,
            transform: isDragOver ? "scale(1.02)" : "none",
            boxShadow: isDragOver ? "0 6px 18px rgba(13, 75, 94, 0.22)" : "none",
            cursor: isEditingThis ? "default" : isDragging ? "grabbing" : "grab",
            transition: "all 0.14s ease"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 4,
              marginBottom: 6,
              paddingBottom: 4,
              borderBottom: "1px solid #FDE68A"
            }}
          >
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: isDragOver ? "#0D4B5E" : "#92400E" }}>
              {isDragOver ? "⬇ Drop Here" : `⋮⋮ #${idx + 1}`}
            </span>
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              <button
                type="button"
                className="mat-btn mat-btn-outline mat-btn-sm"
                style={{ padding: "2px 6px", fontSize: "0.7rem" }}
                disabled={idx === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  moveSectionField(sectionKey, idx, idx - 1);
                }}
                title="Move Left / Up"
              >
                ◀
              </button>
              <button
                type="button"
                className="mat-btn mat-btn-outline mat-btn-sm"
                style={{ padding: "2px 6px", fontSize: "0.7rem" }}
                disabled={idx === keys.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  moveSectionField(sectionKey, idx, idx + 1);
                }}
                title="Move Right / Down"
              >
                ▶
              </button>
              <button
                type="button"
                className={`mat-btn mat-btn-sm ${isEditingThis ? "mat-btn-teal" : "mat-btn-outline"}`}
                style={{ padding: "2px 6px", fontSize: "0.7rem" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingFieldKey(isEditingThis ? null : fieldKey);
                }}
                title="Edit Label / Section / Required"
              >
                ✏️
              </button>
              {isCore ? (
                <span
                  title="Core field (required for Dashboard KPIs & Contact) — can be renamed or dragged to any section"
                  style={{ fontSize: "0.72rem", padding: "2px 4px", opacity: 0.7 }}
                >
                  🔒
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className="mat-btn mat-btn-outline mat-btn-sm"
                    style={{ padding: "2px 6px", fontSize: "0.7rem", color: "#92400E", borderColor: "#FCD34D" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHideField(fieldKey);
                    }}
                    title="Hide Field from Form (can be restored anytime)"
                  >
                    🙈
                  </button>
                  {customObj && (
                    <button
                      type="button"
                      className="mat-btn mat-btn-danger mat-btn-sm"
                      style={{ padding: "2px 6px", fontSize: "0.7rem" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCustomFieldInline(fieldKey);
                      }}
                      title="Permanently Delete Custom Field"
                    >
                      🗑️
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {isEditingThis ? (
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: 8,
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 6
              }}
            >
              <input
                className="mat-input"
                style={{ padding: "5px 8px", fontSize: "0.78rem" }}
                placeholder="Custom Label (English)"
                value={curLabelEn}
                onChange={(e) => handleUpdateInlineFieldMeta(fieldKey, { labelEn: e.target.value })}
              />
              <input
                className="mat-input"
                style={{ padding: "5px 8px", fontSize: "0.78rem" }}
                placeholder="Custom Label (Gujarati)"
                value={curLabelGu}
                onChange={(e) => handleUpdateInlineFieldMeta(fieldKey, { labelGu: e.target.value })}
              />
              <select
                className="mat-select"
                style={{ padding: "5px 8px", fontSize: "0.76rem" }}
                value={sectionKey}
                onChange={(e) => {
                  const targetSec = e.target.value;
                  if (targetSec !== sectionKey) {
                    moveFieldAcrossSections(sectionKey, idx, targetSec, null);
                  }
                }}
              >
                <option value="personal">Section 1: Personal Details</option>
                <option value="community">Section 2: Community & Location</option>
                <option value="career">Section 3: Education & Career</option>
                <option value="family">Section 4: Family & Contact</option>
                <option value="extra">Section 5: Additional Details</option>
              </select>
              {(() => {
                const isFixedSpecialBuiltIn = ["photo", "dob", "gender", "isNri"].includes(fieldKey);
                if (isFixedSpecialBuiltIn) return null;

                const curType = customObj ? customObj.type || "text" : fieldConfigDraft?.[fieldKey]?.type || "";
                const curMasterKey = customObj ? customObj.masterKey || "" : fieldConfigDraft?.[fieldKey]?.masterKey || "";
                const curSupportId = customObj ? customObj.supportTableId || "" : fieldConfigDraft?.[fieldKey]?.supportTableId || "";
                const curSourceCol = customObj ? customObj.sourceColumn || "" : fieldConfigDraft?.[fieldKey]?.sourceColumn || "";
                const curExtractCols = customObj ? customObj.extractColumns : fieldConfigDraft?.[fieldKey]?.extractColumns;
                const curShowExtracted = customObj ? customObj.showExtractedOnForm : fieldConfigDraft?.[fieldKey]?.showExtractedOnForm;
                const curAllowOther = customObj
                  ? Boolean(customObj.allowOther)
                  : Boolean(fieldConfigDraft?.[fieldKey]?.allowOther);
                const curOptionsText = customObj
                  ? Array.isArray(customObj.options) ? customObj.options.join(", ") : ""
                  : Array.isArray(fieldConfigDraft?.[fieldKey]?.options)
                  ? fieldConfigDraft[fieldKey].options.join(", ")
                  : "";

                const isBuiltInDropdown =
                  !customObj &&
                  !curType &&
                  ["surname", "height", "maritalStatus", "diet", "nativeVillage", "gotra", "city", "education", "occupation", "income", "managedBy"].includes(fieldKey);
                const isDropdownField = curType === "dropdown" || isBuiltInDropdown;
                const isChoiceType =
                  ["dropdown", "multiselect", "radio"].includes(curType) || isBuiltInDropdown;

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>
                      <div style={{ fontSize: "0.69rem", fontWeight: 700, color: "#475569", marginBottom: 2 }}>
                        Field Data Type:
                      </div>
                      <select
                        className="mat-select"
                        style={{ padding: "5px 8px", fontSize: "0.76rem" }}
                        value={curType}
                        onChange={(e) => handleUpdateInlineFieldMeta(fieldKey, { type: e.target.value })}
                      >
                        {!customObj && <option value="">Default Built-in Type</option>}
                        <option value="dropdown">Dropdown (Single Select)</option>
                        <option value="text">Text (Single Line)</option>
                        <option value="textarea">Long Text (Paragraph)</option>
                        <option value="number">Number</option>
                        <option value="date">Date Picker</option>
                        <option value="time">Time Picker</option>
                        <option value="phone">Phone / WhatsApp</option>
                        <option value="email">Email Address</option>
                        <option value="url">Website / URL</option>
                        {customObj && <option value="multiselect">Multi-Select Checkboxes</option>}
                        {customObj && <option value="radio">Radio Buttons</option>}
                        {customObj && <option value="checkbox">Checkbox (Yes / No)</option>}
                        {customObj && <option value="file">File / Image Upload</option>}
                      </select>
                    </div>

                    {isChoiceType && (
                      <>
                        <div>
                          <div style={{ fontSize: "0.69rem", fontWeight: 700, color: "#475569", marginBottom: 2 }}>
                            Master File / Table Connection:
                          </div>
                          {renderMasterSourceDropdown({
                            masterKey: curMasterKey,
                            supportTableId: curSupportId,
                            allowSupport: true,
                            compact: true,
                            onSelect: (patch) => {
                              const tbl = getLinkedTableForSource(patch.masterKey, patch.supportTableId);
                              const pCol = tbl ? tbl.primaryColumn || tbl.columns?.[0] || "" : "";
                              const otherCols = tbl ? (tbl.columns || []).filter((c) => c !== pCol) : [];
                              handleUpdateInlineFieldMeta(fieldKey, {
                                ...patch,
                                ...(!customObj && !curType ? { type: "dropdown" } : {}),
                                sourceColumn: pCol,
                                extractColumns: otherCols
                              });
                            }
                          })}
                        </div>

                        {!curMasterKey && !curSupportId && (
                          <input
                            className="mat-input"
                            style={{ padding: "5px 8px", fontSize: "0.76rem" }}
                            placeholder="Inline options (comma-separated, e.g. Opt 1, Opt 2)"
                            value={curOptionsText}
                            onChange={(e) => {
                              const opts = e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean);
                              handleUpdateInlineFieldMeta(fieldKey, { options: opts });
                            }}
                          />
                        )}

                        {renderSupportingColumnsConfig({
                          masterKey: curMasterKey,
                          supportTableId: curSupportId,
                          sourceColumn: curSourceCol,
                          extractColumns: curExtractCols,
                          showExtractedOnForm: curShowExtracted,
                          compact: true,
                          onChangeConfig: (cfgPatch) => handleUpdateInlineFieldMeta(fieldKey, cfgPatch)
                        })}

                        {isDropdownField && (
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: "#FFFBEB",
                              border: "1px solid #FDE68A",
                              borderRadius: 6,
                              padding: "5px 8px",
                              color: "#92400E",
                              cursor: "pointer"
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={curAllowOther}
                              onChange={(e) =>
                                handleUpdateInlineFieldMeta(fieldKey, { allowOther: e.target.checked })
                              }
                            />
                            Allow &quot;Other&quot; option (free-text + * mark)
                          </label>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
              {!isCore && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.76rem", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={curReq}
                    onChange={(e) => handleUpdateInlineFieldMeta(fieldKey, { required: e.target.checked })}
                  />
                  Required Field (*)
                </label>
              )}
              <button
                type="button"
                className="mat-btn mat-btn-teal mat-btn-sm"
                onClick={() => setEditingFieldKey(null)}
              >
                Done
              </button>
            </div>
          ) : (
            <div style={{ pointerEvents: "none", userSelect: "none" }}>{node}</div>
          )}
        </div>
      );
    });

    // In Reorder Mode, add an explicit Cross-Section Drop Zone at the end of every section!
    if (isAdmin && reorderMode) {
      const isZoneOver = dragOverInfo?.sectionKey === sectionKey && dragOverInfo?.idx === "END";
      renderedCards.push(
        <div
          key={`__dropzone_${sectionKey}`}
          onDragEnter={(e) => {
            e.preventDefault();
            if (dragFieldInfo) setDragOverInfo({ sectionKey, idx: "END" });
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (dragFieldInfo && (dragOverInfo?.sectionKey !== sectionKey || dragOverInfo?.idx !== "END")) {
              setDragOverInfo({ sectionKey, idx: "END" });
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragFieldInfo) {
              moveFieldAcrossSections(dragFieldInfo.sectionKey, dragFieldInfo.idx, sectionKey, null);
            }
            setDragFieldInfo(null);
            setDragOverInfo(null);
          }}
          style={{
            border: isZoneOver ? "2.5px dashed #0D4B5E" : "2px dashed #CBD5E1",
            borderRadius: 10,
            minHeight: 74,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 10,
            fontSize: "0.78rem",
            fontWeight: 700,
            color: isZoneOver ? "#0D4B5E" : "#64748B",
            background: isZoneOver ? "#E0F2FE" : "#F8FAFC",
            transition: "all 0.15s ease"
          }}
        >
          {isZoneOver ? "⬇ Release to Move Field Here" : "➕ Drop any field here"}
        </div>
      );
    }

    return renderedCards;
  };

  const hasDemoData = useMemo(
    () => (store.profiles || []).some((p) => p.isDemo) || (store.contactRequests || []).some((r) => r.isDemo),
    [store.profiles, store.contactRequests]
  );

  const handleLoadDemoData = async () => {
    const existingIds = new Set((store.profiles || []).map((p) => p.profileId));
    const mergedProfiles = [
      ...(store.profiles || []),
      ...DUMMY_MATRIMONY_PROFILES.filter((d) => !existingIds.has(d.profileId))
    ];
    const existingReqIds = new Set((store.contactRequests || []).map((r) => r.id));
    const mergedRequests = [
      ...(store.contactRequests || []),
      ...DUMMY_CONTACT_REQUESTS.filter((d) => !existingReqIds.has(d.id))
    ];
    const res = await persistStore({
      ...store,
      profiles: mergedProfiles,
      contactRequests: mergedRequests,
      demoCleared: false
    });
    setSettingsSavedMsg(
      `Loaded 12 demo profiles & 2 sample requests (${res.synced === "gdrive" ? "Synced to Google Drive" : res.synced === "hostinger" ? "Synced to Hostinger" : "Saved locally"})!`
    );
    setTimeout(() => setSettingsSavedMsg(""), 4000);
  };

  const handleClearDemoData = async () => {
    if (!window.confirm("Remove all demo test profiles and demo contact requests? Real profiles will remain untouched.")) {
      return;
    }
    const cleanProfiles = (store.profiles || []).filter((p) => !p.isDemo);
    const cleanRequests = (store.contactRequests || []).filter((r) => !r.isDemo);
    await persistStore({
      ...store,
      profiles: cleanProfiles,
      contactRequests: cleanRequests,
      demoCleared: true
    });
    setSettingsSavedMsg("All demo test data cleared!");
    setTimeout(() => setSettingsSavedMsg(""), 3000);
  };

  const formatStatusBadge = (status) => {
    if (status === "approved") return <span className="mat-badge approved">✓ {t.statusApproved}</span>;
    if (status === "rejected") return <span className="mat-badge rejected">✕ {t.statusRejected}</span>;
    if (status === "married") return <span className="mat-badge married">💍 {t.statusMarried}</span>;
    return <span className="mat-badge pending">⏳ {t.statusPending}</span>;
  };

  // Shared full-profile sheet used identically in Matchmaker Column 1 (Base) and Column 3 (Selected Match)
  const renderFullProfileSheet = (p) => {
    if (!p) return null;
    const age = calculateAge(p.dob);
    const cleanPhone = String(p.mobile || "").replace(/\D/g, "");
    const specs = [
      { label: t.surname, val: p.surname },
      { label: `${t.age} / DOB`, val: `${age !== null ? `${age} ${t.yrs}` : "-"} (${p.dob || "-"})` },
      { label: t.height, val: p.height || "-" },
      { label: t.maritalStatus, val: p.maritalStatus || "-" },
      { label: t.education, val: p.education || "-" },
      { label: t.occupation, val: p.occupation || "-" },
      { label: t.lblCompany, val: p.company || "-" },
      { label: t.lblIncome, val: p.income || "-" },
      { label: t.nativeVillage, val: p.nativeVillage || "-" },
      { label: t.mosal, val: p.mosal || "-" },
      { label: t.lblGotra, val: p.gotra || "-" },
      { label: t.city, val: `${p.city || "-"}${p.isNri ? " (NRI)" : ""}` },
      { label: t.lblDiet, val: p.diet || "-" },
      { label: t.lblManagedBy, val: p.managedBy || "-" },
      { label: t.lblFatherName, val: p.fatherName || "-" },
      { label: t.lblMotherName, val: p.motherName || "-" },
      { label: t.lblSiblings, val: p.siblings || "-" },
      { label: t.lblEmail, val: p.email || "-" },
      ...expandedCustomDescriptors.map((desc) => {
        const raw = p.customFields?.[desc.key];
        let display = "-";
        if (Array.isArray(raw)) display = raw.length ? raw.join(", ") : "-";
        else if (typeof raw === "boolean") display = raw ? "Yes" : "No";
        else if (desc.type === "file" && raw) {
          display = (
            <a href={raw} target="_blank" rel="noreferrer" style={{ color: "#0284C7", fontWeight: 700 }}>
              📎 View Attachment
            </a>
          );
        } else if (desc.type === "url" && raw) {
          display = (
            <a href={raw} target="_blank" rel="noreferrer" style={{ color: "#0284C7", fontWeight: 700 }}>
              🔗 Open Link
            </a>
          );
        } else if (raw) {
          display = String(raw);
        }
        return { label: lang === "gu" ? desc.labelGu || desc.labelEn : desc.labelEn, val: display };
      })
    ];

    return (
      <div className="mat-profile-sheet">
        <div className="mat-profile-hero">
          {p.photo ? (
            <img src={p.photo} alt={p.fullName} className="mat-profile-avatar" />
          ) : (
            <div className="mat-profile-avatar">{p.gender === "Female" ? "👩" : "👨"}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontWeight: 800, color: "#0D4B5E", fontSize: "0.78rem" }}>{p.profileId}</span>
              <span className={`mat-badge ${p.gender === "Male" ? "male" : "female"}`}>
                {p.gender === "Male" ? `♂ ${t.maleShort}` : `♀ ${t.femaleShort}`}
              </span>
              {formatStatusBadge(p.status)}
            </div>
            <div style={{ fontWeight: 800, fontSize: "1.02rem", color: "#0F172A", lineHeight: 1.25 }}>
              {p.fullName}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#334155", marginTop: 4, fontWeight: 600 }}>
              📞 {p.mobile || "-"}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {cleanPhone && (
                <>
                  <a href={`tel:${cleanPhone}`} className="mat-btn mat-btn-outline mat-btn-sm" style={{ textDecoration: "none" }}>
                    📞 {t.call}
                  </a>
                  <a
                    href={`https://wa.me/91${cleanPhone.slice(-10)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mat-btn mat-btn-success mat-btn-sm"
                    style={{ textDecoration: "none" }}
                  >
                    💬 {t.whatsapp}
                  </a>
                </>
              )}
              <button
                type="button"
                className="mat-btn mat-btn-outline mat-btn-sm"
                onClick={() => handleStartEditProfile(p)}
                title="Edit & Correct Profile Data"
              >
                ✏️ {t.edit}
              </button>
              <button
                type="button"
                className="mat-btn mat-btn-teal mat-btn-sm"
                onClick={() => exportSingleBiodataPdf(p, activeCustomFields, activeSupportTables, activeMasterTables)}
              >
                📄 PDF
              </button>
            </div>
          </div>
        </div>

        <div className="mat-spec-grid">
          {specs.map((item) => (
            <div key={item.label} className="mat-spec-item">
              <div className="mat-spec-label">{item.label}</div>
              <div className="mat-spec-val">{item.val}</div>
            </div>
          ))}
        </div>

        {p.notes && (
          <div
            style={{
              marginTop: 10,
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: "0.78rem",
              color: "#78350F"
            }}
          >
            <strong>{t.lblNotes}:</strong> {p.notes}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mat-page">
      {/* Top Header */}
      <header className="mat-header">
        <div className="mat-header-inner">
          <div className="mat-brand">
            <div className="mat-brand-icon">💍</div>
            <div>
              <div className="mat-brand-title">{t.portalTitle}</div>
              <div className="mat-brand-sub">{t.portalSubtitle}</div>
            </div>
          </div>

          <div className="mat-header-actions">
            {onBack && (
              <button className="mat-btn mat-btn-ghost" onClick={onBack}>
                ← {t.backToPortal}
              </button>
            )}

            <button
              className="mat-btn mat-btn-ghost"
              onClick={() => setLang((prev) => (prev === "en" ? "gu" : "en"))}
              title="Switch Language"
            >
              🌐 {t.langToggle}
            </button>

            <button
              className="mat-btn mat-btn-primary"
              onClick={() => {
                setEditingProfileId(null);
                setForm({
                  ...EMPTY_FORM,
                  mobile: publicUser?.mobile || "",
                  email: publicUser?.email || ""
                });
                setSubmittedProfileId("");
                setActiveTab("register");
                if (!isAuthenticatedForAction) {
                  setPendingLoginAction({ type: "register" });
                  setShowPublicLogin(true);
                }
              }}
            >
              + {t.registerBtn}
            </button>

            {!isAdmin && (
              isPublicLoggedIn ? (
                <>
                  <span
                    style={{
                      background: "rgba(255,255,255,0.18)",
                      color: "#FFFFFF",
                      padding: "6px 10px",
                      borderRadius: 8,
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      border: "1px solid rgba(255,255,255,0.28)"
                    }}
                  >
                    👤 {publicUser?.name || publicUser?.mobile || "Member"}
                  </span>
                  <button className="mat-btn mat-btn-ghost" onClick={handlePublicLogout}>
                    {t.logout}
                  </button>
                </>
              ) : (
                <button
                  className="mat-btn mat-btn-ghost"
                  onClick={() => {
                    setPendingLoginAction(null);
                    setShowPublicLogin(true);
                  }}
                >
                  👤 Member Login
                </button>
              )
            )}

            {isAdmin ? (
              <>
                <span
                  style={{
                    background: "#DCFCE7",
                    color: "#166534",
                    padding: "6px 10px",
                    borderRadius: 8,
                    fontSize: "0.76rem",
                    fontWeight: 700
                  }}
                >
                  🛡️ {t.adminActive}
                </span>
                <button className="mat-btn mat-btn-ghost" onClick={handleAdminLogout}>
                  {t.logout}
                </button>
              </>
            ) : (
              <button className="mat-btn mat-btn-ghost" onClick={() => setShowAdminLogin(true)}>
                🔐 {t.adminLogin}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mat-container">
        {adminEditSavedMsg && (
          <div
            style={{
              background: "#DCFCE7",
              color: "#166534",
              border: "1px solid #86EFAC",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 14,
              fontSize: "0.86rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <span>✓ {adminEditSavedMsg}</span>
            <button
              type="button"
              style={{ background: "none", border: "none", color: "#166534", cursor: "pointer", fontWeight: 800 }}
              onClick={() => setAdminEditSavedMsg("")}
            >
              ✕
            </button>
          </div>
        )}
        {/* Navigation Tabs (Desktop full row + Mobile 2-button Expand/Collapse menu) */}
        {(() => {
          const navTabs = [
            { id: "dashboard", icon: "📊", label: t.tabDashboard, badge: 0 },
            { id: "surnameTable", icon: "📋", label: t.tabSurnameTable, badge: 0 },
            { id: "register", icon: "📝", label: t.tabRegister, badge: 0 },
            ...(isAdmin
              ? [
                  { id: "adminProfiles", icon: "🛡️", label: t.tabAdminProfiles, badge: kpis.pending || 0 },
                  { id: "adminMatcher", icon: "💘", label: t.tabAdminMatcher, badge: 0 },
                  { id: "adminMasterData", icon: "📚", label: t.tabAdminMasterData, badge: 0 },
                  { id: "adminRequests", icon: "📩", label: t.tabAdminRequests, badge: kpis.openRequests || 0 },
                  { id: "adminReports", icon: "⚙️", label: t.tabAdminReports, badge: 0 }
                ]
              : [])
          ];

          const handleSelectNavTab = (tabId) => {
            if (tabId === "register") setSubmittedProfileId("");
            setActiveTab(tabId);
            setMobileTabsExpanded(false);
          };

          // For collapsed mobile bar: always show 2 tabs including the currently active tab
          const collapsedTabs = (() => {
            const firstTwo = navTabs.slice(0, 2);
            if (firstTwo.some((item) => item.id === activeTab)) return firstTwo;
            const activeItem = navTabs.find((item) => item.id === activeTab);
            return activeItem ? [navTabs[0], activeItem] : firstTwo;
          })();
          const hiddenCount = Math.max(0, navTabs.length - 2);
          const totalHiddenBadges = navTabs
            .filter((tb) => !collapsedTabs.some((ct) => ct.id === tb.id))
            .reduce((sum, tb) => sum + (tb.badge || 0), 0);

          return (
            <>
              {/* Desktop Tabs */}
              <div className="mat-tabs mat-tabs-desktop">
                {navTabs.map((tb) => (
                  <button
                    key={tb.id}
                    type="button"
                    className={`mat-tab ${activeTab === tb.id ? "active" : ""}`}
                    onClick={() => handleSelectNavTab(tb.id)}
                  >
                    {tb.icon} {tb.label}
                    {tb.badge > 0 && <span className="mat-tab-badge">{tb.badge}</span>}
                  </button>
                ))}
              </div>

              {/* Mobile Expand / Collapse Menu */}
              <div className="mat-tabs-mobile">
                <div className="mat-tabs-mobile-grid">
                  {(mobileTabsExpanded ? navTabs : collapsedTabs).map((tb) => (
                    <button
                      key={tb.id}
                      type="button"
                      className={`mat-tab-mobile-btn ${activeTab === tb.id ? "active" : ""}`}
                      onClick={() => handleSelectNavTab(tb.id)}
                    >
                      <span className="mat-tab-mobile-label">
                        {tb.icon} {tb.label}
                      </span>
                      {tb.badge > 0 && <span className="mat-tab-badge">{tb.badge}</span>}
                    </button>
                  ))}
                </div>
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    className={`mat-tabs-mobile-toggle ${mobileTabsExpanded ? "expanded" : ""}`}
                    onClick={() => setMobileTabsExpanded((prev) => !prev)}
                  >
                    {mobileTabsExpanded ? (
                      <>▴ Collapse Menu</>
                    ) : (
                      <>
                        ☰ More Menu (+{hiddenCount}) ▾
                        {totalHiddenBadges > 0 && (
                          <span className="mat-tab-badge" style={{ marginLeft: 4 }}>
                            {totalHiddenBadges}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          );
        })()}

        {loading ? (
          <div className="mat-card" style={{ textAlign: "center", padding: 48, color: "#64748B" }}>
            Loading Matrimony Portal...
          </div>
        ) : (
          <>
            {/* ── TAB 1: PUBLIC DASHBOARD & RESTRICTED DIRECTORY ── */}
            {activeTab === "dashboard" && (
              <>
                {/* KPI Cards */}
                <div className="mat-kpi-grid">
                  <div className="mat-kpi-card total">
                    <span className="mat-kpi-label">{t.kpiTotal}</span>
                    <span className="mat-kpi-val">{kpis.totalActive}</span>
                  </div>
                  <div className="mat-kpi-card male">
                    <span className="mat-kpi-label">♂️ {t.kpiMale}</span>
                    <span className="mat-kpi-val" style={{ color: "#0284C7" }}>{kpis.male}</span>
                  </div>
                  <div className="mat-kpi-card female">
                    <span className="mat-kpi-label">♀️ {t.kpiFemale}</span>
                    <span className="mat-kpi-val" style={{ color: "#DB2777" }}>{kpis.female}</span>
                  </div>
                  <div className="mat-kpi-card amber">
                    <span className="mat-kpi-label">🏷️ {t.kpiSurnames}</span>
                    <span className="mat-kpi-val">{kpis.surnamesCount}</span>
                  </div>
                  {isAdmin && (
                    <div className="mat-kpi-card green">
                      <span className="mat-kpi-label">⏳ {t.kpiPending}</span>
                      <span className="mat-kpi-val">{kpis.pending}</span>
                    </div>
                  )}
                </div>

                {/* Age-Wise Distribution (Clickable Multi-Select Filter) */}
                <div className="mat-card">
                  <h3 className="mat-card-title">
                    <span>📈 {t.ageBreakdownTitle}</span>
                    {filterAgeBuckets.length > 0 && (
                      <button
                        className="mat-btn mat-btn-outline mat-btn-sm"
                        onClick={() => setFilterAgeBuckets([])}
                      >
                        {t.ageAll} ({filterAgeBuckets.length})
                      </button>
                    )}
                  </h3>
                  <div className="mat-age-grid">
                    {ageBreakdown.map((b) => {
                      const malePct = b.total > 0 ? Math.round((b.male / b.total) * 100) : 0;
                      const femalePct = b.total > 0 ? 100 - malePct : 0;
                      const isActive = filterAgeBuckets.includes(b.id);
                      return (
                        <div
                          key={b.id}
                          className={`mat-age-box ${isActive ? "active" : ""}`}
                          onClick={() => {
                            setFilterMinAge("");
                            setFilterMaxAge("");
                            setFilterAgeBuckets((prev) =>
                              prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id]
                            );
                          }}
                        >
                          <div className="mat-age-label">
                            {b.label} {t.yrs} ({b.total})
                          </div>
                          <div className="mat-age-counts">
                            <span style={{ color: "#0284C7" }}>♂ {b.male}</span>
                            <span style={{ color: "#DB2777" }}>♀ {b.female}</span>
                          </div>
                          <div className="mat-age-bar">
                            <div style={{ width: `${malePct}%`, background: "#0284C7" }} />
                            <div style={{ width: `${femalePct}%`, background: "#DB2777" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Filters Card (Multi-Select Checkboxes on Each Filter) */}
                <div className="mat-card">
                  <h3 className="mat-card-title">
                    <span>🔍 {t.filterTitle}</span>
                    <button className="mat-btn mat-btn-outline mat-btn-sm" onClick={resetPublicFilters}>
                      ↺ {t.clearFilters}
                    </button>
                  </h3>
                  <div className="mat-filter-row">
                    <div className="mat-field">
                      <label className="mat-label">{t.gender}</label>
                      <select
                        className="mat-select"
                        value={filterGender}
                        onChange={(e) => setFilterGender(e.target.value)}
                      >
                        <option value="All">{t.genderAll}</option>
                        <option value="Male">{t.genderMale}</option>
                        <option value="Female">{t.genderFemale}</option>
                      </select>
                    </div>

                    <MultiSelectFilter
                      label={t.surnameFilter}
                      options={publicFacets.surnames}
                      selected={filterSurnames}
                      onChange={setFilterSurnames}
                      allLabel={t.allSurnames}
                    />

                    <MultiSelectFilter
                      label={t.education}
                      options={publicFacets.educations}
                      selected={filterEducations}
                      onChange={setFilterEducations}
                      allLabel={t.allMarital}
                    />

                    <MultiSelectFilter
                      label={t.occupation}
                      options={publicFacets.occupations}
                      selected={filterOccupations}
                      onChange={setFilterOccupations}
                      allLabel={t.allMarital}
                    />

                    <MultiSelectFilter
                      label={t.city}
                      options={publicFacets.cities}
                      selected={filterCities}
                      onChange={setFilterCities}
                      allLabel={t.allMarital}
                    />

                    <MultiSelectFilter
                      label={t.nativeVillage}
                      options={publicFacets.villages}
                      selected={filterVillages}
                      onChange={setFilterVillages}
                      allLabel={t.allMarital}
                    />

                    <MultiSelectFilter
                      label={t.maritalFilter}
                      options={publicFacets.maritals}
                      selected={filterMaritals}
                      onChange={setFilterMaritals}
                      allLabel={t.allMarital}
                    />

                    <div className="mat-field">
                      <label className="mat-label">{t.minAge}</label>
                      <input
                        type="number"
                        min="18"
                        max="80"
                        className="mat-input"
                        placeholder="18"
                        value={filterMinAge}
                        onChange={(e) => {
                          setFilterAgeBuckets([]);
                          setFilterMinAge(e.target.value);
                        }}
                      />
                    </div>

                    <div className="mat-field">
                      <label className="mat-label">{t.maxAge}</label>
                      <input
                        type="number"
                        min="18"
                        max="80"
                        className="mat-input"
                        placeholder="45"
                        value={filterMaxAge}
                        onChange={(e) => {
                          setFilterAgeBuckets([]);
                          setFilterMaxAge(e.target.value);
                        }}
                      />
                    </div>

                    <div className="mat-field" style={{ gridColumn: "span 2" }}>
                      <label className="mat-label">Search</label>
                      <input
                        type="text"
                        className="mat-input"
                        placeholder={t.searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Privacy-Protected Directory Table (NO Name, NO Mobile, NO Photo!) */}
                <div className="mat-card">
                  <h3 className="mat-card-title">
                    <span>👥 {t.directoryTitle}</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#64748B" }}>
                      {t.showingCount} {publicTable.rows.length} {t.ofCount} {approvedProfiles.length}{" "}
                      {t.profilesWord}
                    </span>
                  </h3>

                  <ActiveTableFiltersBar
                    tableState={publicTable}
                    labels={{
                      profileId: t.profileId,
                      gender: t.gender,
                      surname: t.surname,
                      age: t.age,
                      height: t.height,
                      maritalStatus: t.maritalStatus,
                      education: t.education,
                      occupation: t.occupation,
                      nativeVillage: t.nativeVillage,
                      city: t.city,
                      ...Object.fromEntries(
                        publicCustomColumns.map((col) => [`cf_${col.key}`, lang === "gu" ? col.labelGu : col.labelEn])
                      )
                    }}
                  />

                  {filteredPublicProfiles.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 36, color: "#64748B" }}>
                      {t.noProfilesMatch}
                    </div>
                  ) : (
                    <div className="mat-table-wrap">
                      <table className="mat-table">
                        <thead>
                          <tr>
                            <th><ColumnHeaderFilter label={t.profileId} colKey="profileId" tableState={publicTable} /></th>
                            <th><ColumnHeaderFilter label={t.gender} colKey="gender" tableState={publicTable} /></th>
                            <th><ColumnHeaderFilter label={t.surname} colKey="surname" tableState={publicTable} /></th>
                            <th><ColumnHeaderFilter label={t.age} colKey="age" tableState={publicTable} /></th>
                            <th><ColumnHeaderFilter label={t.height} colKey="height" tableState={publicTable} /></th>
                            <th><ColumnHeaderFilter label={t.maritalStatus} colKey="maritalStatus" tableState={publicTable} /></th>
                            <th><ColumnHeaderFilter label={t.education} colKey="education" tableState={publicTable} /></th>
                            <th><ColumnHeaderFilter label={t.occupation} colKey="occupation" tableState={publicTable} /></th>
                            <th><ColumnHeaderFilter label={t.nativeVillage} colKey="nativeVillage" tableState={publicTable} /></th>
                            <th><ColumnHeaderFilter label={t.city} colKey="city" tableState={publicTable} /></th>
                            {publicCustomColumns.map((col) => (
                              <th key={col.key}>
                                <ColumnHeaderFilter
                                  label={lang === "gu" ? col.labelGu : col.labelEn}
                                  colKey={`cf_${col.key}`}
                                  tableState={publicTable}
                                />
                              </th>
                            ))}
                            <th>{t.colAction}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {publicTable.rows.length === 0 ? (
                            <tr>
                              <td colSpan={11 + publicCustomColumns.length} style={{ textAlign: "center", padding: 28, color: "#64748B" }}>
                                {t.noProfilesMatch}
                              </td>
                            </tr>
                          ) : (
                          publicTable.rows.map((p) => {
                            const age = calculateAge(p.dob);
                            return (
                              <tr key={p.profileId}>
                                <td style={{ fontWeight: 700, color: "#0D4B5E" }}>{p.profileId}</td>
                                <td>
                                  <span className={`mat-badge ${p.gender === "Male" ? "male" : "female"}`}>
                                    {p.gender === "Male" ? `♂ ${t.maleShort}` : `♀ ${t.femaleShort}`}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 700 }}>{p.surname}</td>
                                <td>{age !== null ? `${age} ${t.yrs}` : "-"}</td>
                                <td>{p.height || "-"}</td>
                                <td>{p.maritalStatus || "-"}</td>
                                <td>{p.education || "-"}</td>
                                <td>{p.occupation || "-"}</td>
                                <td>{p.nativeVillage || "-"}</td>
                                <td>
                                  {p.city || "-"}
                                  {p.isNri && (
                                    <span className="mat-badge pending" style={{ marginLeft: 4 }}>
                                      NRI
                                    </span>
                                  )}
                                </td>
                                {publicCustomColumns.map((col) => {
                                  const raw = p.customFields?.[col.key];
                                  const txt = Array.isArray(raw)
                                    ? raw.join(", ") || "-"
                                    : typeof raw === "boolean"
                                    ? raw
                                      ? "Yes"
                                      : "No"
                                    : raw || "-";
                                  return <td key={col.key}>{txt}</td>;
                                })}
                                <td>
                                  <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                                    <button
                                      className="mat-btn mat-btn-teal mat-btn-sm"
                                      onClick={() => {
                                        if (!isAuthenticatedForAction) {
                                          setPendingLoginAction({ type: "request", profile: p });
                                          setShowPublicLogin(true);
                                          return;
                                        }
                                        setContactModalProfile(p);
                                        setContactSent(false);
                                        setContactForm((prev) => ({
                                          ...prev,
                                          name: prev.name || publicUser?.name || "",
                                          mobile: prev.mobile || publicUser?.mobile || ""
                                        }));
                                      }}
                                    >
                                      📩 {t.requestContact}
                                    </button>
                                    {isAdmin && (
                                      <button
                                        className="mat-btn mat-btn-outline mat-btn-sm"
                                        onClick={() => handleStartEditProfile(p)}
                                        title="Edit & Correct Profile Data"
                                      >
                                        ✏️ {t.edit}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── TAB 2: SURNAME-WISE TABLE (BOTH MALE & FEMALE) ── */}
            {activeTab === "surnameTable" && (
              <div className="mat-card">
                <h3 className="mat-card-title">
                  <span>📋 {t.surnameTableTitle}</span>
                  {isAdmin && (
                    <button
                      className="mat-btn mat-btn-outline mat-btn-sm"
                      onClick={() => exportSurnameSummaryExcel(surnameSummary)}
                    >
                      📥 {t.exportSurnameExcel}
                    </button>
                  )}
                </h3>
                <p className="mat-card-sub">{t.surnameTableSubtitle}</p>

                <ActiveTableFiltersBar
                  tableState={surnameTableState}
                  labels={{
                    surname: t.colSurname,
                    male: t.colMaleCount,
                    female: t.colFemaleCount,
                    total: t.colTotalCount
                  }}
                />

                {surnameSummary.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 36, color: "#64748B" }}>
                    {t.noSurnames}
                  </div>
                ) : (
                  <div className="mat-table-wrap">
                    <table className="mat-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th><ColumnHeaderFilter label={t.colSurname} colKey="surname" tableState={surnameTableState} /></th>
                          <th><ColumnHeaderFilter label={`♂️ ${t.colMaleCount}`} colKey="male" tableState={surnameTableState} /></th>
                          <th><ColumnHeaderFilter label={`♀️ ${t.colFemaleCount}`} colKey="female" tableState={surnameTableState} /></th>
                          <th><ColumnHeaderFilter label={t.colTotalCount} colKey="total" tableState={surnameTableState} /></th>
                          <th>{t.colAction}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {surnameTableState.rows.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: "center", padding: 28, color: "#64748B" }}>
                              {t.noSurnames}
                            </td>
                          </tr>
                        ) : (
                          surnameTableState.rows.map((row, idx) => (
                            <tr key={row.surname}>
                              <td>{idx + 1}</td>
                              <td style={{ fontWeight: 700, color: "#0D4B5E" }}>{row.surname}</td>
                              <td>
                                <span className="mat-badge male">{row.male}</span>
                              </td>
                              <td>
                                <span className="mat-badge female">{row.female}</span>
                              </td>
                              <td style={{ fontWeight: 700 }}>{row.total}</td>
                              <td>
                                <button
                                  className="mat-btn mat-btn-outline mat-btn-sm"
                                  onClick={() => {
                                    resetPublicFilters();
                                    setFilterSurnames([row.surname]);
                                    setActiveTab("dashboard");
                                  }}
                                >
                                  {t.viewProfiles} →
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2}>{t.grandTotal}</td>
                          <td>{surnameTableState.rows.reduce((s, r) => s + (r.male || 0), 0)}</td>
                          <td>{surnameTableState.rows.reduce((s, r) => s + (r.female || 0), 0)}</td>
                          <td>{surnameTableState.rows.reduce((s, r) => s + (r.total || 0), 0)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: BIODATA REGISTRATION FORM ── */}
            {activeTab === "register" && (
              <div className="mat-card">
                {submittedProfileId ? (
                  <div style={{ textAlign: "center", padding: "36px 16px" }}>
                    <div style={{ fontSize: "3rem", marginBottom: 10 }}>🎉</div>
                    <h2 style={{ color: "#15803D", margin: "0 0 8px 0" }}>{t.submitSuccessTitle}</h2>
                    <p style={{ fontSize: "1rem", margin: "0 0 12px 0" }}>
                      {t.submitSuccessMsg}:{" "}
                      <strong style={{ color: "#0D4B5E", fontSize: "1.15rem" }}>{submittedProfileId}</strong>
                    </p>
                    <p style={{ color: "#64748B", maxWidth: 540, margin: "0 auto 22px auto", fontSize: "0.88rem" }}>
                      {t.submitSuccessNote}
                    </p>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                      <button
                        className="mat-btn mat-btn-primary"
                        onClick={() => {
                          setSubmittedProfileId("");
                          setForm(EMPTY_FORM);
                        }}
                      >
                        + {t.registerAnother}
                      </button>
                      <button className="mat-btn mat-btn-outline" onClick={() => setActiveTab("dashboard")}>
                        {t.tabDashboard}
                      </button>
                    </div>
                  </div>
                ) : !isAuthenticatedForAction ? (
                  <div style={{ textAlign: "center", padding: "36px 18px" }}>
                    <div style={{ fontSize: "2.6rem", marginBottom: 10 }}>🔐</div>
                    <h3 style={{ color: "#0D4B5E", margin: "0 0 8px 0", fontSize: "1.2rem" }}>
                      {lang === "en" ? "Member Login Required" : "મેમ્બર લોગિન ફરજિયાત છે"}
                    </h3>
                    <p style={{ color: "#475569", maxWidth: 460, margin: "0 auto 18px auto", fontSize: "0.9rem", lineHeight: 1.5 }}>
                      {lang === "en"
                        ? "Please login with your verified Mobile Number (SMS OTP) to submit or update a Matrimony Biodata form."
                        : "મેટ્રિમોની બાયોડેટા ફોર્મ સબમિટ અથવા અપડેટ કરવા માટે કૃપા કરીને તમારા મોબાઇલ નંબર (SMS OTP) થી લોગિન કરો."}
                    </p>
                    <button
                      type="button"
                      className="mat-btn mat-btn-primary"
                      style={{ padding: "11px 22px", fontSize: "0.92rem" }}
                      onClick={() => {
                        setPendingLoginAction({ type: "register" });
                        setShowPublicLogin(true);
                      }}
                    >
                      📱 {lang === "en" ? "Login / Register via Mobile OTP" : "મોબાઇલ OTP થી લોગિન / રજીસ્ટર કરો"}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitProfile}>
                    <h3 className="mat-card-title">
                      <span>
                        📝 {editingProfileId ? `${t.edit}: ${editingProfileId}` : t.regFormTitle}
                      </span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {orderSavedMsg && (
                          <span style={{ fontSize: "0.78rem", color: "#15803D", fontWeight: 700 }}>
                            ✓ {orderSavedMsg}
                          </span>
                        )}
                        {isAdmin && !reorderMode && (
                          <>
                            <button
                              type="button"
                              className="mat-btn mat-btn-primary mat-btn-sm"
                              onClick={() => setShowQuickAddField(true)}
                            >
                              + Add New Field
                            </button>
                            <button
                              type="button"
                              className="mat-btn mat-btn-teal mat-btn-sm"
                              onClick={handleToggleReorderMode}
                            >
                              ⚙️ Edit / Reorder Fields
                            </button>
                          </>
                        )}
                        {isAdmin && reorderMode && (
                          <>
                            <button
                              type="button"
                              className="mat-btn mat-btn-success mat-btn-sm"
                              disabled={saving}
                              onClick={handleSaveFieldOrder}
                            >
                              💾 Save Layout
                            </button>
                            <button
                              type="button"
                              className="mat-btn mat-btn-outline mat-btn-sm"
                              disabled={saving}
                              onClick={handleResetFieldOrder}
                            >
                              ↺ Reset Default
                            </button>
                            <button
                              type="button"
                              className="mat-btn mat-btn-outline mat-btn-sm"
                              onClick={handleToggleReorderMode}
                            >
                              {t.cancel}
                            </button>
                          </>
                        )}
                        {editingProfileId && (
                          <button
                            type="button"
                            className="mat-btn mat-btn-outline mat-btn-sm"
                            onClick={() => {
                              setEditingProfileId(null);
                              setAdminEditNote("");
                              setForm(EMPTY_FORM);
                              setActiveTab(editingReturnTab || "adminProfiles");
                            }}
                          >
                            {t.cancel}
                          </button>
                        )}
                      </div>
                    </h3>
                    <p className="mat-card-sub">{t.regFormSubtitle}</p>

                    {isAdmin && editingProfileId && (
                      <div
                        style={{
                          background: "#EFF6FF",
                          border: "1px solid #93C5FD",
                          borderLeft: "4px solid #0284C7",
                          borderRadius: 10,
                          padding: "12px 14px",
                          marginBottom: 16
                        }}
                      >
                        <div style={{ fontWeight: 800, color: "#0369A1", fontSize: "0.9rem", marginBottom: 8 }}>
                          ✏️ Admin Data Correction Mode — Editing Profile {editingProfileId}
                        </div>
                        <div className="mat-form-grid" style={{ gap: 10 }}>
                          <div className="mat-field">
                            <label className="mat-label">Profile Status</label>
                            <select
                              className="mat-select"
                              value={form.status || "approved"}
                              onChange={(e) => setForm({ ...form, status: e.target.value })}
                            >
                              <option value="pending">{t.statusPending}</option>
                              <option value="approved">{t.statusApproved}</option>
                              <option value="married">{t.statusMarried}</option>
                              <option value="rejected">{t.statusRejected}</option>
                            </select>
                          </div>
                          <div className="mat-field" style={{ gridColumn: "span 2" }}>
                            <label className="mat-label">Admin Correction Note (Optional Audit Log)</label>
                            <input
                              className="mat-input"
                              placeholder="e.g. Corrected Date of Birth / Updated Education / Fixed Spelling"
                              value={adminEditNote}
                              onChange={(e) => setAdminEditNote(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {isAdmin && reorderMode && (
                      <div className="mat-reorder-sticky-bar">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span>
                            ⚙️ <strong>Edit &amp; Cross-Section Reorder Mode:</strong> Drag cards across sections, click <strong>✏️</strong> to edit, or <strong>🙈</strong> to hide.
                          </span>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="mat-btn mat-btn-primary mat-btn-sm"
                              onClick={() => setShowQuickAddField(true)}
                            >
                              + Add New Field
                            </button>
                            <button
                              type="button"
                              className="mat-btn mat-btn-success mat-btn-sm"
                              disabled={saving}
                              onClick={handleSaveFieldOrder}
                            >
                              💾 Save Layout
                            </button>
                            <button
                              type="button"
                              className="mat-btn mat-btn-outline mat-btn-sm"
                              onClick={handleToggleReorderMode}
                            >
                              {t.cancel}
                            </button>
                          </div>
                        </div>
                        {hiddenFieldKeys.length > 0 && (
                          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", paddingTop: 8, borderTop: "1px solid #FDE68A" }}>
                            <span style={{ fontSize: "0.78rem", color: "#78350F", fontWeight: 700 }}>
                              🙈 Hidden Fields ({hiddenFieldKeys.length}) — Click to Unhide:
                            </span>
                            {hiddenFieldKeys.map((k) => (
                              <button
                                key={k}
                                type="button"
                                className="mat-btn mat-btn-outline mat-btn-sm"
                                style={{ padding: "3px 9px", fontSize: "0.75rem", background: "#FFFFFF" }}
                                onClick={() => handleRestoreHiddenField(k)}
                              >
                                👁️ Unhide {getReadableFieldName(k)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {formError && (
                      <div
                        style={{
                          background: "#FEE2E2",
                          color: "#991B1B",
                          padding: "10px 14px",
                          borderRadius: 8,
                          fontSize: "0.84rem",
                          marginBottom: 14,
                          fontWeight: 600
                        }}
                      >
                        ⚠️ {formError}
                      </div>
                    )}

                    {/* Unified Built-In Field Nodes Map (enables cross-section drag & drop for ALL fields!) */}
                    {(() => {
                      const allBuiltInNodes = {
                        fullName: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("fullName", t.lblFullName)}</label>
                            <input
                              className="mat-input"
                              required
                              value={form.fullName}
                              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                              placeholder="e.g. Rohan Rameshbhai Parmar"
                            />
                          </div>
                        ),
                        surname: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("surname", t.lblSurname)}</label>
                            <MasterSelectInput
                              required
                              value={form.surname}
                              onChange={(val) => handleMasterFieldSelect("surname", "surnames", val)}
                              options={activeMasterData.surnames}
                              placeholder={t.surname}
                              allowOther={Boolean(activeFieldConfig?.surname?.allowOther)}
                            />
                            {renderMasterLinkedPreview("surnames", form.surname)}
                          </div>
                        ),
                        gender: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("gender", t.lblGender)}</label>
                            <select
                              className="mat-select"
                              value={form.gender}
                              onChange={(e) => setForm({ ...form, gender: e.target.value })}
                            >
                              <option value="Male">{t.genderMale}</option>
                              <option value="Female">{t.genderFemale}</option>
                            </select>
                          </div>
                        ),
                        dob: (
                          <div className="mat-field">
                            <label className="mat-label">
                              {getBuiltInLabel("dob", t.lblDob)}{" "}
                              {form.dob && calculateAge(form.dob) !== null && (
                                <span style={{ color: "#0D4B5E" }}>({calculateAge(form.dob)} {t.yrs})</span>
                              )}
                            </label>
                            <input
                              type="date"
                              className="mat-input"
                              required
                              value={form.dob}
                              onChange={(e) => setForm({ ...form, dob: e.target.value })}
                            />
                          </div>
                        ),
                        height: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("height", t.lblHeight)}</label>
                            <MasterSelectInput
                              required={isBuiltInRequired("height", false)}
                              value={form.height}
                              onChange={(val) => setForm({ ...form, height: val })}
                              options={activeMasterData.heights}
                              placeholder={t.height}
                              allowOther={Boolean(activeFieldConfig?.height?.allowOther)}
                            />
                          </div>
                        ),
                        maritalStatus: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("maritalStatus", t.lblMarital)}</label>
                            <MasterSelectInput
                              required={isBuiltInRequired("maritalStatus", true)}
                              value={form.maritalStatus}
                              onChange={(val) => setForm({ ...form, maritalStatus: val })}
                              options={activeMasterData.maritalStatuses}
                              placeholder={t.maritalStatus}
                              allowOther={Boolean(activeFieldConfig?.maritalStatus?.allowOther)}
                            />
                          </div>
                        ),
                        diet: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("diet", t.lblDiet)}</label>
                            <MasterSelectInput
                              required={isBuiltInRequired("diet", false)}
                              value={form.diet}
                              onChange={(val) => setForm({ ...form, diet: val })}
                              options={activeMasterData.diets}
                              placeholder={t.lblDiet}
                              allowOther={Boolean(activeFieldConfig?.diet?.allowOther)}
                            />
                          </div>
                        ),
                        photo: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("photo", t.lblPhoto)}</label>
                            <input type="file" accept="image/*" className="mat-input" onChange={handlePhotoUpload} />
                            {form.photo && (
                              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                                <img src={form.photo} alt="Preview" className="mat-thumb" />
                                <button
                                  type="button"
                                  className="mat-btn mat-btn-outline mat-btn-sm"
                                  onClick={() => setForm({ ...form, photo: "" })}
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        ),
                        nativeVillage: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("nativeVillage", t.lblNativeVillage)}</label>
                            <MasterSelectInput
                              required={isBuiltInRequired("nativeVillage", true)}
                              value={form.nativeVillage}
                              onChange={(val) => handleMasterFieldSelect("nativeVillage", "nativeVillages", val)}
                              options={activeMasterData.nativeVillages}
                              placeholder={t.nativeVillage}
                              allowOther={Boolean(activeFieldConfig?.nativeVillage?.allowOther)}
                            />
                            {renderMasterLinkedPreview("nativeVillages", form.nativeVillage)}
                          </div>
                        ),
                        mosal: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("mosal", t.lblMosal)}</label>
                            <input
                              className="mat-input"
                              required={isBuiltInRequired("mosal", false)}
                              value={form.mosal}
                              onChange={(e) => setForm({ ...form, mosal: e.target.value })}
                            />
                          </div>
                        ),
                        gotra: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("gotra", t.lblGotra)}</label>
                            <MasterSelectInput
                              required={isBuiltInRequired("gotra", false)}
                              value={form.gotra}
                              onChange={(val) => handleMasterFieldSelect("gotra", "gotras", val)}
                              options={activeMasterData.gotras}
                              placeholder={t.lblGotra}
                              allowOther={Boolean(activeFieldConfig?.gotra?.allowOther)}
                            />
                            {renderMasterLinkedPreview("gotras", form.gotra)}
                          </div>
                        ),
                        city: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("city", t.lblCity)}</label>
                            <MasterSelectInput
                              required={isBuiltInRequired("city", true)}
                              value={form.city}
                              onChange={(val) => handleMasterFieldSelect("city", "cities", val)}
                              options={activeMasterData.cities}
                              placeholder={t.city}
                              allowOther={Boolean(activeFieldConfig?.city?.allowOther)}
                            />
                            {renderMasterLinkedPreview("cities", form.city)}
                          </div>
                        ),
                        isNri: (
                          <div className="mat-field" style={{ justifyContent: "center" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
                              <input
                                type="checkbox"
                                checked={Boolean(form.isNri)}
                                onChange={(e) => setForm({ ...form, isNri: e.target.checked })}
                              />
                              🌍 {getBuiltInLabel("isNri", t.lblNri)}
                            </label>
                          </div>
                        ),
                        education: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("education", t.lblEducation)}</label>
                            <MasterSelectInput
                              required={isBuiltInRequired("education", true)}
                              value={form.education}
                              onChange={(val) => handleMasterFieldSelect("education", "educations", val)}
                              options={activeMasterData.educations}
                              placeholder={t.education}
                              allowOther={Boolean(activeFieldConfig?.education?.allowOther)}
                            />
                            {renderMasterLinkedPreview("educations", form.education)}
                          </div>
                        ),
                        occupation: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("occupation", t.lblOccupation)}</label>
                            <MasterSelectInput
                              required={isBuiltInRequired("occupation", true)}
                              value={form.occupation}
                              onChange={(val) => handleMasterFieldSelect("occupation", "occupations", val)}
                              options={activeMasterData.occupations}
                              placeholder={t.occupation}
                              allowOther={Boolean(activeFieldConfig?.occupation?.allowOther)}
                            />
                            {renderMasterLinkedPreview("occupations", form.occupation)}
                          </div>
                        ),
                        company: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("company", t.lblCompany)}</label>
                            <input
                              className="mat-input"
                              required={isBuiltInRequired("company", false)}
                              value={form.company}
                              onChange={(e) => setForm({ ...form, company: e.target.value })}
                            />
                          </div>
                        ),
                        income: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("income", t.lblIncome)}</label>
                            <MasterSelectInput
                              required={isBuiltInRequired("income", false)}
                              value={form.income}
                              onChange={(val) => setForm({ ...form, income: val })}
                              options={activeMasterData.incomes}
                              placeholder={t.lblIncome}
                              allowOther={Boolean(activeFieldConfig?.income?.allowOther)}
                            />
                          </div>
                        ),
                        fatherName: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("fatherName", t.lblFatherName)}</label>
                            <input
                              className="mat-input"
                              required={isBuiltInRequired("fatherName", false)}
                              value={form.fatherName}
                              onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
                            />
                          </div>
                        ),
                        motherName: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("motherName", t.lblMotherName)}</label>
                            <input
                              className="mat-input"
                              required={isBuiltInRequired("motherName", false)}
                              value={form.motherName}
                              onChange={(e) => setForm({ ...form, motherName: e.target.value })}
                            />
                          </div>
                        ),
                        siblings: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("siblings", t.lblSiblings)}</label>
                            <input
                              className="mat-input"
                              required={isBuiltInRequired("siblings", false)}
                              value={form.siblings}
                              onChange={(e) => setForm({ ...form, siblings: e.target.value })}
                              placeholder="e.g. 1 Brother (Married), 1 Sister"
                            />
                          </div>
                        ),
                        managedBy: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("managedBy", t.lblManagedBy)}</label>
                            <MasterSelectInput
                              required={isBuiltInRequired("managedBy", false)}
                              value={form.managedBy}
                              onChange={(val) => setForm({ ...form, managedBy: val })}
                              options={activeMasterData.managedBys}
                              placeholder={t.lblManagedBy}
                              allowOther={Boolean(activeFieldConfig?.managedBy?.allowOther)}
                            />
                          </div>
                        ),
                        mobile: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("mobile", t.lblMobile)}</label>
                            <input
                              type="tel"
                              className="mat-input"
                              required
                              value={form.mobile}
                              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                              placeholder="10-digit Mobile / WhatsApp"
                            />
                          </div>
                        ),
                        email: (
                          <div className="mat-field">
                            <label className="mat-label">{getBuiltInLabel("email", t.lblEmail)}</label>
                            <input
                              type="email"
                              className="mat-input"
                              required={isBuiltInRequired("email", false)}
                              value={form.email}
                              onChange={(e) => setForm({ ...form, email: e.target.value })}
                            />
                          </div>
                        )
                      };

                      const showExtraSec =
                        (isAdmin && reorderMode) ||
                        getEffectiveSectionOrder("extra").some((k) => !isFieldHidden(k));

                      return (
                        <>
                          {/* Section 1: Personal */}
                          <div className="mat-form-section">{t.secPersonal}</div>
                          <div className="mat-form-grid">
                            {renderOrderedSectionFields("personal", allBuiltInNodes)}
                          </div>

                          {/* Section 2: Community & Location */}
                          <div className="mat-form-section">{t.secCommunity}</div>
                          <div className="mat-form-grid">
                            {renderOrderedSectionFields("community", allBuiltInNodes)}
                          </div>

                          {/* Section 3: Education & Career */}
                          <div className="mat-form-section">{t.secCareer}</div>
                          <div className="mat-form-grid">
                            {renderOrderedSectionFields("career", allBuiltInNodes)}
                          </div>

                          {/* Section 4: Family & Contact (Admin Only) */}
                          <div className="mat-form-section">{t.secFamily}</div>
                          <div className="mat-form-grid">
                            {renderOrderedSectionFields("family", allBuiltInNodes)}
                          </div>

                          {/* Section 5: Additional Details */}
                          {showExtraSec && (
                            <>
                              <div className="mat-form-section">
                                {lang === "gu" ? "વધારાની માહિતી" : "Additional Details"}
                              </div>
                              <div className="mat-form-grid">
                                {renderOrderedSectionFields("extra", allBuiltInNodes)}
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}

                    <div className="mat-field" style={{ marginTop: 12 }}>
                      <label className="mat-label">{t.lblNotes}</label>
                      <textarea
                        rows={3}
                        className="mat-textarea"
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      />
                    </div>

                    {/* Section 5: Dynamic Fee Section (Controlled by Admin Toggle) */}
                    <div className="mat-form-section">{t.secPayment}</div>
                    {store.settings.isPaidMode ? (
                      <div
                        style={{
                          background: "#FFF7ED",
                          border: "1px solid #FDBA74",
                          borderRadius: 10,
                          padding: 16,
                          marginBottom: 16
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#9A3412", marginBottom: 6 }}>
                          💳 {t.paidBadge}: ₹{store.settings.feeAmount}
                        </div>
                        {store.settings.upiId && (
                          <div style={{ fontSize: "0.86rem", marginBottom: 6 }}>
                            <strong>UPI ID:</strong> <code>{store.settings.upiId}</code>
                          </div>
                        )}
                        <div style={{ fontSize: "0.82rem", color: "#7C2D12", marginBottom: 10 }}>
                          {lang === "gu"
                            ? store.settings.paymentNoteGu || store.settings.paymentNote
                            : store.settings.paymentNote}
                        </div>
                        <div className="mat-field" style={{ maxWidth: 360 }}>
                          <label className="mat-label">{t.lblUtr}</label>
                          <input
                            className="mat-input"
                            required={!isAdmin}
                            value={form.paymentUtr}
                            onChange={(e) => setForm({ ...form, paymentUtr: e.target.value })}
                            placeholder="Enter 12-digit UTR / Transaction ID"
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: "#F0FDF4",
                          border: "1px solid #86EFAC",
                          borderRadius: 10,
                          padding: "12px 16px",
                          color: "#166534",
                          fontWeight: 700,
                          fontSize: "0.88rem",
                          marginBottom: 18
                        }}
                      >
                        ✨ {t.freeBadge}
                      </div>
                    )}

                    <button type="submit" className="mat-btn mat-btn-primary" disabled={saving}>
                      {saving
                        ? t.submitting
                        : editingProfileId
                        ? `💾 ${t.saveChanges}`
                        : `✅ ${t.submitBiodata}`}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ── TAB 4: ADMIN FULL PROFILES MANAGEMENT ── */}
            {isAdmin && activeTab === "adminProfiles" && (
              <div className="mat-card">
                <h3 className="mat-card-title">
                  <span>🛡️ {t.tabAdminProfiles} ({filteredAdminProfiles.length})</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="mat-btn mat-btn-primary mat-btn-sm"
                      onClick={() => {
                        setEditingProfileId(null);
                        setForm(EMPTY_FORM);
                        setSubmittedProfileId("");
                        setActiveTab("register");
                      }}
                    >
                      + {t.addOfflineProfile}
                    </button>
                    {!hasDemoData ? (
                      <button
                        className="mat-btn mat-btn-teal mat-btn-sm"
                        disabled={saving}
                        onClick={handleLoadDemoData}
                      >
                        ✨ Load Demo Data (12)
                      </button>
                    ) : (
                      <button
                        className="mat-btn mat-btn-danger mat-btn-sm"
                        disabled={saving}
                        onClick={handleClearDemoData}
                      >
                        🗑️ Clear Demo Data
                      </button>
                    )}
                    <label
                      className="mat-btn mat-btn-success mat-btn-sm"
                      style={{ cursor: "pointer", margin: 0 }}
                      title="Bulk upload new profiles or update existing profiles by Profile ID from Excel / CSV"
                    >
                      📥 Upload Excel / CSV
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        style={{ display: "none" }}
                        disabled={saving}
                        onChange={handleBulkUploadProfilesFile}
                      />
                    </label>
                    <button
                      type="button"
                      className="mat-btn mat-btn-outline mat-btn-sm"
                      onClick={() =>
                        downloadProfilesImportTemplate(
                          activeCustomFields,
                          activeSupportTables,
                          activeMasterTables
                        )
                      }
                      title="Download sample Excel template with all active form columns"
                    >
                      📄 Template
                    </button>
                    <button
                      className="mat-btn mat-btn-outline mat-btn-sm"
                      onClick={() =>
                        exportMasterExcel(
                          adminProfilesTable.hasActive ? adminProfilesTable.rows : store.profiles || [],
                          adminProfilesTable.hasActive
                            ? "Matrimony_Filtered_Profiles.xlsx"
                            : "Matrimony_Master_Report.xlsx",
                          activeCustomFields,
                          activeSupportTables,
                          activeMasterTables
                        )
                      }
                    >
                      📊 {adminProfilesTable.hasActive ? `Export Filtered (${adminProfilesTable.rows.length})` : t.exportExcel}
                    </button>
                  </div>
                </h3>

                {/* Admin Filters */}
                <div className="mat-filter-row" style={{ marginBottom: 16 }}>
                  <div className="mat-field">
                    <label className="mat-label">{t.status}</label>
                    <select
                      className="mat-select"
                      value={adminStatusFilter}
                      onChange={(e) => setAdminStatusFilter(e.target.value)}
                    >
                      <option value="all">All ({(store.profiles || []).length})</option>
                      <option value="pending">{t.statusPending} ({kpis.pending})</option>
                      <option value="approved">{t.statusApproved} ({kpis.totalActive})</option>
                      <option value="married">{t.statusMarried} ({kpis.married})</option>
                      <option value="rejected">{t.statusRejected}</option>
                    </select>
                  </div>

                  <div className="mat-field">
                    <label className="mat-label">{t.gender}</label>
                    <select
                      className="mat-select"
                      value={adminGenderFilter}
                      onChange={(e) => setAdminGenderFilter(e.target.value)}
                    >
                      <option value="All">{t.genderAll}</option>
                      <option value="Male">{t.genderMale}</option>
                      <option value="Female">{t.genderFemale}</option>
                    </select>
                  </div>

                  <div className="mat-field" style={{ gridColumn: "span 2" }}>
                    <label className="mat-label">Admin Search</label>
                    <input
                      className="mat-input"
                      placeholder={t.adminSearchPlaceholder}
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                    />
                  </div>
                </div>

                <ActiveTableFiltersBar
                  tableState={adminProfilesTable}
                  labels={{
                    profileId: t.profileId,
                    fullName: t.fullName,
                    surname: t.surname,
                    genderAge: `${t.gender} / ${t.age}`,
                    mobile: t.mobile,
                    eduCity: `${t.education} / ${t.city}`,
                    status: t.status,
                    submittedBy: "Submitted By",
                    updatedBy: "Updated By",
                    verifiedBy: "Verified By",
                    approvedBy: "Approved By"
                  }}
                />

                <div className="mat-table-wrap">
                  <table className="mat-table">
                    <thead>
                      <tr>
                        <th>{t.photo}</th>
                        <th><ColumnHeaderFilter label={t.profileId} colKey="profileId" tableState={adminProfilesTable} /></th>
                        <th><ColumnHeaderFilter label={t.fullName} colKey="fullName" tableState={adminProfilesTable} /></th>
                        <th><ColumnHeaderFilter label={t.surname} colKey="surname" tableState={adminProfilesTable} /></th>
                        <th><ColumnHeaderFilter label={`${t.gender} / ${t.age}`} colKey="genderAge" tableState={adminProfilesTable} /></th>
                        <th><ColumnHeaderFilter label={t.mobile} colKey="mobile" tableState={adminProfilesTable} /></th>
                        <th><ColumnHeaderFilter label={`${t.education} / ${t.city}`} colKey="eduCity" tableState={adminProfilesTable} /></th>
                        <th><ColumnHeaderFilter label={t.status} colKey="status" tableState={adminProfilesTable} /></th>
                        <th><ColumnHeaderFilter label="Submitted By" colKey="submittedBy" tableState={adminProfilesTable} /></th>
                        <th><ColumnHeaderFilter label="Updated By" colKey="updatedBy" tableState={adminProfilesTable} /></th>
                        <th><ColumnHeaderFilter label="Verified / Approved By" colKey="approvedBy" tableState={adminProfilesTable} /></th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminProfilesTable.rows.length === 0 ? (
                        <tr>
                          <td colSpan={12} style={{ textAlign: "center", padding: 30, color: "#64748B" }}>
                            {t.noProfilesMatch}
                          </td>
                        </tr>
                      ) : (
                        adminProfilesTable.rows.map((p) => {
                          const age = calculateAge(p.dob);
                          const cleanPhone = String(p.mobile || "").replace(/\D/g, "");
                          return (
                            <tr key={p.profileId}>
                              <td>
                                {p.photo ? (
                                  <img
                                    src={p.photo}
                                    alt={p.fullName}
                                    className="mat-thumb"
                                    style={{ cursor: "pointer" }}
                                    onClick={() => setAdminViewProfile(p)}
                                  />
                                ) : (
                                  <div
                                    className="mat-thumb"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      background: "#F1F5F9",
                                      color: "#94A3B8",
                                      fontSize: "1.1rem"
                                    }}
                                  >
                                    👤
                                  </div>
                                )}
                              </td>
                              <td style={{ fontWeight: 700, color: "#0D4B5E" }}>{p.profileId}</td>
                              <td style={{ fontWeight: 700 }}>{p.fullName}</td>
                              <td>{p.surname}</td>
                              <td>
                                <span className={`mat-badge ${p.gender === "Male" ? "male" : "female"}`}>
                                  {p.gender === "Male" ? "♂" : "♀"} {age ?? "-"} {t.yrs}
                                </span>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{p.mobile}</div>
                                {cleanPhone && (
                                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                    <a
                                      href={`tel:${cleanPhone}`}
                                      style={{ fontSize: "0.72rem", color: "#0284C7", fontWeight: 600 }}
                                    >
                                      📞 {t.call}
                                    </a>
                                    <a
                                      href={`https://wa.me/91${cleanPhone.slice(-10)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ fontSize: "0.72rem", color: "#15803D", fontWeight: 600 }}
                                    >
                                      💬 {t.whatsapp}
                                    </a>
                                  </div>
                                )}
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{p.education || "-"}</div>
                                <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                                  {p.city || "-"} ({p.nativeVillage || "-"})
                                </div>
                              </td>
                              <td>{formatStatusBadge(p.status)}</td>
                              <td style={{ fontSize: "0.74rem", color: "#334155", whiteSpace: "nowrap" }}>
                                <div style={{ fontWeight: 700 }}>{p.submittedBy || "-"}</div>
                                <div style={{ color: "#64748B" }}>{formatAuditDateTime(p.submittedAt || p.createdAt)}</div>
                              </td>
                              <td style={{ fontSize: "0.74rem", color: "#334155", whiteSpace: "nowrap" }}>
                                <div style={{ fontWeight: 700 }}>{p.updatedBy || "-"}</div>
                                <div style={{ color: "#64748B" }}>{formatAuditDateTime(p.updatedAt)}</div>
                              </td>
                              <td style={{ fontSize: "0.74rem", color: "#334155", whiteSpace: "nowrap" }}>
                                <div>
                                  <strong>Ver:</strong> {p.verifiedBy || "-"}
                                  {p.verifiedAt && (
                                    <span style={{ color: "#64748B" }}> ({new Date(p.verifiedAt).toLocaleDateString()})</span>
                                  )}
                                </div>
                                <div>
                                  <strong>App:</strong> {p.approvedBy || "-"}
                                  {p.approvedAt && (
                                    <span style={{ color: "#64748B" }}> ({new Date(p.approvedAt).toLocaleDateString()})</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                  <button
                                    className="mat-btn mat-btn-primary mat-btn-sm"
                                    onClick={() => openInMatcher(p.profileId)}
                                    title="Find Matches in 3-Column View"
                                  >
                                    💘
                                  </button>
                                  <button
                                    className="mat-btn mat-btn-outline mat-btn-sm"
                                    onClick={() => setAdminViewProfile(p)}
                                  >
                                    👁️
                                  </button>
                                  {p.status !== "approved" && (
                                    <button
                                      className="mat-btn mat-btn-success mat-btn-sm"
                                      onClick={() => handleAdminStatusChange(p.profileId, "approved")}
                                      title={t.approve}
                                    >
                                      ✓
                                    </button>
                                  )}
                                  {p.status !== "married" && (
                                    <button
                                      className="mat-btn mat-btn-outline mat-btn-sm"
                                      onClick={() => handleAdminStatusChange(p.profileId, "married")}
                                      title={t.markMarried}
                                    >
                                      💍
                                    </button>
                                  )}
                                  <button
                                    className="mat-btn mat-btn-outline mat-btn-sm"
                                    style={{ borderColor: "#0284C7", color: "#0369A1", fontWeight: 700 }}
                                    onClick={() => handleStartEditProfile(p)}
                                    title="Edit & Correct Profile Data"
                                  >
                                    ✏️ {t.edit}
                                  </button>
                                  <button
                                    className="mat-btn mat-btn-teal mat-btn-sm"
                                    onClick={() => exportSingleBiodataPdf(p, activeCustomFields, activeSupportTables, activeMasterTables)}
                                    title={t.downloadBiodata}
                                  >
                                    PDF
                                  </button>
                                  <button
                                    className="mat-btn mat-btn-danger mat-btn-sm"
                                    onClick={() => handleAdminDeleteProfile(p.profileId)}
                                    title={t.delete}
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB 4B: ADMIN 3-COLUMN MATCHMAKING WORKSPACE ── */}
            {isAdmin && activeTab === "adminMatcher" && (
              <>
                {/* Compact Primary Filter Bar + Collapsible "More Filters" for All Remaining Columns */}
                <div className="mat-card" style={{ marginBottom: 14, padding: "14px 18px" }}>
                  <h3 className="mat-card-title" style={{ marginBottom: 10 }}>
                    <span>💘 {t.tabAdminMatcher} — Side-by-Side Comparison</span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        type="button"
                        className={`mat-btn mat-btn-sm ${
                          showMoreMatchFilters || moreMatchFiltersActiveCount > 0 ? "mat-btn-primary" : "mat-btn-teal"
                        }`}
                        onClick={() => setShowMoreMatchFilters((prev) => !prev)}
                      >
                        🎛️ {showMoreMatchFilters ? "Hide More Filters" : "More Filters"}
                        {moreMatchFiltersActiveCount > 0 && ` (${moreMatchFiltersActiveCount})`}
                      </button>
                      <button className="mat-btn mat-btn-outline mat-btn-sm" onClick={resetMatchFilters}>
                        ↺ {t.clearFilters}
                      </button>
                    </div>
                  </h3>

                  {/* Primary Compact Row (1 clean row so 3 columns stay visible!) */}
                  <div className="mat-filter-row" style={{ marginBottom: 10 }}>
                    <div className="mat-field" style={{ gridColumn: "span 2" }}>
                      <label className="mat-label">1. Select Base Candidate (Column 1)</label>
                      <select
                        className="mat-select"
                        style={{ fontWeight: 700, borderColor: "#0D4B5E", background: "#F0F9FF" }}
                        value={matchBaseProfile?.profileId || ""}
                        onChange={(e) => {
                          setMatchBaseId(e.target.value);
                          setMatchSelectedId("");
                        }}
                      >
                        {(store.profiles || []).map((p) => {
                          const age = calculateAge(p.dob);
                          return (
                            <option key={p.profileId} value={p.profileId}>
                              {p.profileId} — {p.fullName} ({p.gender}, {age ?? "-"} {t.yrs}, {p.surname}, {p.city})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="mat-field">
                      <label className="mat-label">Match Gender</label>
                      <select
                        className="mat-select"
                        value={matchGender}
                        onChange={(e) => setMatchGender(e.target.value)}
                      >
                        <option value="Opposite">
                          Opposite ({matchBaseProfile?.gender === "Male" ? "Female" : "Male"})
                        </option>
                        <option value="Male">{t.genderMale}</option>
                        <option value="Female">{t.genderFemale}</option>
                        <option value="All">{t.genderAll}</option>
                      </select>
                    </div>

                    <MultiSelectFilter
                      label={t.surnameFilter}
                      options={adminFacets.surnames}
                      selected={matchSurnames}
                      onChange={setMatchSurnames}
                      allLabel={t.allSurnames}
                    />

                    <MultiSelectFilter
                      label={t.education}
                      options={adminFacets.educations}
                      selected={matchEducations}
                      onChange={setMatchEducations}
                      allLabel={t.allMarital}
                    />

                    <MultiSelectFilter
                      label={t.city}
                      options={adminFacets.cities}
                      selected={matchCities}
                      onChange={setMatchCities}
                      allLabel={t.allMarital}
                    />

                    <div className="mat-field">
                      <label className="mat-label">Search</label>
                      <input
                        className="mat-input"
                        placeholder="Name, ID, Mobile..."
                        value={matchSearch}
                        onChange={(e) => setMatchSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Collapsible "More Filters" Panel — Every Remaining Profile Column */}
                  {showMoreMatchFilters && (
                    <div
                      style={{
                        background: "#F8FAFC",
                        border: "1px solid #CBD5E1",
                        borderRadius: 10,
                        padding: 14,
                        marginBottom: 10
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          color: "#0D4B5E",
                          marginBottom: 10,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <span>🎛️ Additional Column Filters (Multi-Select)</span>
                        <button
                          type="button"
                          className="mat-ms-link"
                          onClick={() => setShowMoreMatchFilters(false)}
                        >
                          Done ▲
                        </button>
                      </div>

                      <div className="mat-filter-row">
                        <MultiSelectFilter
                          label={t.occupation}
                          options={adminFacets.occupations}
                          selected={matchOccupations}
                          onChange={setMatchOccupations}
                          allLabel={t.allMarital}
                        />

                        <MultiSelectFilter
                          label={t.nativeVillage}
                          options={adminFacets.villages}
                          selected={matchVillages}
                          onChange={setMatchVillages}
                          allLabel={t.allMarital}
                        />

                        <MultiSelectFilter
                          label={t.maritalFilter}
                          options={adminFacets.maritals}
                          selected={matchMaritals}
                          onChange={setMatchMaritals}
                          allLabel={t.allMarital}
                        />

                        <MultiSelectFilter
                          label={t.lblDiet}
                          options={adminFacets.diets}
                          selected={matchDiets}
                          onChange={setMatchDiets}
                          allLabel={t.allMarital}
                        />

                        <MultiSelectFilter
                          label={t.height}
                          options={adminFacets.heights}
                          selected={matchHeights}
                          onChange={setMatchHeights}
                          allLabel={t.allMarital}
                        />

                        <MultiSelectFilter
                          label={t.mosal}
                          options={adminFacets.mosals}
                          selected={matchMosals}
                          onChange={setMatchMosals}
                          allLabel={t.allMarital}
                        />

                        <MultiSelectFilter
                          label={t.lblGotra}
                          options={adminFacets.gotras}
                          selected={matchGotras}
                          onChange={setMatchGotras}
                          allLabel={t.allMarital}
                        />

                        <MultiSelectFilter
                          label={t.lblCompany}
                          options={adminFacets.companies}
                          selected={matchCompanies}
                          onChange={setMatchCompanies}
                          allLabel={t.allMarital}
                        />

                        <MultiSelectFilter
                          label={t.lblIncome}
                          options={adminFacets.incomes}
                          selected={matchIncomes}
                          onChange={setMatchIncomes}
                          allLabel={t.allMarital}
                        />

                        <MultiSelectFilter
                          label={t.lblManagedBy}
                          options={adminFacets.managedBys}
                          selected={matchManagedBys}
                          onChange={setMatchManagedBys}
                          allLabel={t.allMarital}
                        />

                        <div className="mat-field">
                          <label className="mat-label">{t.minAge}</label>
                          <input
                            type="number"
                            min="18"
                            max="80"
                            className="mat-input"
                            placeholder="18"
                            value={matchMinAge}
                            onChange={(e) => {
                              setMatchAgeBuckets([]);
                              setMatchMinAge(e.target.value);
                            }}
                          />
                        </div>

                        <div className="mat-field">
                          <label className="mat-label">{t.maxAge}</label>
                          <input
                            type="number"
                            min="18"
                            max="80"
                            className="mat-input"
                            placeholder="45"
                            value={matchMaxAge}
                            onChange={(e) => {
                              setMatchAgeBuckets([]);
                              setMatchMaxAge(e.target.value);
                            }}
                          />
                        </div>

                        <div className="mat-field">
                          <label className="mat-label">Location / NRI</label>
                          <select
                            className="mat-select"
                            value={matchNriFilter}
                            onChange={(e) => setMatchNriFilter(e.target.value)}
                          >
                            <option value="All">All Locations</option>
                            <option value="India">India Only</option>
                            <option value="NRI">NRI Only</option>
                          </select>
                        </div>

                        <div className="mat-field">
                          <label className="mat-label">{t.status}</label>
                          <select
                            className="mat-select"
                            value={matchStatusFilter}
                            onChange={(e) => setMatchStatusFilter(e.target.value)}
                          >
                            <option value="approved">{t.statusApproved} Only</option>
                            <option value="all">All Statuses</option>
                            <option value="pending">{t.statusPending}</option>
                            <option value="married">{t.statusMarried}</option>
                          </select>
                        </div>

                        <div className="mat-field">
                          <label className="mat-label">Payment Mode</label>
                          <select
                            className="mat-select"
                            value={matchPaymentFilter}
                            onChange={(e) => setMatchPaymentFilter(e.target.value)}
                          >
                            <option value="All">All</option>
                            <option value="free">Free</option>
                            <option value="paid">Paid</option>
                          </select>
                        </div>

                        <div className="mat-field">
                          <label className="mat-label">Profile Photo</label>
                          <select
                            className="mat-select"
                            value={matchPhotoFilter}
                            onChange={(e) => setMatchPhotoFilter(e.target.value)}
                          >
                            <option value="All">All</option>
                            <option value="with">With Photo Only</option>
                            <option value="without">Without Photo</option>
                          </select>
                        </div>

                        {expandedCustomDescriptors
                          .filter((desc) => desc.filterable)
                          .map((desc) => {
                            const optsMap = new Map();
                            for (const p of store.profiles || []) {
                              const raw = p.customFields?.[desc.key];
                              if (raw === undefined || raw === null || raw === "") continue;
                              const vals = Array.isArray(raw)
                                ? raw
                                : [typeof raw === "boolean" ? (raw ? "Yes" : "No") : String(raw).trim()];
                              for (const item of vals) {
                                const str = String(item || "").trim();
                                if (!str) continue;
                                const key = str.toUpperCase();
                                if (!optsMap.has(key)) optsMap.set(key, { value: str, label: str, count: 0 });
                                optsMap.get(key).count++;
                              }
                            }
                            const opts = Array.from(optsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
                            return (
                              <MultiSelectFilter
                                key={desc.key}
                                label={lang === "gu" ? desc.labelGu || desc.labelEn : desc.labelEn}
                                options={opts}
                                selected={matchCustomFilters[desc.key] || []}
                                onChange={(vals) =>
                                  setMatchCustomFilters((prev) => ({ ...prev, [desc.key]: vals }))
                                }
                                allLabel={t.allMarital}
                              />
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Quick Multi-Select Age Bracket Pills + Exclude Same Surname Toggle */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 10
                    }}
                  >
                    <div className="mat-age-pill-row" style={{ marginTop: 0 }}>
                      <button
                        type="button"
                        className={`mat-age-pill ${matchAgeBuckets.length === 0 && !matchMinAge && !matchMaxAge ? "active" : ""}`}
                        onClick={() => {
                          setMatchAgeBuckets([]);
                          setMatchMinAge("");
                          setMatchMaxAge("");
                        }}
                      >
                        {t.ageAll}
                      </button>
                      {AGE_BUCKETS.map((b) => {
                        const isActive = matchAgeBuckets.includes(b.id);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            className={`mat-age-pill ${isActive ? "active" : ""}`}
                            onClick={() => {
                              setMatchMinAge("");
                              setMatchMaxAge("");
                              setMatchAgeBuckets((prev) =>
                                prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id]
                              );
                            }}
                          >
                            {isActive ? "✓ " : ""}
                            {b.label} {t.yrs}
                          </button>
                        );
                      })}
                    </div>

                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: "#0D4B5E",
                        cursor: "pointer"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={matchExcludeSameSurname}
                        onChange={(e) => setMatchExcludeSameSurname(e.target.checked)}
                      />
                      Exclude Same Surname {matchBaseProfile?.surname ? `(${matchBaseProfile.surname})` : ""}
                    </label>
                  </div>
                </div>

                {/* 3-Column Comparison Grid */}
                <div className="mat-matcher-grid">
                  {/* COLUMN 1: SELECTED BASE CANDIDATE */}
                  <div className="mat-matcher-col base-col">
                    <div className="mat-matcher-col-head">
                      <span className="mat-matcher-col-title">1️⃣ Selected Candidate</span>
                      {matchBaseProfile && (
                        <span className="mat-badge male">{matchBaseProfile.profileId}</span>
                      )}
                    </div>
                    {matchBaseProfile ? (
                      renderFullProfileSheet(matchBaseProfile)
                    ) : (
                      <div style={{ padding: 30, textAlign: "center", color: "#64748B" }}>
                        No candidate selected.
                      </div>
                    )}
                  </div>

                  {/* COLUMN 2: PROPOSED SELECTION BOXES */}
                  <div className="mat-matcher-col list-col">
                    <div className="mat-matcher-col-head">
                      <span className="mat-matcher-col-title">2️⃣ Proposed Matches</span>
                      <span className="mat-badge pending">{matchCandidates.length} Found</span>
                    </div>

                    <div className="mat-matcher-list">
                      {matchCandidates.length === 0 ? (
                        <div style={{ padding: 26, textAlign: "center", color: "#64748B", fontSize: "0.82rem" }}>
                          No matching candidates for current filters. Try adjusting Age, Surname, or Status filters above.
                        </div>
                      ) : (
                        matchCandidates.map((cand) => {
                          const age = calculateAge(cand.dob);
                          const isSelected = matchSelectedProfile?.profileId === cand.profileId;
                          return (
                            <button
                              key={cand.profileId}
                              type="button"
                              className={`mat-match-box ${isSelected ? "selected" : ""}`}
                              onClick={() => setMatchSelectedId(cand.profileId)}
                            >
                              <div className="mat-match-box-top">
                                {cand.photo ? (
                                  <img src={cand.photo} alt={cand.fullName} className="mat-thumb" />
                                ) : (
                                  <div
                                    className="mat-thumb"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      background: "#F1F5F9",
                                      fontSize: "1.1rem",
                                      flexShrink: 0
                                    }}
                                  >
                                    {cand.gender === "Female" ? "👩" : "👨"}
                                  </div>
                                )}
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div className="mat-match-box-name">{cand.fullName}</div>
                                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#0D4B5E" }}>
                                      {cand.profileId}
                                    </span>
                                    <span style={{ fontSize: "0.7rem", color: "#64748B" }}>
                                      • {age ?? "-"} {t.yrs} {cand.height ? `• ${cand.height}` : ""}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="mat-match-box-meta">
                                <div>🎓 {cand.education || "-"}</div>
                                <div>💼 {cand.occupation || "-"}</div>
                                <div>
                                  📍 {cand.city || "-"} {cand.nativeVillage ? `(${cand.nativeVillage})` : ""}
                                  {cand.isNri && (
                                    <span className="mat-badge pending" style={{ marginLeft: 4, fontSize: "0.65rem" }}>
                                      NRI
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* COLUMN 3: FULL DETAILS OF CLICKED PROPOSED MATCH */}
                  <div className="mat-matcher-col target-col">
                    <div className="mat-matcher-col-head">
                      <span className="mat-matcher-col-title">3️⃣ Proposed Match Details</span>
                      {matchSelectedProfile && (
                        <span className="mat-badge approved">{matchSelectedProfile.profileId}</span>
                      )}
                    </div>

                    {matchBaseProfile && matchSelectedProfile && (() => {
                      const age1 = calculateAge(matchBaseProfile.dob);
                      const age2 = calculateAge(matchSelectedProfile.dob);
                      const ageDiff = age1 !== null && age2 !== null ? Math.abs(age1 - age2) : null;
                      const diffSurname =
                        (matchBaseProfile.surname || "").trim().toUpperCase() !==
                        (matchSelectedProfile.surname || "").trim().toUpperCase();
                      const sameCity =
                        matchBaseProfile.city &&
                        matchSelectedProfile.city &&
                        matchBaseProfile.city.trim().toLowerCase() === matchSelectedProfile.city.trim().toLowerCase();
                      const sameMarital = matchBaseProfile.maritalStatus === matchSelectedProfile.maritalStatus;

                      return (
                        <div className="mat-compat-strip">
                          {ageDiff !== null && (
                            <span className={`mat-compat-pill ${ageDiff > 6 ? "warn" : ""}`}>
                              🎂 Age Gap: {ageDiff} {t.yrs}
                            </span>
                          )}
                          <span className={`mat-compat-pill ${diffSurname ? "" : "warn"}`}>
                            {diffSurname ? "✓ Different Surname" : "⚠️ Same Surname"}
                          </span>
                          {sameCity && <span className="mat-compat-pill">✓ Same City ({matchSelectedProfile.city})</span>}
                          {sameMarital && <span className="mat-compat-pill">✓ {matchSelectedProfile.maritalStatus}</span>}
                        </div>
                      );
                    })()}

                    {matchSelectedProfile ? (
                      renderFullProfileSheet(matchSelectedProfile)
                    ) : (
                      <div style={{ padding: 36, textAlign: "center", color: "#64748B", fontSize: "0.86rem" }}>
                        Click any candidate box in Column 2 to view complete side-by-side details here.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── TAB 4C: ADMIN MASTER DATA & STANDALONE FORM BUILDER ── */}
            {isAdmin && activeTab === "adminMasterData" && (
              <MasterDataAndFormBuilder
                masterData={activeMasterData}
                masterTables={activeMasterTables}
                supportTables={activeSupportTables}
                customFields={activeCustomFields}
                profiles={store.profiles || []}
                saving={saving}
                onSaveMasterData={handleSaveMasterData}
                onSaveMasterTables={handleSaveMasterTables}
                onSaveSupportTables={handleSaveSupportTables}
                onSaveCustomFields={handleSaveCustomFields}
              />
            )}

            {/* ── TAB 5: ADMIN CONTACT REQUESTS ── */}
            {isAdmin && activeTab === "adminRequests" && (
              <div className="mat-card">
                <h3 className="mat-card-title">📩 {t.tabAdminRequests} ({(store.contactRequests || []).length})</h3>
                <ActiveTableFiltersBar
                  tableState={adminRequestsTable}
                  labels={{
                    date: "Date",
                    targetProfile: "Target Profile",
                    requesterName: "Requester Name",
                    requesterMobile: "Requester Mobile",
                    message: "Message",
                    status: "Status"
                  }}
                />

                {(store.contactRequests || []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: 36, color: "#64748B" }}>
                    No contact requests yet.
                  </div>
                ) : (
                  <div className="mat-table-wrap">
                    <table className="mat-table">
                      <thead>
                        <tr>
                          <th><ColumnHeaderFilter label="Date" colKey="date" tableState={adminRequestsTable} /></th>
                          <th><ColumnHeaderFilter label="Target Profile" colKey="targetProfile" tableState={adminRequestsTable} /></th>
                          <th><ColumnHeaderFilter label="Requester Name" colKey="requesterName" tableState={adminRequestsTable} /></th>
                          <th><ColumnHeaderFilter label="Requester Mobile" colKey="requesterMobile" tableState={adminRequestsTable} /></th>
                          <th><ColumnHeaderFilter label="Message" colKey="message" tableState={adminRequestsTable} /></th>
                          <th><ColumnHeaderFilter label="Status" colKey="status" tableState={adminRequestsTable} /></th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminRequestsTable.rows.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: "center", padding: 28, color: "#64748B" }}>
                              No matching requests.
                            </td>
                          </tr>
                        ) : (
                        adminRequestsTable.rows.map((req) => {
                          const target = (store.profiles || []).find((p) => p.profileId === req.targetProfileId);
                          return (
                            <tr key={req.id}>
                              <td style={{ fontSize: "0.78rem", color: "#64748B" }}>
                                {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : "-"}
                              </td>
                              <td>
                                <div style={{ fontWeight: 700, color: "#0D4B5E" }}>{req.targetProfileId}</div>
                                <div style={{ fontSize: "0.76rem" }}>
                                  {target ? `${target.fullName} (${target.mobile})` : req.targetSurname}
                                </div>
                              </td>
                              <td style={{ fontWeight: 600 }}>
                                {req.requesterName}
                                {req.requesterProfileId && (
                                  <div style={{ fontSize: "0.74rem", color: "#64748B" }}>
                                    ID: {req.requesterProfileId}
                                  </div>
                                )}
                              </td>
                              <td>
                                <a href={`tel:${req.requesterMobile}`} style={{ fontWeight: 700, color: "#0284C7" }}>
                                  {req.requesterMobile}
                                </a>
                              </td>
                              <td style={{ maxWidth: 240, fontSize: "0.8rem" }}>{req.message || "-"}</td>
                              <td>
                                <span
                                  className={`mat-badge ${
                                    req.status === "closed"
                                      ? "approved"
                                      : req.status === "connected"
                                      ? "married"
                                      : "pending"
                                  }`}
                                >
                                  {req.status}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button
                                    className="mat-btn mat-btn-outline mat-btn-sm"
                                    onClick={() => handleUpdateRequestStatus(req.id, "connected")}
                                  >
                                    Connected
                                  </button>
                                  <button
                                    className="mat-btn mat-btn-success mat-btn-sm"
                                    onClick={() => handleUpdateRequestStatus(req.id, "closed")}
                                  >
                                    Close
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 6: ADMIN REPORTS & FREE/PAID FEE TOGGLE SETTINGS ── */}
            {isAdmin && activeTab === "adminReports" && (
              <>
                {/* Active Storage Routing Info Card */}
                {(() => {
                  const st = getMatrimonyStorageInfo();
                  return (
                    <div className="mat-card" style={{ borderLeft: "4px solid #0D4B5E" }}>
                      <h3 className="mat-card-title">
                        <span>☁️ Active Matrimony Storage Routing</span>
                        <span className={`mat-badge ${st.dataProvider === "gdrive" ? "approved" : "male"}`}>
                          DB: {st.dataProvider === "gdrive" ? "Google Drive" : "Hostinger MySQL"}
                        </span>
                      </h3>
                      <p className="mat-card-sub" style={{ marginBottom: 8 }}>
                        Database Records Target:{" "}
                        <strong>{st.dataProvider === "gdrive" ? "☁️ Google Drive DB" : "🏢 Hostinger MySQL (`matrimony` table)"}</strong>{" "}
                        • Profile Photos Target:{" "}
                        <strong>{st.mediaProvider === "gdrive" ? `☁️ Google Drive (/${st.folderName}/)` : `🏢 Hostinger (/uploads/${st.folderName}/)`}</strong>
                      </p>
                      <div style={{ fontSize: "0.8rem", color: "#64748B" }}>
                        To switch between <strong>Google Drive</strong> and <strong>Hostinger</strong> or move existing rows/photos in one click, open{" "}
                        <strong>Trust Admin → Storage Routing → Community Matrimony & Biodata</strong>.
                      </div>
                    </div>
                  );
                })()}

                {/* Fee Toggle Card */}
                <div className="mat-card">
                  <h3 className="mat-card-title">
                    <span>💳 {t.feeSettingsTitle}</span>
                    {settingsSavedMsg && (
                      <span style={{ fontSize: "0.8rem", color: "#15803D", fontWeight: 700 }}>
                        ✓ {settingsSavedMsg}
                      </span>
                    )}
                  </h3>

                  <div className="mat-switch-row" style={{ marginBottom: 16 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0D4B5E" }}>
                        {t.feeToggleLabel}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748B", marginTop: 2 }}>
                        {settingsDraft.isPaidMode ? t.feeCurrentlyPaid : t.feeCurrentlyFree}
                      </div>
                    </div>
                    <label className="mat-switch" title="Toggle Free / Paid Registration">
                      <input
                        type="checkbox"
                        checked={Boolean(settingsDraft.isPaidMode)}
                        onChange={(e) => handleTogglePaidModeImmediate(e.target.checked)}
                      />
                      <span className="mat-slider" />
                    </label>
                  </div>

                  {settingsDraft.isPaidMode && (
                    <form onSubmit={handleSaveSettings}>
                      <div className="mat-form-grid" style={{ marginBottom: 14 }}>
                        <div className="mat-field">
                          <label className="mat-label">{t.feeAmountLabel}</label>
                          <input
                            type="number"
                            min="0"
                            className="mat-input"
                            value={settingsDraft.feeAmount}
                            onChange={(e) =>
                              setSettingsDraft({ ...settingsDraft, feeAmount: Number(e.target.value) })
                            }
                          />
                        </div>
                        <div className="mat-field">
                          <label className="mat-label">{t.upiIdLabel}</label>
                          <input
                            className="mat-input"
                            value={settingsDraft.upiId}
                            onChange={(e) => setSettingsDraft({ ...settingsDraft, upiId: e.target.value })}
                            placeholder="e.g. trustname@upi"
                          />
                        </div>
                        <div className="mat-field">
                          <label className="mat-label">{t.paymentNoteLabel} (EN)</label>
                          <input
                            className="mat-input"
                            value={settingsDraft.paymentNote}
                            onChange={(e) => setSettingsDraft({ ...settingsDraft, paymentNote: e.target.value })}
                          />
                        </div>
                        <div className="mat-field">
                          <label className="mat-label">{t.paymentNoteLabel} (GU)</label>
                          <input
                            className="mat-input"
                            value={settingsDraft.paymentNoteGu || ""}
                            onChange={(e) => setSettingsDraft({ ...settingsDraft, paymentNoteGu: e.target.value })}
                          />
                        </div>
                      </div>
                      <button type="submit" className="mat-btn mat-btn-teal" disabled={saving}>
                        💾 {t.saveSettings}
                      </button>
                    </form>
                  )}
                </div>

                {/* Database Upload, Export & Backup Card */}
                <div className="mat-card" style={{ borderLeft: "4px solid #0D4B5E" }}>
                  <h3 className="mat-card-title">💾 Database Upload, Export &amp; Full Backup</h3>
                  <p className="mat-card-sub">
                    Bulk upload profiles from Excel/CSV (leave Profile ID blank to add new, or include existing Profile ID to bulk-update), or export &amp; restore full database backups.
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <label className="mat-btn mat-btn-success" style={{ cursor: "pointer", margin: 0 }}>
                      📥 Upload Profiles (Excel / CSV)
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        style={{ display: "none" }}
                        disabled={saving}
                        onChange={handleBulkUploadProfilesFile}
                      />
                    </label>
                    <button
                      type="button"
                      className="mat-btn mat-btn-outline"
                      onClick={() =>
                        downloadProfilesImportTemplate(
                          activeCustomFields,
                          activeSupportTables,
                          activeMasterTables
                        )
                      }
                    >
                      📄 Download Excel Template
                    </button>
                    <button
                      type="button"
                      className="mat-btn mat-btn-teal"
                      onClick={handleExportFullDatabaseJson}
                    >
                      💾 Export Full Backup (JSON)
                    </button>
                    <label className="mat-btn mat-btn-outline" style={{ cursor: "pointer", margin: 0 }}>
                      ♻️ Restore Full Backup (JSON)
                      <input
                        type="file"
                        accept=".json"
                        style={{ display: "none" }}
                        disabled={saving}
                        onChange={handleRestoreDatabaseJson}
                      />
                    </label>
                  </div>
                </div>

                {/* Admin Exports Card */}
                <div className="mat-card">
                  <h3 className="mat-card-title">📊 Admin Reports & Exports</h3>
                  <p className="mat-card-sub">
                    Download Excel sheets or printable PDF directories for committee meetings and Parichay Sammelans.
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      className="mat-btn mat-btn-success"
                      onClick={() => exportMasterExcel(store.profiles || [], "Matrimony_Master_Report.xlsx", activeCustomFields, activeSupportTables, activeMasterTables)}
                    >
                      📗 {t.exportExcel}
                    </button>
                    <button
                      className="mat-btn mat-btn-outline"
                      onClick={() => exportSurnameSummaryExcel(surnameSummary)}
                    >
                      📋 {t.exportSurnameExcel}
                    </button>
                    <button
                      className="mat-btn mat-btn-teal"
                      onClick={() =>
                        exportDirectoryPdf(store.profiles || [], {
                          includePrivate: true,
                          title: "Community Matrimony - Admin Full Directory"
                        })
                      }
                    >
                      📄 {t.exportAdminPdf}
                    </button>
                    <button
                      className="mat-btn mat-btn-primary"
                      onClick={() =>
                        exportDirectoryPdf(approvedProfiles, {
                          includePrivate: false,
                          title: "Community Matrimony - Public Summary Directory"
                        })
                      }
                    >
                      🔒 {t.exportPublicPdf}
                    </button>
                  </div>
                </div>

                {/* Demo / Test Data Controls */}
                <div className="mat-card" style={{ borderLeft: "4px solid #D97706" }}>
                  <h3 className="mat-card-title">🧪 Demo / Testing Data (Google Drive Sync)</h3>
                  <p className="mat-card-sub">
                    Load 12 sample community profiles (across Parmar, Gohil, Makwana, Solanki, Padaya, Chauhan — Male & Female, all age brackets, NRI, Pending & Married) plus 2 sample contact requests to test the Dashboard, Surname Table, Privacy Masking, and Exports.
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      className="mat-btn mat-btn-teal"
                      disabled={saving}
                      onClick={handleLoadDemoData}
                    >
                      ✨ {saving ? "Saving..." : "Load 12 Demo Profiles to Google Drive"}
                    </button>
                    {hasDemoData && (
                      <button
                        className="mat-btn mat-btn-danger"
                        disabled={saving}
                        onClick={handleClearDemoData}
                      >
                        🗑️ Clear Demo Data Only
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Privacy Notice + Free/Paid Status Banner (positioned at bottom to keep top clean) */}
        <div className="mat-privacy-banner" style={{ marginTop: 22, marginBottom: 0 }}>
          <div>
            <div className="mat-privacy-title">
              🔒 {t.privacyTitle}
            </div>
            <div className="mat-privacy-desc">{t.privacyDesc}</div>
          </div>
          <div>
            {store.settings.isPaidMode ? (
              <span className="mat-fee-pill paid">
                💳 {t.paidBadge}: ₹{store.settings.feeAmount}
              </span>
            ) : (
              <span className="mat-fee-pill free">
                ✨ {t.freeBadge}
              </span>
            )}
          </div>
        </div>
      </main>

      {/* ── MODAL: ADMIN LOGIN ── */}
      {showAdminLogin && (
        <div className="mat-modal-backdrop" onClick={() => setShowAdminLogin(false)}>
          <div className="mat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mat-modal-header">
              <h3 className="mat-modal-title">🔐 {t.adminLoginTitle}</h3>
              <button className="mat-close-btn" onClick={() => setShowAdminLogin(false)}>
                ✕
              </button>
            </div>
            <p className="mat-card-sub">{t.adminLoginSubtitle}</p>
            {loginError && (
              <div
                style={{
                  background: "#FEE2E2",
                  color: "#991B1B",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: "0.82rem",
                  marginBottom: 12
                }}
              >
                ⚠️ {loginError}
              </div>
            )}
            <form onSubmit={handleAdminLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="mat-field">
                <label className="mat-label">{t.adminEmail}</label>
                <input
                  type="email"
                  required
                  className="mat-input"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="mat-field">
                <label className="mat-label">{t.adminPassword}</label>
                <input
                  type="password"
                  required
                  className="mat-input"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                />
              </div>
              <button type="submit" className="mat-btn mat-btn-teal" disabled={loginLoading}>
                {loginLoading ? t.signingIn : t.signIn}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: QUICK ADD NEW FORM FIELD (ADMIN) ── */}
      {isAdmin && showQuickAddField && (
        <div className="mat-modal-backdrop" onClick={() => setShowQuickAddField(false)}>
          <div className="mat-modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="mat-modal-header">
              <h3 className="mat-modal-title">➕ Add New Field to Submit Form</h3>
              <button className="mat-close-btn" onClick={() => setShowQuickAddField(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickAddFieldSubmit}>
              <div className="mat-form-grid" style={{ marginBottom: 12 }}>
                <div className="mat-field">
                  <label className="mat-label">Field Label (English) *</label>
                  <input
                    className="mat-input"
                    required
                    placeholder="e.g. Location / Birth Time / Manglik"
                    value={quickFieldDraft.labelEn}
                    onChange={(e) => setQuickFieldDraft({ ...quickFieldDraft, labelEn: e.target.value })}
                  />
                </div>
                <div className="mat-field">
                  <label className="mat-label">Field Label (Gujarati)</label>
                  <input
                    className="mat-input"
                    placeholder="દા.ત. લોકેશન / જન્મ સમય"
                    value={quickFieldDraft.labelGu}
                    onChange={(e) => setQuickFieldDraft({ ...quickFieldDraft, labelGu: e.target.value })}
                  />
                </div>
                <div className="mat-field">
                  <label className="mat-label">Place in Section</label>
                  <select
                    className="mat-select"
                    value={quickFieldDraft.section}
                    onChange={(e) => setQuickFieldDraft({ ...quickFieldDraft, section: e.target.value })}
                  >
                    <option value="personal">1. Candidate Personal Details</option>
                    <option value="community">2. Community &amp; Location</option>
                    <option value="career">3. Education &amp; Career</option>
                    <option value="family">4. Family &amp; Contact (Admin Only)</option>
                    <option value="extra">5. Additional Details</option>
                  </select>
                </div>
                <div className="mat-field">
                  <label className="mat-label">Field Data Type</label>
                  <select
                    className="mat-select"
                    value={quickFieldDraft.type}
                    onChange={(e) => setQuickFieldDraft({ ...quickFieldDraft, type: e.target.value })}
                  >
                    <option value="dropdown">Dropdown (Single Select)</option>
                    <option value="text">Text (Single Line)</option>
                    <option value="textarea">Long Text (Paragraph)</option>
                    <option value="number">Number</option>
                    <option value="multiselect">Multi-Select Checkboxes</option>
                    <option value="radio">Radio Buttons (Single Choice)</option>
                    <option value="checkbox">Checkbox (Yes / No)</option>
                    <option value="date">Date Picker</option>
                    <option value="time">Time Picker (e.g. Birth Time)</option>
                    <option value="phone">Phone / WhatsApp Number</option>
                    <option value="email">Email Address</option>
                    <option value="url">Website / Social URL</option>
                    <option value="file">File / Image Upload</option>
                  </select>
                </div>
                <div className="mat-field">
                  <label className="mat-label">Placeholder / Hint (Optional)</label>
                  <input
                    className="mat-input"
                    placeholder="Optional helper text..."
                    value={quickFieldDraft.placeholder}
                    onChange={(e) => setQuickFieldDraft({ ...quickFieldDraft, placeholder: e.target.value })}
                  />
                </div>
                <div className="mat-field">
                  <label className="mat-label">Privacy Visibility</label>
                  <select
                    className="mat-select"
                    value={quickFieldDraft.visibility}
                    onChange={(e) => setQuickFieldDraft({ ...quickFieldDraft, visibility: e.target.value })}
                  >
                    <option value="admin">🔒 Admin Only (Private)</option>
                    <option value="public">🌐 Public Directory &amp; Admin</option>
                  </select>
                </div>

                {["dropdown", "multiselect", "radio"].includes(quickFieldDraft.type) && (
                  <>
                    <div className="mat-field">
                      <label className="mat-label">Connect to Master File / Support Table</label>
                      {renderMasterSourceDropdown({
                        masterKey: quickFieldDraft.masterKey,
                        supportTableId: quickFieldDraft.supportTableId,
                        allowSupport: quickFieldDraft.type === "dropdown",
                        onSelect: (patch) => {
                          const tbl = getLinkedTableForSource(patch.masterKey, patch.supportTableId);
                          const pCol = tbl ? tbl.primaryColumn || tbl.columns?.[0] || "" : "";
                          const otherCols = tbl ? (tbl.columns || []).filter((c) => c !== pCol) : [];
                          setQuickFieldDraft({
                            ...quickFieldDraft,
                            ...patch,
                            sourceColumn: pCol,
                            extractColumns: otherCols
                          });
                        }
                      })}
                    </div>

                    {!quickFieldDraft.masterKey && !quickFieldDraft.supportTableId && (
                      <div className="mat-field">
                        <label className="mat-label">Inline Options (comma-separated)</label>
                        <input
                          className="mat-input"
                          placeholder="e.g. Yes, No, Partial"
                          value={quickFieldDraft.inlineOptionsText}
                          onChange={(e) =>
                            setQuickFieldDraft({ ...quickFieldDraft, inlineOptionsText: e.target.value })
                          }
                        />
                      </div>
                    )}

                    {quickFieldDraft.type === "dropdown" &&
                      renderSupportingColumnsConfig({
                        masterKey: quickFieldDraft.masterKey,
                        supportTableId: quickFieldDraft.supportTableId,
                        sourceColumn: quickFieldDraft.sourceColumn,
                        extractColumns: quickFieldDraft.extractColumns,
                        showExtractedOnForm: quickFieldDraft.showExtractedOnForm,
                        onChangeConfig: (cfgPatch) =>
                          setQuickFieldDraft({ ...quickFieldDraft, ...cfgPatch })
                      })}
                  </>
                )}
              </div>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.84rem", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={quickFieldDraft.required}
                    onChange={(e) => setQuickFieldDraft({ ...quickFieldDraft, required: e.target.checked })}
                  />
                  Required Field (*)
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.84rem", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={quickFieldDraft.filterable}
                    onChange={(e) => setQuickFieldDraft({ ...quickFieldDraft, filterable: e.target.checked })}
                  />
                  Include in Matchmaker 🎛️ More Filters
                </label>
                {quickFieldDraft.type === "dropdown" && (
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.84rem",
                      fontWeight: 600,
                      color: "#92400E",
                      background: "#FFFBEB",
                      border: "1px solid #FDE68A",
                      borderRadius: 6,
                      padding: "4px 10px",
                      cursor: "pointer"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(quickFieldDraft.allowOther)}
                      onChange={(e) => setQuickFieldDraft({ ...quickFieldDraft, allowOther: e.target.checked })}
                    />
                    Allow &quot;Other&quot; option (shows blank free-text box &amp; saves value with * mark)
                  </label>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="mat-btn mat-btn-primary" disabled={saving}>
                  + Add Field to Form
                </button>
                <button
                  type="button"
                  className="mat-btn mat-btn-outline"
                  onClick={() => setShowQuickAddField(false)}
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: PUBLIC CONTACT REQUEST ── */}
      {contactModalProfile && (
        <div className="mat-modal-backdrop" onClick={() => setContactModalProfile(null)}>
          <div className="mat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mat-modal-header">
              <h3 className="mat-modal-title">
                📩 {t.reqModalTitle} ({contactModalProfile.profileId})
              </h3>
              <button className="mat-close-btn" onClick={() => setContactModalProfile(null)}>
                ✕
              </button>
            </div>

            {contactSent ? (
              <div style={{ textAlign: "center", padding: "20px 10px" }}>
                <div style={{ fontSize: "2.4rem", marginBottom: 8 }}>✅</div>
                <p style={{ fontWeight: 700, color: "#15803D" }}>{t.reqSuccess}</p>
                <button className="mat-btn mat-btn-teal" onClick={() => setContactModalProfile(null)}>
                  {t.close}
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactRequestSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p className="mat-card-sub" style={{ marginBottom: 4 }}>
                  {t.reqModalSubtitle}
                </p>
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: "0.82rem"
                  }}
                >
                  <strong>{contactModalProfile.profileId}</strong> • {contactModalProfile.surname} •{" "}
                  {contactModalProfile.gender} • {calculateAge(contactModalProfile.dob) ?? "-"} {t.yrs} •{" "}
                  {contactModalProfile.city}
                </div>
                <div className="mat-field">
                  <label className="mat-label">{t.reqYourName}</label>
                  <input
                    className="mat-input"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  />
                </div>
                <div className="mat-field">
                  <label className="mat-label">{t.reqYourMobile}</label>
                  <input
                    type="tel"
                    className="mat-input"
                    required
                    value={contactForm.mobile}
                    onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })}
                  />
                </div>
                <div className="mat-field">
                  <label className="mat-label">{t.reqYourProfileId}</label>
                  <input
                    className="mat-input"
                    value={contactForm.senderProfileId}
                    onChange={(e) => setContactForm({ ...contactForm, senderProfileId: e.target.value })}
                    placeholder="e.g. MAT-1002"
                  />
                </div>
                <div className="mat-field">
                  <label className="mat-label">{t.reqMessage}</label>
                  <textarea
                    rows={3}
                    className="mat-textarea"
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  />
                </div>
                <button type="submit" className="mat-btn mat-btn-primary" disabled={saving}>
                  {t.reqSubmit}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: ADMIN FULL PROFILE DETAIL VIEW ── */}
      {isAdmin && adminViewProfile && (
        <div className="mat-modal-backdrop" onClick={() => setAdminViewProfile(null)}>
          <div className="mat-modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="mat-modal-header">
              <h3 className="mat-modal-title">
                🛡️ {adminViewProfile.fullName} ({adminViewProfile.profileId})
              </h3>
              <button className="mat-close-btn" onClick={() => setAdminViewProfile(null)}>
                ✕
              </button>
            </div>

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
              {adminViewProfile.photo ? (
                <img src={adminViewProfile.photo} alt={adminViewProfile.fullName} className="mat-thumb-lg" />
              ) : (
                <div
                  className="mat-thumb-lg"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#F1F5F9",
                    fontSize: "2.5rem"
                  }}
                >
                  👤
                </div>
              )}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ marginBottom: 8 }}>{formatStatusBadge(adminViewProfile.status)}</div>
                <div style={{ fontSize: "0.9rem", lineHeight: 1.7 }}>
                  <div><strong>{t.surname}:</strong> {adminViewProfile.surname}</div>
                  <div>
                    <strong>{t.gender} / {t.age}:</strong> {adminViewProfile.gender} •{" "}
                    {calculateAge(adminViewProfile.dob) ?? "-"} {t.yrs} ({adminViewProfile.dob})
                  </div>
                  <div><strong>{t.mobile}:</strong> {adminViewProfile.mobile}</div>
                  <div><strong>{t.lblEmail}:</strong> {adminViewProfile.email || "-"}</div>
                  <div>
                    <strong>Payment:</strong>{" "}
                    {adminViewProfile.paymentMode === "paid"
                      ? `Paid ₹${adminViewProfile.feeAmount} (UTR: ${adminViewProfile.paymentUtr || "-"})`
                      : "Free"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mat-form-grid" style={{ fontSize: "0.84rem", lineHeight: 1.65 }}>
              <div><strong>{t.height}:</strong> {adminViewProfile.height || "-"}</div>
              <div><strong>{t.maritalStatus}:</strong> {adminViewProfile.maritalStatus || "-"}</div>
              <div><strong>{t.lblDiet}:</strong> {adminViewProfile.diet || "-"}</div>
              <div><strong>{t.nativeVillage}:</strong> {adminViewProfile.nativeVillage || "-"}</div>
              <div><strong>{t.mosal}:</strong> {adminViewProfile.mosal || "-"}</div>
              <div><strong>{t.lblGotra}:</strong> {adminViewProfile.gotra || "-"}</div>
              <div>
                <strong>{t.city}:</strong> {adminViewProfile.city || "-"}{" "}
                {adminViewProfile.isNri ? "(NRI)" : ""}
              </div>
              <div><strong>{t.education}:</strong> {adminViewProfile.education || "-"}</div>
              <div><strong>{t.occupation}:</strong> {adminViewProfile.occupation || "-"}</div>
              <div><strong>{t.lblCompany}:</strong> {adminViewProfile.company || "-"}</div>
              <div><strong>{t.lblIncome}:</strong> {adminViewProfile.income || "-"}</div>
              <div><strong>{t.lblFatherName}:</strong> {adminViewProfile.fatherName || "-"}</div>
              <div><strong>{t.lblMotherName}:</strong> {adminViewProfile.motherName || "-"}</div>
              <div><strong>{t.lblSiblings}:</strong> {adminViewProfile.siblings || "-"}</div>
              <div><strong>{t.lblManagedBy}:</strong> {adminViewProfile.managedBy || "-"}</div>
            </div>

            {adminViewProfile.notes && (
              <div
                style={{
                  marginTop: 14,
                  background: "#F8FAFC",
                  padding: 12,
                  borderRadius: 8,
                  fontSize: "0.84rem"
                }}
              >
                <strong>{t.lblNotes}:</strong> {adminViewProfile.notes}
              </div>
            )}

            {/* Audit & Tracking Log */}
            <div
              style={{
                marginTop: 14,
                background: "#F8FAFC",
                border: "1px solid #CBD5E1",
                borderRadius: 10,
                padding: 12,
                fontSize: "0.8rem",
                lineHeight: 1.65
              }}
            >
              <div style={{ fontWeight: 800, color: "#0D4B5E", marginBottom: 6 }}>
                📋 Audit &amp; Tracking Details
              </div>
              <div className="mat-form-grid" style={{ gap: 6 }}>
                <div>
                  <strong>Submitted By:</strong> {adminViewProfile.submittedBy || "-"}{" "}
                  <span style={{ color: "#64748B" }}>
                    ({formatAuditDateTime(adminViewProfile.submittedAt || adminViewProfile.createdAt)})
                  </span>
                </div>
                <div>
                  <strong>Last Updated By:</strong> {adminViewProfile.updatedBy || "-"}{" "}
                  <span style={{ color: "#64748B" }}>({formatAuditDateTime(adminViewProfile.updatedAt)})</span>
                </div>
                <div>
                  <strong>Verified By:</strong> {adminViewProfile.verifiedBy || "-"}{" "}
                  {adminViewProfile.verifiedAt && (
                    <span style={{ color: "#15803D" }}>({formatAuditDateTime(adminViewProfile.verifiedAt)})</span>
                  )}
                </div>
                <div>
                  <strong>Approved By:</strong> {adminViewProfile.approvedBy || "-"}{" "}
                  {adminViewProfile.approvedAt && (
                    <span style={{ color: "#15803D" }}>({formatAuditDateTime(adminViewProfile.approvedAt)})</span>
                  )}
                </div>
              </div>
              {Array.isArray(adminViewProfile.editHistory) && adminViewProfile.editHistory.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #CBD5E1" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.74rem", color: "#475569", marginBottom: 4 }}>
                    Recent Edit History:
                  </div>
                  {adminViewProfile.editHistory.slice(0, 5).map((h, i) => (
                    <div key={i} style={{ fontSize: "0.74rem", color: "#334155" }}>
                      • <strong>{h.by}</strong> ({formatAuditDateTime(h.editedAt)}): {h.note}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
              {!adminViewProfile.verifiedBy && (
                <button
                  className="mat-btn mat-btn-teal"
                  onClick={() => handleAdminVerifyProfile(adminViewProfile.profileId)}
                >
                  ✅ Mark Verified
                </button>
              )}
              {adminViewProfile.status !== "approved" && (
                <button
                  className="mat-btn mat-btn-success"
                  onClick={() => handleAdminStatusChange(adminViewProfile.profileId, "approved")}
                >
                  ✓ {t.approve}
                </button>
              )}
              {adminViewProfile.status !== "rejected" && (
                <button
                  className="mat-btn mat-btn-danger"
                  onClick={() => handleAdminStatusChange(adminViewProfile.profileId, "rejected")}
                >
                  ✕ {t.reject}
                </button>
              )}
              {adminViewProfile.status !== "married" && (
                <button
                  className="mat-btn mat-btn-outline"
                  onClick={() => handleAdminStatusChange(adminViewProfile.profileId, "married")}
                >
                  💍 {t.markMarried}
                </button>
              )}
              <button className="mat-btn mat-btn-outline" onClick={() => handleStartEditProfile(adminViewProfile)}>
                ✏️ {t.edit}
              </button>
              <button className="mat-btn mat-btn-teal" onClick={() => exportSingleBiodataPdf(adminViewProfile, activeCustomFields, activeSupportTables, activeMasterTables)}>
                📄 {t.downloadBiodata}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EXISTING PORTAL MEMBER LOGIN (SMS OTP) ── */}
      {showPublicLogin && (
        <UserLoginModal
          subtitle={
            pendingLoginAction?.type === "request"
              ? "Login via Mobile OTP to request contact information for this profile."
              : "Login via Mobile OTP to submit or update your Matrimony Biodata."
          }
          onClose={() => {
            setShowPublicLogin(false);
            setPendingLoginAction(null);
          }}
          onPublicLogin={handlePublicLoginSuccess}
        />
      )}
    </div>
  );
}
