import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  getStorageConfig,
  fbFetchMatrimonyStore,
  fbSaveMatrimonyStore,
  uploadMediaBySection
} from "../CharitableTrust";

const LOCAL_STORAGE_KEY = "community_matrimony_store_v1";

export const getMatrimonyStorageInfo = () => {
  const cfg = getStorageConfig();
  const sec = cfg?.sections?.matrimony || {
    dataProvider: "gdrive",
    mediaProvider: "gdrive",
    folderName: "Matrimony_Profiles"
  };
  const hasGDriveUrl = Boolean((cfg?.gdriveScriptUrl || "").trim());
  return {
    dataProvider: sec.dataProvider || "gdrive",
    mediaProvider: sec.mediaProvider || "gdrive",
    folderName: sec.folderName || "Matrimony_Profiles",
    hasGDriveUrl,
    effectiveDataProvider: sec.dataProvider === "gdrive" && hasGDriveUrl ? "gdrive" : "hostinger",
    effectiveMediaProvider: sec.mediaProvider === "gdrive" && hasGDriveUrl ? "gdrive" : "hostinger"
  };
};

export const DEFAULT_MATRIMONY_SETTINGS = {
  isPaidMode: false, // Currently completely free; admin can toggle ON/OFF
  feeAmount: 500,
  upiId: "",
  paymentNote: "Pay via UPI and enter the 12-digit UTR / Transaction ID below.",
  paymentNoteGu: "UPI દ્વારા ફી ભરીને નીચે ૧૨-અંકનો UTR / ટ્રાન્ઝેક્શન નંબર દાખલ કરો."
};

export const DEFAULT_MASTER_DATA = {
  surnames: [
    "Baria",
    "Chauhan",
    "Dulera",
    "Gohil",
    "Khuman",
    "Mahida",
    "Makwana",
    "Padaya",
    "Parmar",
    "Ravatka",
    "Solanki",
    "Wagh"
  ],
  nativeVillages: [
    "Ahmedabad",
    "Amreli",
    "Bhavnagar",
    "Botad",
    "Jamnagar",
    "Junagadh",
    "Kutch",
    "Morbi",
    "Porbandar",
    "Rajkot",
    "Surendranagar"
  ],
  educations: [
    "10th / 12th",
    "B.A.",
    "B.Com",
    "B.E. / B.Tech",
    "B.Ed, M.A.",
    "B.Pharm",
    "B.Sc",
    "B.Sc (Nursing)",
    "B.Sc IT",
    "BBA",
    "BCA",
    "CA / CS",
    "Diploma",
    "LLB",
    "M.Com",
    "M.Com, CA Inter",
    "M.Sc",
    "MBA",
    "MBBS / MD",
    "MCA",
    "PhD"
  ],
  occupations: [
    "Accountant / Finance",
    "Banking",
    "Business / Own Enterprise",
    "Doctor / Healthcare",
    "Engineer",
    "Government Service",
    "Homemaker",
    "HR / Admin",
    "IT / Software Engineer",
    "Manager",
    "Teacher / Professor",
    "UI/UX Designer"
  ],
  cities: [
    "Ahmedabad",
    "Bhavnagar",
    "London, UK",
    "Mumbai",
    "Navi Mumbai",
    "Pune",
    "Rajkot",
    "Surat",
    "Thane",
    "Toronto, Canada",
    "USA",
    "Vadodara"
  ],
  heights: [
    "4'10\"", "4'11\"", "5'0\"", "5'1\"", "5'2\"", "5'3\"", "5'4\"", "5'5\"",
    "5'6\"", "5'7\"", "5'8\"", "5'9\"", "5'10\"", "5'11\"", "6'0\"", "6'1\"", "6'2\"", "6'3\""
  ],
  maritalStatuses: ["Never Married", "Divorced", "Widowed", "Awaiting Divorce"],
  diets: ["Vegetarian", "Jain", "Eggetarian", "Non-Vegetarian"],
  incomes: [
    "Below 3 LPA",
    "3 - 5 LPA",
    "5 - 8 LPA",
    "8 - 12 LPA",
    "12 - 18 LPA",
    "18 - 25 LPA",
    "25+ LPA",
    "NRI / Foreign Income",
    "Prefer Not to Say"
  ],
  gotras: ["Chauhan", "Gohil", "Makwana", "Padaya", "Parmar", "Solanki"],
  managedBys: ["Parent", "Self", "Sibling", "Relative"]
};

export const dedupeSortedList = (arr = []) => {
  const map = new Map();
  for (const item of arr) {
    const clean = String(item || "").trim();
    if (!clean) continue;
    const key = clean.toUpperCase();
    if (!map.has(key)) map.set(key, clean);
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
};

export const mergeMasterData = (incoming = {}) => {
  const merged = {};
  const allKeys = new Set([...Object.keys(DEFAULT_MASTER_DATA), ...Object.keys(incoming || {})]);
  for (const k of allKeys) {
    if (Array.isArray(incoming?.[k])) {
      merged[k] = dedupeSortedList(incoming[k]);
    } else if (Array.isArray(DEFAULT_MASTER_DATA[k])) {
      merged[k] = dedupeSortedList(DEFAULT_MASTER_DATA[k]);
    }
  }
  return merged;
};

export const DEFAULT_MATRIMONY_DATA = {
  settings: { ...DEFAULT_MATRIMONY_SETTINGS },
  masterData: { ...DEFAULT_MASTER_DATA },
  masterTables: {},
  supportTables: [],
  customFields: [],
  formFieldOrder: {},
  formFieldConfig: {},
  profiles: [],
  contactRequests: [],
  demoCleared: false,
  updatedAt: null
};

// Parse an uploaded CSV or Excel (.xlsx/.xls/.csv) file into { columns: string[], rows: object[] }
export const parseCsvOrExcelTable = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file selected"));
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) return reject(new Error("No sheet found in file"));
        const ws = wb.Sheets[firstSheet];
        const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!rawRows.length) return reject(new Error("File has no data rows"));

        const colSet = new Set();
        rawRows.forEach((r) => {
          Object.keys(r).forEach((k) => {
            const cleanK = String(k || "").trim();
            if (cleanK && !cleanK.startsWith("__EMPTY")) colSet.add(cleanK);
          });
        });
        const columns = Array.from(colSet);
        if (!columns.length) return reject(new Error("No valid column headers found"));

        const rows = rawRows
          .map((r) => {
            const obj = {};
            columns.forEach((c) => {
              obj[c] = String(r[c] ?? "").trim();
            });
            return obj;
          })
          .filter((obj) => columns.some((c) => obj[c] !== ""));

        resolve({ columns, rows });
      } catch (err) {
        reject(new Error("Could not parse CSV/Excel file: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsArrayBuffer(file);
  });
};

