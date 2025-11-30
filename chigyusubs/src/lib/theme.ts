export type Theme = {
  page: string;
  header: string;
  text: string;
  subtext: string;
  mutedText: string;
  section: string;
  label: string;
  input: string;
  borderColor: string;
  buttonPrimary: string;
  buttonSecondary: string;
  buttonUpload: string;
  buttonDanger: string;
  helperText: string;
  dangerText: string;
  successText: string;
  warningText: string;
  codeBackground: string;
  progressTrack: string;
  progressBar: string;
  progressOk: string;
  progressError: string;
  spinnerTrack: string;
  spinnerLead: string;
  badge: {
    ok: string;
    processing: string;
    error: string;
    neutral: string;
  };
  statusCard: {
    ok: string;
    failed: string;
    neutral: string;
  };
  well: {
    warning: string;
    info: string;
    error: string;
  };
};

export const lightTheme: Theme = {
  page: "theme-light min-h-screen bg-slate-100 text-slate-900",
  header: "bg-white border-b border-slate-200 p-4 shadow-sm",
  text: "text-slate-900",
  subtext: "text-slate-600",
  mutedText: "text-slate-500",
  section:
    "shadow-sm rounded p-4 mb-4 border border-slate-200 bg-white transition-colors",
  label: "block text-sm font-medium mb-1 text-slate-800",
  input:
    "w-full rounded border border-slate-300 p-2 text-sm bg-white text-slate-900",
  borderColor: "#d1d5db",
  buttonPrimary:
    "px-4 py-2 rounded bg-cyan-600 text-white border border-cyan-700 hover:bg-cyan-700 disabled:bg-cyan-300 disabled:border-cyan-300 disabled:text-white disabled:cursor-not-allowed transition-colors",
  buttonSecondary:
    "px-4 py-2 rounded bg-slate-500 text-white border border-slate-600 hover:bg-slate-600 disabled:bg-slate-300 disabled:border-slate-300 disabled:text-white disabled:cursor-not-allowed transition-colors",
  buttonUpload:
    "px-4 py-2 rounded bg-emerald-600 text-white border border-emerald-700 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:border-emerald-300 disabled:text-white disabled:cursor-not-allowed transition-colors",
  buttonDanger:
    "px-4 py-2 rounded bg-red-600 text-white border border-red-700 hover:bg-red-700 disabled:bg-red-300 disabled:border-red-300 disabled:text-white disabled:cursor-not-allowed transition-colors",
  helperText: "text-xs text-slate-500",
  dangerText: "text-red-600",
  successText: "text-green-700",
  warningText: "text-amber-700",
  codeBackground: "#f8fafc",
  progressTrack: "bg-slate-200",
  progressBar: "bg-cyan-600",
  progressOk: "bg-emerald-500",
  progressError: "bg-rose-500",
  spinnerTrack: "#cbd5e1",
  spinnerLead: "#475569",
  badge: {
    ok: "bg-emerald-100 text-emerald-700",
    processing: "bg-cyan-100 text-cyan-700",
    error: "bg-rose-100 text-rose-700",
    neutral: "bg-slate-100 text-slate-700",
  },
  statusCard: {
    ok: "border-emerald-200 bg-emerald-50",
    failed: "border-rose-200 bg-rose-50",
    neutral: "border-slate-200 bg-slate-50",
  },
  well: {
    warning: "bg-amber-50 border border-amber-200 text-amber-800",
    info: "bg-blue-50 border border-blue-200 text-blue-800",
    error: "bg-red-50 border border-red-200 text-red-700",
  },
};

export const darkTheme: Theme = {
  page: "theme-dark min-h-screen bg-slate-950 text-slate-100",
  header: "bg-slate-900 border-b border-slate-800 p-4 shadow-sm",
  text: "text-slate-100",
  subtext: "text-slate-400",
  mutedText: "text-slate-500",
  section:
    "shadow-sm rounded p-4 mb-4 border border-slate-800 bg-slate-900 transition-colors",
  label: "block text-sm font-medium mb-1 text-slate-100",
  input:
    "w-full rounded border border-slate-700 p-2 text-sm bg-slate-950 text-slate-100",
  borderColor: "#1f2937",
  buttonPrimary:
    "px-4 py-2 rounded bg-cyan-500 text-white border border-cyan-600 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  buttonSecondary:
    "px-4 py-2 rounded bg-slate-700 text-white border border-slate-800 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  buttonUpload:
    "px-4 py-2 rounded bg-emerald-500 text-white border border-emerald-600 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  buttonDanger:
    "px-4 py-2 rounded bg-rose-500 text-white border border-rose-600 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  helperText: "text-xs text-slate-400",
  dangerText: "text-rose-300",
  successText: "text-emerald-300",
  warningText: "text-amber-300",
  codeBackground: "#0d1118",
  progressTrack: "bg-slate-800",
  progressBar: "bg-cyan-500",
  progressOk: "bg-emerald-500",
  progressError: "bg-rose-500",
  spinnerTrack: "#1f2937",
  spinnerLead: "#67e8f9",
  badge: {
    ok: "bg-emerald-900 text-emerald-200",
    processing: "bg-cyan-900 text-cyan-200",
    error: "bg-rose-900 text-rose-200",
    neutral: "bg-slate-800 text-slate-200",
  },
  statusCard: {
    ok: "border-emerald-700 bg-emerald-900",
    failed: "border-rose-700 bg-rose-900",
    neutral: "border-slate-700 bg-slate-800",
  },
  well: {
    warning: "bg-warning-dark border border-amber-800 text-amber-200",
    info: "bg-info-dark border border-cyan-800 text-cyan-200",
    error: "bg-error-dark border border-rose-800 text-rose-200",
  },
};
