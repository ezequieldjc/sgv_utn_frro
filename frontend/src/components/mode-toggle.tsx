import React, { useEffect, useState } from "react";

const SunIcon = ({ active }: { active: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={`h-4 w-4 transition-all duration-300 ${active ? "text-amber-500" : "text-slate-400"}`}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" />
  </svg>
);

const MoonIcon = ({ active }: { active: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={`h-4 w-4 transition-all duration-300 ${active ? "text-slate-200" : "text-slate-400"}`}
    aria-hidden="true"
  >
    <path d="M21 12.8A8.9 8.9 0 0 1 11.2 3a9 9 0 1 0 9.8 9.8Z" />
  </svg>
);

export const ModeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const syncTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    html.classList.toggle("dark");
    setIsDark(html.classList.contains("dark"));
  };

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      onClick={toggleTheme}
      className="
        relative inline-flex h-10 w-20 items-center rounded-full
        border border-slate-200 bg-white/80 p-1
        shadow-sm shadow-slate-200/70 backdrop-blur-sm
        transition-all duration-300 hover:shadow-md
        dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-slate-950/40
      "
    >
      <span
        className={`
          absolute inset-1 rounded-full transition-all duration-300 ease-out
          ${isDark ? "bg-gradient-to-r from-slate-800 to-slate-700" : "bg-gradient-to-r from-amber-100 to-sky-100"}
        `}
      />

      <span
        className={`
          relative z-10 flex h-7 w-7 items-center justify-center rounded-full
          bg-white text-slate-700 shadow-md transition-transform duration-300
          dark:bg-slate-800 dark:text-slate-100
          ${isDark ? "translate-x-10" : "translate-x-0"}
        `}
      >
        {isDark ? <MoonIcon active={true} /> : <SunIcon active={true} />}
      </span>

      <span className="absolute inset-0 z-10 flex items-center justify-between px-2.5 text-[10px] font-semibold uppercase tracking-[0.2em]">
        <span className={isDark ? "text-slate-500" : "text-amber-600"}>☀</span>
        <span className={isDark ? "text-slate-200" : "text-slate-400"}>☾</span>
      </span>
    </button>
  );
};