// Expand custom fields + linked support table columns + multi-column master table columns into flat descriptors
export const expandCustomFieldDescriptors = (
  customFields = [],
  supportTables = [],
  masterTables = {},
  formFieldConfig = {}
) => {
  const out = [];
  const seenKeys = new Set();

  for (const cf of customFields || []) {
    out.push({
      key: cf.id,
      labelEn: cf.labelEn || cf.id,
      labelGu: cf.labelGu || cf.labelEn || cf.id,
      type: cf.type || "text",
      visibility: cf.visibility || "admin",
      filterable: cf.filterable !== false && cf.type !== "file",
      isDerived: false,
      parentFieldId: cf.id
    });
    seenKeys.add(cf.id);
    const linkedTbl = cf.supportTableId
      ? (supportTables || []).find((t) => t.id === cf.supportTableId)
      : cf.masterKey && masterTables?.[cf.masterKey]?.columns?.length > 1
      ? masterTables[cf.masterKey]
      : null;

    if (linkedTbl && Array.isArray(linkedTbl.columns)) {
      const pCol = cf.sourceColumn || linkedTbl.primaryColumn || linkedTbl.columns[0];
      const secondaryCols = Array.isArray(cf.extractColumns)
        ? cf.extractColumns.filter((c) => linkedTbl.columns.includes(c) && c !== pCol)
        : linkedTbl.columns.filter((c) => c !== pCol);
      for (const colName of secondaryCols) {
        const k = `${cf.id}__${colName}`;
        if (!seenKeys.has(k)) {
          seenKeys.add(k);
          out.push({
            key: k,
            labelEn: colName,
            labelGu: colName,
            type: "text",
            visibility: cf.visibility || "admin",
            filterable: cf.filterable !== false,
            isDerived: true,
            parentFieldId: cf.id,
            sourceTableName: linkedTbl.name || cf.masterKey || ""
          });
        }
      }
    }
  }

  // Also include secondary columns from any multi-column Master Tables (e.g. surnames -> Surname Category)
  for (const [mKey, tbl] of Object.entries(masterTables || {})) {
    if (!tbl || !Array.isArray(tbl.columns) || tbl.columns.length <= 1) continue;
    const secondaryCols = tbl.columns.filter((c) => c !== tbl.primaryColumn);
    for (const colName of secondaryCols) {
      const k = `mt_${mKey}__${colName}`;
      if (!seenKeys.has(k)) {
        seenKeys.add(k);
        out.push({
          key: k,
          labelEn: colName,
          labelGu: colName,
          type: "text",
          visibility: "public",
          filterable: true,
          isDerived: true,
          parentMasterKey: mKey
        });
      }
    }
  }

  // Also include secondary columns from any built-in field connected to a Support/Master table in formFieldConfig
  for (const [bKey, cfg] of Object.entries(formFieldConfig || {})) {
    if (!cfg || (!cfg.supportTableId && !cfg.masterKey)) continue;
    const tbl = cfg.supportTableId
      ? (supportTables || []).find((t) => t.id === cfg.supportTableId)
      : cfg.masterKey && masterTables?.[cfg.masterKey]?.columns?.length > 1
      ? masterTables[cfg.masterKey]
      : null;
    if (!tbl || !Array.isArray(tbl.columns) || tbl.columns.length <= 1) continue;
    const pCol = cfg.sourceColumn || tbl.primaryColumn || tbl.columns[0];
    const extractCols = Array.isArray(cfg.extractColumns)
      ? cfg.extractColumns.filter((c) => tbl.columns.includes(c) && c !== pCol)
      : [];
    for (const colName of extractCols) {
      const k = `bf_${bKey}__${colName}`;
      if (!seenKeys.has(k)) {
        seenKeys.add(k);
        out.push({
          key: k,
          labelEn: `${cfg.labelEn || bKey} (${colName})`,
          labelGu: `${cfg.labelGu || cfg.labelEn || bKey} (${colName})`,
          type: "text",
          visibility: "public",
          filterable: true,
          isDerived: true,
          parentBuiltInKey: bKey
        });
      }
    }
  }

  return out;
};

