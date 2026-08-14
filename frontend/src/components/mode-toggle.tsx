import React from 'react';

export const ModeToggle: React.FC = () => {
  return (
    <button
      aria-label="Toggle color mode"
      className="rounded px-2 py-1 border"
      onClick={() => {
        // simple theme toggle placeholder
        const html = document.documentElement;
        if (html.classList.contains('dark')) html.classList.remove('dark');
        else html.classList.add('dark');
      }}
    >
      Mode
    </button>
  );
};
