export type Theme = {
  page: string;
  header: string;
  text: string;
  subtext: string;
  mutedText: string;
  section: string;
  label: string;
  input: string;
  inputCode: string;
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
  page: "theme-light min-h-screen bg-orange-50 text-slate-900 font-sans",
  header: "bg-white/80 backdrop-blur-md border-b border-orange-100 p-4 shadow-sm sticky top-0 z-10",
  text: "text-slate-900",
  subtext: "text-slate-600",
  mutedText: "text-slate-500",
  section:
    "shadow-sm rounded-xl p-5 mb-4 border border-orange-100/50 bg-white transition-colors hover:shadow-md",
  label: "block text-sm font-bold mb-1 text-slate-700",
  input:
    "w-full rounded-xl border border-slate-200 p-2.5 text-sm bg-white text-slate-900 focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none transition-all",
  inputCode:
    "w-full rounded-xl border border-slate-200 p-2.5 text-base font-mono bg-white text-slate-900 focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none transition-all",
  borderColor: "#fed7aa", // orange-200
  buttonPrimary:
    "px-5 py-2.5 rounded-xl bg-orange-500 text-white font-semibold shadow-sm hover:bg-orange-600 hover:shadow hover:-translate-y-0.5 active:translate-y-0 disabled:bg-orange-200 disabled:shadow-none disabled:cursor-not-allowed transition-all",
  buttonSecondary:
    "px-5 py-2.5 rounded-xl bg-white text-slate-600 font-medium border border-slate-200 shadow-sm hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed transition-all",
  buttonUpload:
    "px-5 py-2.5 rounded-xl bg-green-600 text-white font-semibold shadow-sm hover:bg-green-500 hover:shadow hover:-translate-y-0.5 active:translate-y-0 disabled:bg-green-200 disabled:shadow-none disabled:cursor-not-allowed transition-all",
  buttonDanger:
    "px-5 py-2.5 rounded-xl bg-rose-500 text-white font-semibold shadow-sm hover:bg-rose-600 hover:shadow hover:-translate-y-0.5 active:translate-y-0 disabled:bg-rose-200 disabled:shadow-none disabled:cursor-not-allowed transition-all",
  helperText: "text-xs text-slate-500",
  dangerText: "text-rose-600",
  successText: "text-green-700",
  warningText: "text-amber-700",
  codeBackground: "#fff7ed", // orange-50
  progressTrack: "bg-orange-100",
  progressBar: "bg-orange-500",
  progressOk: "bg-green-500",
  progressError: "bg-rose-500",
  spinnerTrack: "#ffedd5", // orange-100
  spinnerLead: "#f97316", // orange-500
  badge: {
    ok: "bg-green-100 text-green-800 border border-green-200 rounded-lg px-2 py-0.5 font-medium",
    processing: "bg-orange-100 text-orange-800 border border-orange-200 rounded-lg px-2 py-0.5 font-medium animate-pulse",
    error: "bg-orange-100 text-orange-800 border border-orange-200 rounded-lg px-2 py-0.5 font-medium",
    neutral: "bg-slate-100 text-slate-700 border border-slate-200 rounded-lg px-2 py-0.5 font-medium",
  },
  statusCard: {
    ok: "border-green-200 bg-green-100/50 rounded-xl",
    failed: "border-orange-200 bg-orange-100/50 rounded-xl",
    neutral: "border-slate-200 bg-slate-50/50 rounded-xl",
  },
  well: {
    warning: "bg-amber-50 border border-amber-200 text-amber-800 rounded-xl",
    info: "bg-blue-50 border border-blue-200 text-blue-800 rounded-xl",
    error: "bg-red-50 border border-red-200 text-red-700 rounded-xl",
  },
};

export const darkTheme: Theme = {
  page: "theme-dark min-h-screen bg-stone-950 text-stone-100 font-sans",
  header: "bg-stone-900/80 backdrop-blur-md border-b border-stone-800 p-4 shadow-sm sticky top-0 z-10",
  text: "text-stone-100",
  subtext: "text-stone-400",
  mutedText: "text-stone-500",
  section:
    "shadow-sm rounded-xl p-5 mb-4 border border-stone-800 bg-stone-900/50 transition-colors hover:bg-stone-900",
  label: "block text-sm font-bold mb-1 text-stone-200",
  input:
    "w-full rounded-xl border border-stone-700 p-2.5 text-sm bg-stone-950 text-stone-100 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all",
  inputCode:
    "w-full rounded-xl border border-stone-700 p-2.5 text-base font-mono bg-stone-950 text-stone-100 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all",
  borderColor: "#1c1917", // stone-900
  buttonPrimary:
    "px-5 py-2.5 rounded-xl bg-orange-600 text-white font-semibold shadow-sm hover:bg-orange-500 hover:shadow hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all",
  buttonSecondary:
    "px-5 py-2.5 rounded-xl bg-stone-800 text-stone-200 font-medium border border-stone-700 shadow-sm hover:bg-stone-700 hover:text-white hover:border-stone-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all",
  buttonUpload:
    "px-5 py-2.5 rounded-xl bg-green-600 text-white font-semibold shadow-sm hover:bg-green-500 hover:shadow hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all",
  buttonDanger:
    "px-5 py-2.5 rounded-xl bg-rose-600 text-white font-semibold shadow-sm hover:bg-rose-500 hover:shadow hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all",
  helperText: "text-xs text-stone-400",
  dangerText: "text-rose-400",
  successText: "text-green-400",
  warningText: "text-amber-400",
  codeBackground: "#0c0a09", // stone-950
  progressTrack: "bg-stone-800",
  progressBar: "bg-orange-500",
  progressOk: "bg-green-500",
  progressError: "bg-rose-500",
  spinnerTrack: "#1c1917", // stone-900
  spinnerLead: "#f97316", // orange-500
  badge: {
    ok: "bg-green-900/30 text-green-300 border border-green-800 rounded-lg px-2 py-0.5 font-medium",
    processing: "bg-orange-900/30 text-orange-300 border border-orange-800 rounded-lg px-2 py-0.5 font-medium animate-pulse",
    error: "bg-orange-900/30 text-orange-300 border border-orange-800 rounded-lg px-2 py-0.5 font-medium",
    neutral: "bg-stone-800 text-stone-300 border border-stone-700 rounded-lg px-2 py-0.5 font-medium",
  },
  statusCard: {
    ok: "border-green-800/50 bg-green-900/20 rounded-xl",
    failed: "border-orange-800/50 bg-orange-900/20 rounded-xl",
    neutral: "border-stone-800 bg-stone-900/20 rounded-xl",
  },
  well: {
    warning: "bg-amber-900/20 border border-amber-800 text-amber-200 rounded-xl",
    info: "bg-blue-900/20 border border-blue-800 text-blue-200 rounded-xl",
    error: "bg-red-900/20 border border-red-800 text-red-200 rounded-xl",
  },
};