export const DUMMY_MATRIMONY_PROFILES = [
  {
    profileId: "MAT-1001",
    isDemo: true,
    status: "approved",
    fullName: "Rohan Rameshbhai Parmar",
    surname: "Parmar",
    gender: "Male",
    dob: "1998-04-14",
    height: "5'9\"",
    maritalStatus: "Never Married",
    diet: "Vegetarian",
    photo: "",
    nativeVillage: "Bhavnagar",
    mosal: "Gohil (Mahuva)",
    gotra: "Parmar",
    city: "Mumbai",
    isNri: false,
    education: "B.Tech (Computer Science)",
    occupation: "Software Engineer",
    company: "TCS Mumbai",
    income: "14 LPA",
    fatherName: "Rameshbhai Parmar (Business)",
    motherName: "Kiranben Parmar",
    siblings: "1 Younger Sister (Unmarried)",
    managedBy: "Parent",
    mobile: "9820112233",
    email: "rohan.parmar@example.com",
    notes: "Looking for an educated, family-oriented life partner from Mumbai or Gujarat.",
    paymentMode: "free",
    feeAmount: 0,
    paymentUtr: "",
    createdAt: "2026-11-10T10:00:00.000Z",
    updatedAt: "2026-11-10T10:00:00.000Z"
  },
  {
    profileId: "MAT-1002",
    isDemo: true,
    status: "approved",
    fullName: "Priya Maheshbhai Gohil",
    surname: "Gohil",
    gender: "Female",
    dob: "2000-08-22",
    height: "5'4\"",
    maritalStatus: "Never Married",
    diet: "Vegetarian",
    photo: "",
    nativeVillage: "Amreli",
    mosal: "Solanki (Rajkot)",
    gotra: "Gohil",
    city: "Mumbai",
    isNri: false,
    education: "M.Com, CA Inter",
    occupation: "Senior Accountant",
    company: "HDFC Bank",
    income: "8.5 LPA",
    fatherName: "Maheshbhai Gohil (Govt Service)",
    motherName: "Meenaben Gohil",
    siblings: "1 Elder Brother (Married)",
    managedBy: "Parent",
    mobile: "9833224455",
    email: "priya.gohil@example.com",
    notes: "Prefer well-settled groom in Mumbai / Navi Mumbai / Thane.",
    paymentMode: "free",
    feeAmount: 0,
    paymentUtr: "",
    createdAt: "2026-11-11T09:30:00.000Z",
    updatedAt: "2026-11-11T09:30:00.000Z"
  },
  {
    profileId: "MAT-1003",
    isDemo: true,
    status: "approved",
    fullName: "Karan Sureshbhai Makwana",
    surname: "Makwana",
    gender: "Male",
    dob: "1995-01-19",
    height: "5'10\"",
    maritalStatus: "Never Married",
    diet: "Vegetarian",
    photo: "",
    nativeVillage: "Junagadh",
    mosal: "Parmar (Veraval)",
    gotra: "Makwana",
    city: "Ahmedabad",
    isNri: false,
    education: "MBA (Finance)",
    occupation: "Branch Manager",
    company: "ICICI Bank",
    income: "16 LPA",
    fatherName: "Sureshbhai Makwana (Retired)",
    motherName: "Hansaben Makwana",
    siblings: "1 Elder Sister (Married)",
    managedBy: "Parent",
    mobile: "9892334455",
    email: "karan.makwana@example.com",
    notes: "Warm joint family based in Ahmedabad.",
    paymentMode: "free",
    feeAmount: 0,
    paymentUtr: "",
    createdAt: "2026-11-12T11:15:00.000Z",
    updatedAt: "2026-11-12T11:15:00.000Z"
  },
  {
    profileId: "MAT-1004",
    isDemo: true,
    status: "approved",
    fullName: "Sneha Dineshbhai Parmar",
    surname: "Parmar",
    gender: "Female",
    dob: "2003-03-05",
    height: "5'3\"",
    maritalStatus: "Never Married",
    diet: "Vegetarian",
    photo: "",
    nativeVillage: "Surendranagar",
    mosal: "Makwana (Wadhwan)",
    gotra: "Parmar",
    city: "Surat",
    isNri: false,
    education: "B.Sc (Nursing)",
    occupation: "Healthcare Executive",
    company: "Apollo Hospital",
    income: "5.5 LPA",
    fatherName: "Dineshbhai Parmar (Textile Business)",
    motherName: "Bhavnaben Parmar",
    siblings: "1 Younger Brother",
    managedBy: "Parent",
    mobile: "9821445566",
    email: "sneha.parmar@example.com",
    notes: "Simple, caring family.",
    paymentMode: "free",
    feeAmount: 0,
    paymentUtr: "",
    createdAt: "2026-11-13T14:20:00.000Z",
    updatedAt: "2026-11-13T14:20:00.000Z"
  },
  {
    profileId: "MAT-1005",
    isDemo: true,
    status: "approved",
    fullName: "Devansh Kishorbhai Solanki",
    surname: "Solanki",
    gender: "Male",
    dob: "1996-11-28",
    height: "5'11\"",
    maritalStatus: "Never Married",
    diet: "Vegetarian",
    photo: "",
    nativeVillage: "Rajkot",
    mosal: "Chauhan (Jamnagar)",
    gotra: "Solanki",
    city: "London, UK",
    isNri: true,
    education: "M.Sc (Data Analytics)",
    occupation: "Data Scientist",
    company: "Barclays UK",
    income: "£58,000 / yr",
    fatherName: "Kishorbhai Solanki (Business)",
    motherName: "Rekhaben Solanki",
    siblings: "No Siblings",
    managedBy: "Parent",
    mobile: "9920556677",
    email: "devansh.solanki@example.com",
    notes: "Open to bride willing to relocate to UK.",
    paymentMode: "free",
    feeAmount: 0,
    paymentUtr: "",
    createdAt: "2026-11-14T16:10:00.000Z",
    updatedAt: "2026-11-14T16:10:00.000Z"
  },
  {
    profileId: "MAT-1006",
    isDemo: true,
    status: "approved",
    fullName: "Nidhi Arvindbhai Makwana",
    surname: "Makwana",
    gender: "Female",
    dob: "1997-07-12",
    height: "5'5\"",
    maritalStatus: "Never Married",
    diet: "Jain",
    photo: "",
    nativeVillage: "Morbi",
    mosal: "Padaya (Mumbai)",
    gotra: "Makwana",
    city: "Thane",
    isNri: false,
    education: "B.Pharm",
    occupation: "Quality Analyst",
    company: "Cipla Pharma",
    income: "7.2 LPA",
    fatherName: "Arvindbhai Makwana (Engineer)",
    motherName: "Ushaben Makwana",
    siblings: "1 Younger Sister",
    managedBy: "Parent",
    mobile: "9869667788",
    email: "nidhi.makwana@example.com",
    notes: "Well-educated, modern yet traditional values.",
    paymentMode: "free",
    feeAmount: 0,
    paymentUtr: "",
    createdAt: "2026-11-15T12:00:00.000Z",
    updatedAt: "2026-11-15T12:00:00.000Z"
  },
  {
    profileId: "MAT-1007",
    isDemo: true,
    status: "approved",
    fullName: "Harsh Bharatbhai Gohil",
    surname: "Gohil",
    gender: "Male",
    dob: "1993-06-03",
    height: "5'8\"",
    maritalStatus: "Never Married",
    diet: "Vegetarian",
    photo: "",
    nativeVillage: "Botad",
    mosal: "Wagh (Mumbai)",
    gotra: "Gohil",
    city: "Mumbai",
    isNri: false,
    education: "B.Com",
    occupation: "Own Business (Hardware & Logistics)",
    company: "Gohil Enterprises",
    income: "18 LPA",
    fatherName: "Bharatbhai Gohil (Business)",
    motherName: "Geetaben Gohil",
    siblings: "1 Elder Brother (Married)",
    managedBy: "Parent",
    mobile: "9819778899",
    email: "harsh.gohil@example.com",
    notes: "Own 2BHK residence in Mulund, Mumbai.",
    paymentMode: "free",
    feeAmount: 0,
    paymentUtr: "",
    createdAt: "2026-11-16T08:45:00.000Z",
    updatedAt: "2026-11-16T08:45:00.000Z"
  },
  {
    profileId: "MAT-1008",
    isDemo: true,
    status: "approved",
    fullName: "Kajal Vinodbhai Padaya",
    surname: "Padaya",
    gender: "Female",
    dob: "1999-12-10",
    height: "5'4\"",
    maritalStatus: "Never Married",
    diet: "Vegetarian",
    photo: "",
    nativeVillage: "Porbandar",
    mosal: "Parmar (Jamnagar)",
    gotra: "Padaya",
    city: "Mumbai",
    isNri: false,
    education: "B.Ed, M.A.",
    occupation: "School Teacher",
    company: "St. Xavier's High School",
    income: "6 LPA",
    fatherName: "Vinodbhai Padaya (Railway Employee)",
    motherName: "Shantaben Padaya",
    siblings: "1 Younger Brother",
    managedBy: "Parent",
    mobile: "9867889900",
    email: "kajal.padaya@example.com",
    notes: "Prefer Mumbai / Thane / Navi Mumbai.",
    paymentMode: "free",
    feeAmount: 0,
    paymentUtr: "",
    createdAt: "2026-11-17T10:30:00.000Z",
    updatedAt: "2026-11-17T10:30:00.000Z"
  },
  {
    profileId: "MAT-1009",
    isDemo: true,
    status: "approved",
    fullName: "Nikhil Prakashbhai Chauhan",
    surname: "Chauhan",
    gender: "Male",
    dob: "1989-02-18",
    height: "5'9\"",
    maritalStatus: "Divorced",
    diet: "Vegetarian",
    photo: "",
    nativeVillage: "Jamnagar",
    mosal: "Gohil (Rajkot)",
    gotra: "Chauhan",
    city: "Vadodara",
    isNri: false,
    education: "B.E. Mechanical",
    occupation: "Project Manager",
    company: "L&T Vadodara",
    income: "20 LPA",
    fatherName: "Prakashbhai Chauhan (Retired)",
    motherName: "Nirmalaben Chauhan",
    siblings: "1 Elder Sister (Married)",
    managedBy: "Self",
    mobile: "9969990011",
    email: "nikhil.chauhan@example.com",
    notes: "No kids from previous marriage. Looking for understanding partner.",
    paymentMode: "free",
    feeAmount: 0,
    paymentUtr: "",
    createdAt: "2026-11-18T15:00:00.000Z",
    updatedAt: "2026-11-18T15:00:00.000Z"
  },
  {
    profileId: "MAT-1010",
    isDemo: true,
    status: "approved",
    fullName: "Pooja Rajeshbhai Solanki",
    surname: "Solanki",
    gender: "Female",
    dob: "1994-09-25",
    height: "5'3\"",
    maritalStatus: "Never Married",
    diet: "Vegetarian",
    photo: "",
    nativeVillage: "Kutch",
    mosal: "Makwana (Bhuj)",
    gotra: "Solanki",
    city: "Toronto, Canada",
    isNri: true,
    education: "MBA (HR)",
    occupation: "HR Specialist",
    company: "RBC Canada",
    income: "CAD 72,000 / yr",
    fatherName: "Rajeshbhai Solanki (Business)",
    motherName: "Savita Solanki",
    siblings: "1 Younger Brother (In Canada)",
    managedBy: "Parent",
    mobile: "9769101112",
    email: "pooja.solanki@example.com",
    notes: "Canadian PR holder, looking for well-settled groom in Canada/USA/India.",
    paymentMode: "free",
    feeAmount: 0,
    paymentUtr: "",
    createdAt: "2026-11-19T18:20:00.000Z",
    updatedAt: "2026-11-19T18:20:00.000Z"
  },
  {
    profileId: "MAT-1011",
    isDemo: true,
    status: "pending",
    fullName: "Meet Ashokbhai Parmar",
    surname: "Parmar",
    gender: "Male",
    dob: "2001-05-11",
    height: "5'8\"",
    maritalStatus: "Never Married",
    diet: "Vegetarian",
    photo: "",
    nativeVillage: "Bhavnagar",
    mosal: "Solanki (Sihor)",
    gotra: "Parmar",
    city: "Navi Mumbai",
    isNri: false,
    education: "B.Sc IT",
    occupation: "UI/UX Designer",
    company: "Jio Platforms",
    income: "9.5 LPA",
    fatherName: "Ashokbhai Parmar (Service)",
    motherName: "Jyotiben Parmar",
    siblings: "1 Sister (Married)",
    managedBy: "Parent",
    mobile: "9820456789",
    email: "meet.parmar@example.com",
    notes: "Pending admin approval sample record.",
    paymentMode: "free",
    feeAmount: 0,
    paymentUtr: "",
    createdAt: "2026-11-25T11:00:00.000Z",
    updatedAt: "2026-11-25T11:00:00.000Z"
  },
  {
    profileId: "MAT-1012",
    isDemo: true,
    status: "married",
    fullName: "Hetal Mukeshbhai Gohil",
    surname: "Gohil",
    gender: "Female",
    dob: "1998-10-02",
    height: "5'4\"",
    maritalStatus: "Never Married",
    diet: "Vegetarian",
    photo: "",
    nativeVillage: "Amreli",
    mosal: "Parmar (Mumbai)",
    gotra: "Gohil",
    city: "Mumbai",
    isNri: false,
    education: "B.Com",
    occupation: "Banking Associate",
    company: "Axis Bank",
    income: "6.5 LPA",
    fatherName: "Mukeshbhai Gohil (Business)",
    motherName: "Ramilaben Gohil",
    siblings: "1 Younger Brother",
    managedBy: "Parent",
    mobile: "9833987654",
    email: "hetal.gohil@example.com",
    notes: "Engaged via community matrimony portal (sample archived record).",
    paymentMode: "free",
    feeAmount: 0,
    paymentUtr: "",
    createdAt: "2026-10-15T10:00:00.000Z",
    updatedAt: "2026-11-20T10:00:00.000Z"
  }
];

