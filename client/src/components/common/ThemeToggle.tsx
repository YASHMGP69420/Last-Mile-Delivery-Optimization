import React from 'react';
import { useTheme, Theme } from '../../context/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  variant?: 'segmented' | 'icon-only';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', variant = 'segmented' }) => {
  const { theme, effectiveTheme, setTheme } = useTheme();

  if (variant === 'icon-only') {
    // Quick toggle between light and dark
    const toggle = () => {
      if (theme === 'light') setTheme('dark');
      else if (theme === 'dark') setTheme('system');
      else setTheme('light');
    };

    return (
      <button
        onClick={toggle}
        type="button"
        title={`Theme: ${theme} (Click to cycle)`}
        aria-label="Toggle color theme"
        className={`w-9 h-9 rounded-full border border-outline-variant/60 bg-surface-low text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors ${className}`}
      >
        {theme === 'light' && <Sun className="w-4 h-4 text-amber-500" />}
        {theme === 'dark' && <Moon className="w-4 h-4 text-primary" />}
        {theme === 'system' && <Monitor className="w-4 h-4 text-primary" />}
      </button>
    );
  }

  const options: { id: Theme; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
    { id: 'system', label: 'Auto', icon: <Monitor className="w-3.5 h-3.5" /> },
    { id: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      role="group"
      aria-label="Theme selection"
      className={`inline-flex items-center p-1 rounded-full border border-outline-variant/60 bg-surface-low ${className}`}
    >
      {options.map((opt) => {
        const isActive = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTheme(opt.id)}
            aria-pressed={isActive}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
              isActive
                ? 'bg-surface-lowest text-primary shadow-sm font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title={`Switch to ${opt.label} mode`}
          >
            {opt.icon}
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