export const DUMMY_CONTACT_REQUESTS = [
  {
    id: "REQ-DEMO-1",
    isDemo: true,
    targetProfileId: "MAT-1002",
    targetSurname: "Gohil",
    targetGender: "Female",
    requesterName: "Rameshbhai Parmar",
    requesterMobile: "9820112233",
    requesterProfileId: "MAT-1001",
    message: "Namaste, we liked profile MAT-1002 for our son. Kindly share family contact details.",
    status: "new",
    createdAt: "2026-11-25T14:30:00.000Z"
  },
  {
    id: "REQ-DEMO-2",
    isDemo: true,
    targetProfileId: "MAT-1005",
    targetSurname: "Solanki",
    targetGender: "Male",
    requesterName: "Arvindbhai Makwana",
    requesterMobile: "9869667788",
    requesterProfileId: "MAT-1006",
    message: "Interested in connecting with the family regarding MAT-1005.",
    status: "connected",
    createdAt: "2026-11-24T17:15:00.000Z"
  }
];

const getApiBase = () => import.meta.env.VITE_API_BASE_URL || "/api.php";

const getMatrimonyDocUrl = () => `${getApiBase()}/content/matrimony`;

export const calculateAge = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 && age < 120 ? age : null;
};

export const generateNextProfileId = (profiles = []) => {
  let maxNum = 1000;
  for (const p of profiles) {
    const match = String(p.profileId || "").match(/MAT-(\d+)/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `MAT-${maxNum + 1}`;
};

export const compressImageFile = (file, maxDimension = 500, quality = 0.72) => {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxDimension || h > maxDimension) {
          if (w >= h) {
            h = Math.round((maxDimension / w) * h);
            w = maxDimension;
          } else {
            w = Math.round((maxDimension / h) * w);
            h = maxDimension;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
};

// Upload Matrimony candidate photo to Google Drive (/Matrimony_Profiles/) or Hostinger (/uploads/Matrimony_Profiles/)
export const uploadMatrimonyPhoto = async (file, idToken = "") => {
  const compressed = await compressImageFile(file, 600, 0.78);
  const info = getMatrimonyStorageInfo();
  try {
    const fileName = `matrimony_${Date.now()}.jpg`;
    const uploadedUrl = await uploadMediaBySection(
      compressed,
      idToken,
      "matrimony",
      fileName,
      info.effectiveMediaProvider
    );
    if (uploadedUrl && typeof uploadedUrl === "string") {
      return uploadedUrl;
    }
  } catch (err) {
    console.warn("Matrimony remote photo upload fallback to base64:", err);
  }
  return compressed;
};

// Load Matrimony data via Hybrid Storage Router (Google Drive DB or Hostinger MySQL `matrimony` table)
export const loadMatrimonyData = async (idToken = "") => {
  let localData = null;
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) localData = JSON.parse(cached);
  } catch {
    localData = null;
  }

  const info = getMatrimonyStorageInfo();

  try {
    const parsed = await fbFetchMatrimonyStore(idToken);
    if (parsed) {
      const normalized = {
        settings: { ...DEFAULT_MATRIMONY_SETTINGS, ...(parsed.settings || {}) },
        masterData: mergeMasterData(parsed.masterData),
        masterTables: parsed.masterTables && typeof parsed.masterTables === "object" ? parsed.masterTables : {},
        supportTables: Array.isArray(parsed.supportTables) ? parsed.supportTables : [],
        customFields: Array.isArray(parsed.customFields) ? parsed.customFields : [],
        formFieldOrder: parsed.formFieldOrder && typeof parsed.formFieldOrder === "object" ? parsed.formFieldOrder : {},
        formFieldConfig: parsed.formFieldConfig && typeof parsed.formFieldConfig === "object" ? parsed.formFieldConfig : {},
        profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
        contactRequests: Array.isArray(parsed.contactRequests) ? parsed.contactRequests : [],
        demoCleared: Boolean(parsed.demoCleared),
        updatedAt: parsed.updatedAt || null
      };
      if (normalized.profiles.length > 0 || normalized.demoCleared) {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
        } catch {}
        return { data: normalized, source: info.effectiveDataProvider };
      }
    }
  } catch {
    // Fallback to localStorage if backend is unavailable in local dev
  }

  if (localData) {
    const normalizedLocal = {
      settings: { ...DEFAULT_MATRIMONY_SETTINGS, ...(localData.settings || {}) },
      masterData: mergeMasterData(localData.masterData),
      masterTables: localData.masterTables && typeof localData.masterTables === "object" ? localData.masterTables : {},
      supportTables: Array.isArray(localData.supportTables) ? localData.supportTables : [],
      customFields: Array.isArray(localData.customFields) ? localData.customFields : [],
      formFieldOrder: localData.formFieldOrder && typeof localData.formFieldOrder === "object" ? localData.formFieldOrder : {},
      formFieldConfig: localData.formFieldConfig && typeof localData.formFieldConfig === "object" ? localData.formFieldConfig : {},
      profiles: Array.isArray(localData.profiles) ? localData.profiles : [],
      contactRequests: Array.isArray(localData.contactRequests) ? localData.contactRequests : [],
      demoCleared: Boolean(localData.demoCleared),
      updatedAt: localData.updatedAt || null
    };
    if (normalizedLocal.profiles.length > 0 || normalizedLocal.demoCleared) {
      return { data: normalizedLocal, source: "local" };
    }
  }

  // Auto-seed demo profiles on first visit when database is empty (until Admin clicks "Clear Demo Data")
  const seeded = {
    settings: { ...DEFAULT_MATRIMONY_SETTINGS },
    masterData: mergeMasterData(DEFAULT_MASTER_DATA),
    masterTables: {},
    supportTables: [],
    customFields: [],
    formFieldOrder: {},
    formFieldConfig: {},
    profiles: [...DUMMY_MATRIMONY_PROFILES],
    contactRequests: [...DUMMY_CONTACT_REQUESTS],
    demoCleared: false,
    updatedAt: new Date().toISOString()
  };
  await saveMatrimonyData(seeded, idToken);
  return { data: seeded, source: "seeded" };
};

// Save Matrimony data via Hybrid Storage Router (Google Drive DB or Hostinger MySQL `matrimony` table)
export const saveMatrimonyData = async (nextData, idToken = "") => {
  const payloadData = {
    settings: { ...DEFAULT_MATRIMONY_SETTINGS, ...(nextData.settings || {}) },
    masterData: mergeMasterData(nextData.masterData),
    masterTables: nextData.masterTables && typeof nextData.masterTables === "object" ? nextData.masterTables : {},
    supportTables: Array.isArray(nextData.supportTables) ? nextData.supportTables : [],
    customFields: Array.isArray(nextData.customFields) ? nextData.customFields : [],
    formFieldOrder: nextData.formFieldOrder && typeof nextData.formFieldOrder === "object" ? nextData.formFieldOrder : {},
    formFieldConfig: nextData.formFieldConfig && typeof nextData.formFieldConfig === "object" ? nextData.formFieldConfig : {},
    profiles: Array.isArray(nextData.profiles) ? nextData.profiles : [],
    contactRequests: Array.isArray(nextData.contactRequests) ? nextData.contactRequests : [],
    demoCleared: Boolean(nextData.demoCleared),
    updatedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payloadData));
  } catch {}

  const info = getMatrimonyStorageInfo();

  try {
    const ok = await fbSaveMatrimonyStore(payloadData, idToken);
    if (ok) {
      return { ok: true, synced: info.effectiveDataProvider, data: payloadData };
    }
  } catch {
    // Local cache already saved
  }

  return { ok: true, synced: "local", data: payloadData };
};

// Read existing Admin session from main portal (trustAuth)
export const getStoredAdminAuth = () => {
  try {
    const raw = localStorage.getItem("trustAuth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.email || parsed.idToken)) return parsed;
  } catch {}
  return null;
};

// Sign in with Firebase Admin email & password (same as main portal)
export const signInMatrimonyAdmin = async (email, password) => {
  const apiKey = window.FIREBASE_CONFIG?.apiKey;
  if (!apiKey) {
    throw new Error("Firebase API key is not configured.");
  }
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password, returnSecureToken: true })
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || "Invalid email or password");
  }
  const authObj = {
    email: data.email,
    localId: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    loggedInAt: new Date().toISOString()
  };
  try {
    localStorage.setItem("trustAuth", JSON.stringify(authObj));
    if (authObj.idToken) {
      localStorage.setItem("trustPublicAuthToken", authObj.idToken);
    }
  } catch {}
  return authObj;
};

export const signOutMatrimonyAdmin = () => {
  try {
    localStorage.removeItem("trustAuth");
  } catch {}
};

// ── EXPORT HELPERS (Admin Only) ──────────────────────────────────────────────

export const exportMasterExcel = (
  profiles,
  fileName = "Matrimony_Master_Report.xlsx",
  customFields = [],
  supportTables = [],
  masterTables = {}
) => {
  const expanded = expandCustomFieldDescriptors(customFields, supportTables, masterTables);
  const rows = profiles.map((p) => {
    const base = {
      "Profile ID": p.profileId || "",
      Status: p.status || "pending",
      Gender: p.gender || "",
      "Full Name": p.fullName || "",
      Surname: p.surname || "",
      "Date of Birth": p.dob || "",
      Age: calculateAge(p.dob) ?? "",
      Height: p.height || "",
      "Marital Status": p.maritalStatus || "",
      Diet: p.diet || "",
      Education: p.education || "",
      Occupation: p.occupation || "",
      "Company / Business": p.company || "",
      "Annual Income": p.income || "",
      "Native Village (Vatan)": p.nativeVillage || "",
      "Mosal Surname & Village": p.mosal || "",
      "Gotra / Kuldevi": p.gotra || "",
      "Current City": p.city || "",
      NRI: p.isNri ? "Yes" : "No",
      "Father Name & Occupation": p.fatherName || "",
      "Mother Name": p.motherName || "",
      Siblings: p.siblings || "",
      "Managed By": p.managedBy || "",
      "Mobile / WhatsApp": p.mobile || "",
      Email: p.email || "",
      "Payment Mode": p.paymentMode || "free",
      "Fee Paid (INR)": p.feeAmount || 0,
      "Payment UTR": p.paymentUtr || "",
      Notes: p.notes || "",
      "Submitted By": p.submittedBy || "",
      "Submitted At": (p.submittedAt || p.createdAt) ? new Date(p.submittedAt || p.createdAt).toLocaleString() : "",
      "Updated By": p.updatedBy || "",
      "Updated At": p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "",
      "Verified By": p.verifiedBy || "",
      "Verified At": p.verifiedAt ? new Date(p.verifiedAt).toLocaleString() : "",
      "Approved By": p.approvedBy || "",
      "Approved At": p.approvedAt ? new Date(p.approvedAt).toLocaleString() : ""
    };
    for (const desc of expanded) {
      const val = p.customFields?.[desc.key];
      base[desc.labelEn || desc.key] = Array.isArray(val)
        ? val.join(", ")
        : typeof val === "boolean"
        ? val
          ? "Yes"
          : "No"
        : val ?? "";
    }
    return base;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Matrimony Profiles");
  XLSX.writeFile(wb, fileName);
};

// Download ready-to-fill Excel template for bulk uploading profiles
export const downloadProfilesImportTemplate = (
  customFields = [],
  supportTables = [],
  masterTables = {}
) => {
  const expanded = expandCustomFieldDescriptors(customFields, supportTables, masterTables);
  const sampleRow = {
    "Profile ID": "(Leave blank for new, or MAT-1001 to update existing)",
    Status: "approved",
    Gender: "Male",
    "Full Name": "Rohan Rameshbhai Parmar",
    Surname: "Parmar",
    "Date of Birth": "1997-08-15",
    Height: "5'9\"",
    "Marital Status": "Never Married",
    Diet: "Vegetarian",
    Education: "B.E. / B.Tech",
    Occupation: "Software Engineer",
    "Company / Business": "TCS, Mumbai",
    "Annual Income": "10 - 15 LPA",
    "Native Village (Vatan)": "Sihor",
    "Mosal Surname & Village": "Gohil (Bhavnagar)",
    "Gotra / Kuldevi": "Kashyap / Chamunda Maa",
    "Current City": "Mumbai",
    NRI: "No",
    "Father Name & Occupation": "Rameshbhai Parmar (Business)",
    "Mother Name": "Meenaben Parmar",
    Siblings: "1 Sister (Married)",
    "Managed By": "Parents",
    "Mobile / WhatsApp": "9820012345",
    Email: "example@email.com",
    Notes: "Sample row - replace or delete before uploading"
  };
  for (const desc of expanded) {
    if (desc.isSupporting) continue;
    sampleRow[desc.labelEn || desc.key] = "";
  }
  const ws = XLSX.utils.json_to_sheet([sampleRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Upload Template");
  XLSX.writeFile(wb, "Matrimony_Bulk_Upload_Template.xlsx");
};

const normalizeExcelDob = (raw) => {
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  // Excel numeric date serial
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const num = Number(s);
    if (num > 10000 && num < 80000) {
      const utc = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!Number.isNaN(utc.getTime())) return utc.toISOString().slice(0, 10);
    }
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return s;
};

// Parse Excel/CSV file and merge/upsert into existing Matrimony profiles
export const importProfilesFromSpreadsheet = async (
  file,
  existingProfiles = [],
  customFields = [],
  supportTables = [],
  masterTables = {},
  actorName = "Admin"
) => {
  const { rows } = await parseCsvOrExcelTable(file);
  if (!rows || rows.length === 0) {
    throw new Error("No data rows found in the uploaded file.");
  }

  const pickCell = (row, aliases = []) => {
    const entries = Object.entries(row || {});
    for (const alias of aliases) {
      const target = alias.trim().toLowerCase();
      const found = entries.find(([k]) => String(k).trim().toLowerCase() === target);
      if (found && String(found[1] ?? "").trim() !== "") {
        return String(found[1]).trim();
      }
    }
    return "";
  };

  const expanded = expandCustomFieldDescriptors(customFields, supportTables, masterTables);
  const nextProfiles = [...(existingProfiles || [])];
  const byIdIndex = new Map(
    nextProfiles.map((p, idx) => [String(p.profileId || "").trim().toUpperCase(), idx])
  );

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const nowIso = new Date().toISOString();

  for (const row of rows) {
    const rawId = pickCell(row, ["Profile ID", "ProfileID", "ID"]);
    const isSamplePlaceholder = rawId.toLowerCase().includes("leave blank");
    const cleanId = isSamplePlaceholder ? "" : rawId;

    const fullName = pickCell(row, ["Full Name", "Candidate Full Name", "Name"]);
    const surname = pickCell(row, ["Surname", "Last Name"]);
    const mobile = pickCell(row, ["Mobile / WhatsApp", "Mobile", "Phone", "WhatsApp", "Contact"]);

    // Skip blank or sample rows
    if (!fullName && !surname && !mobile) {
      skippedCount++;
      continue;
    }

    const genderRaw = pickCell(row, ["Gender", "Sex"]).toLowerCase();
    const gender = genderRaw.startsWith("f") ? "Female" : "Male";
    const statusRaw = pickCell(row, ["Status"]).toLowerCase();
    const status = ["pending", "approved", "rejected", "married"].includes(statusRaw)
      ? statusRaw
      : "approved";
    const nriRaw = pickCell(row, ["NRI", "Is NRI"]).toLowerCase();
    const isNri = ["yes", "true", "1", "y", "nri"].includes(nriRaw);

    const parsedCustom = {};
    for (const desc of expanded) {
      const val = pickCell(row, [desc.labelEn || "", desc.labelGu || "", desc.key || ""].filter(Boolean));
      if (val !== "") {
        parsedCustom[desc.key] = val;
      }
    }

    const payload = {
      fullName: fullName || surname,
      surname: surname || (fullName.split(" ").slice(-1)[0] || ""),
      gender,
      dob: normalizeExcelDob(pickCell(row, ["Date of Birth", "DOB", "Birth Date"])),
      height: pickCell(row, ["Height"]),
      maritalStatus: pickCell(row, ["Marital Status"]) || "Never Married",
      diet: pickCell(row, ["Diet"]) || "Vegetarian",
      nativeVillage: pickCell(row, ["Native Village (Vatan)", "Native Village", "Vatan", "Village"]),
      mosal: pickCell(row, ["Mosal Surname & Village", "Mosal"]),
      gotra: pickCell(row, ["Gotra / Kuldevi", "Gotra"]),
      city: pickCell(row, ["Current City", "City", "Location"]),
      isNri,
      education: pickCell(row, ["Education", "Qualification"]),
      occupation: pickCell(row, ["Occupation", "Profession"]),
      company: pickCell(row, ["Company / Business", "Company"]),
      income: pickCell(row, ["Annual Income", "Income"]),
      fatherName: pickCell(row, ["Father Name & Occupation", "Father Name", "Father"]),
      motherName: pickCell(row, ["Mother Name", "Mother"]),
      siblings: pickCell(row, ["Siblings"]),
      managedBy: pickCell(row, ["Managed By"]) || "Parents",
      mobile,
      email: pickCell(row, ["Email", "Email Address"]),
      paymentMode: pickCell(row, ["Payment Mode"]).toLowerCase() === "paid" ? "paid" : "free",
      feeAmount: Number(pickCell(row, ["Fee Paid (INR)", "Fee Amount"]) || 0) || 0,
      paymentUtr: pickCell(row, ["Payment UTR", "UTR"]),
      notes: pickCell(row, ["Notes", "Remarks"]),
      status
    };

    const existingIdx = cleanId ? byIdIndex.get(cleanId.toUpperCase()) : undefined;
    if (existingIdx !== undefined) {
      const prev = nextProfiles[existingIdx];
      nextProfiles[existingIdx] = {
        ...prev,
        ...payload,
        customFields: { ...(prev.customFields || {}), ...parsedCustom },
        updatedBy: `${actorName} (Bulk Upload)`,
        updatedAt: nowIso
      };
      updatedCount++;
    } else {
      const assignedId = cleanId || generateNextProfileId(nextProfiles);
      const newProfile = {
        profileId: assignedId,
        photo: "",
        ...payload,
        customFields: parsedCustom,
        submittedBy: `${actorName} (Bulk Upload)`,
        submittedAt: nowIso,
        updatedBy: `${actorName} (Bulk Upload)`,
        ...(payload.status === "approved"
          ? { approvedBy: actorName, approvedAt: nowIso, verifiedBy: actorName, verifiedAt: nowIso }
          : {}),
        createdAt: nowIso,
        updatedAt: nowIso
      };
      nextProfiles.unshift(newProfile);
      // Rebuild index map since unshift shifted indices
      byIdIndex.clear();
      nextProfiles.forEach((p, i) =>
        byIdIndex.set(String(p.profileId || "").trim().toUpperCase(), i)
      );
      addedCount++;
    }
  }

  return { nextProfiles, addedCount, updatedCount, skippedCount };
};

export const exportSurnameSummaryExcel = (surnameRows, fileName = "Matrimony_Surname_Summary.xlsx") => {
  const rows = surnameRows.map((r) => ({
    Surname: r.surname,
    "Male Count": r.male,
    "Female Count": r.female,
    "Total Count": r.total
  }));
  const totals = surnameRows.reduce(
    (acc, r) => ({ male: acc.male + r.male, female: acc.female + r.female, total: acc.total + r.total }),
    { male: 0, female: 0, total: 0 }
  );
  rows.push({
    Surname: "GRAND TOTAL",
    "Male Count": totals.male,
    "Female Count": totals.female,
    "Total Count": totals.total
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Surname Summary");
  XLSX.writeFile(wb, fileName);
};

export const exportDirectoryPdf = (profiles, { includePrivate = false, title = "Community Matrimony Directory" } = {}) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(15);
  doc.setTextColor(13, 75, 94);
  doc.text(title, 40, 38);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated: ${new Date().toLocaleString()} | Total Profiles: ${profiles.length} | Mode: ${
      includePrivate ? "ADMIN FULL REPORT (CONFIDENTIAL)" : "PUBLIC PRIVACY-MASKED REPORT"
    }`,
    40,
    54
  );

  const head = includePrivate
    ? [["ID", "Name", "Surname", "Gender", "Age", "Mobile", "Education", "Occupation", "Native Village", "City", "Status"]]
    : [["ID", "Surname", "Gender", "Age", "Height", "Marital Status", "Education", "Occupation", "Native Village", "City"]];

  const body = profiles.map((p) => {
    const age = calculateAge(p.dob) ?? "-";
    if (includePrivate) {
      return [
        p.profileId || "",
        p.fullName || "",
        p.surname || "",
        p.gender || "",
        String(age),
        p.mobile || "",
        p.education || "",
        p.occupation || "",
        p.nativeVillage || "",
        p.city || "",
        p.status || ""
      ];
    }
    return [
      p.profileId || "",
      p.surname || "",
      p.gender || "",
      String(age),
      p.height || "-",
      p.maritalStatus || "-",
      p.education || "-",
      p.occupation || "-",
      p.nativeVillage || "-",
      p.city || "-"
    ];
  });

  autoTable(doc, {
    startY: 66,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [13, 75, 94], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  const fileName = includePrivate ? "Matrimony_Admin_Full_Directory.pdf" : "Matrimony_Public_Masked_Directory.pdf";
  doc.save(fileName);
};

export const exportSingleBiodataPdf = (p, customFields = [], supportTables = [], masterTables = {}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const age = calculateAge(p.dob) ?? "-";
  const expanded = expandCustomFieldDescriptors(customFields, supportTables, masterTables);

  // Header Banner
  doc.setFillColor(13, 75, 94);
  doc.rect(0, 0, 595, 76, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("COMMUNITY MATRIMONY BIODATA", 40, 36);
  doc.setFontSize(10);
  doc.text(`Profile ID: ${p.profileId || ""}   |   Status: ${(p.status || "pending").toUpperCase()}`, 40, 56);

  // Optional Photo (Admin PDF)
  if (p.photo && p.photo.startsWith("data:image")) {
    try {
      doc.addImage(p.photo, "JPEG", 445, 94, 110, 125);
      doc.setDrawColor(217, 119, 6);
      doc.rect(445, 94, 110, 125);
    } catch {}
  }

  const rows = [
    ["Full Name", p.fullName || "-"],
    ["Surname", p.surname || "-"],
    ["Gender", p.gender || "-"],
    ["Date of Birth / Age", `${p.dob || "-"} (${age} Yrs)`],
    ["Height", p.height || "-"],
    ["Marital Status", p.maritalStatus || "-"],
    ["Diet", p.diet || "-"],
    ["Native Village (Vatan)", p.nativeVillage || "-"],
    ["Mosal Surname & Village", p.mosal || "-"],
    ["Gotra / Kuldevi", p.gotra || "-"],
    ["Current City", `${p.city || "-"}${p.isNri ? " (NRI)" : ""}`],
    ["Education", p.education || "-"],
    ["Occupation", p.occupation || "-"],
    ["Company / Business", p.company || "-"],
    ["Annual Income", p.income || "-"],
    ["Father's Name & Occupation", p.fatherName || "-"],
    ["Mother's Name", p.motherName || "-"],
    ["Siblings", p.siblings || "-"],
    ["Managed By", p.managedBy || "-"],
    ["Mobile / WhatsApp", p.mobile || "-"],
    ["Email", p.email || "-"],
    ...expanded.map((desc) => {
      const val = p.customFields?.[desc.key];
      const display = Array.isArray(val)
        ? val.join(", ") || "-"
        : typeof val === "boolean"
        ? val
          ? "Yes"
          : "No"
        : desc.type === "file" && val
        ? "File Attached"
        : val || "-";
      return [desc.labelEn || desc.key, String(display)];
    }),
    ["Additional Notes", p.notes || "-"]
  ];

  autoTable(doc, {
    startY: 94,
    margin: { right: p.photo ? 170 : 40 },
    body: rows,
    theme: "grid",
    styles: { fontSize: 9.5, cellPadding: 6 },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [255, 251, 244], textColor: [13, 75, 94], cellWidth: 155 }
    }
  });

  doc.save(`${p.profileId || "Biodata"}_${(p.surname || "Profile").replace(/\s+/g, "_")}.pdf`);
};
