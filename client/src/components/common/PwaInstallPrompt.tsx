import React, { useState } from 'react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { Download, X, Share2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

export const PwaInstallPrompt: React.FC = () => {
  const { isInstallable, isStandalone, isIOS, promptInstall } = usePwaInstall();
  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem('sr_pwa_prompt_dismissed') === 'true';
  });
  const [showIosGuide, setShowIosGuide] = useState(false);

  // If already running standalone as native app, or dismissed, don't show
  if (isStandalone || isDismissed || !isInstallable) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('sr_pwa_prompt_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIosGuide(!showIosGuide);
      return;
    }

    const accepted = await promptInstall();
    if (accepted) {
      toast.success('SmartRoute installed successfully! You can launch it from your home screen or apps menu.');
      handleDismiss();
    }
  };

  return (
    <aside
      role="region"
      aria-label="Install SmartRoute Application"
      data-testid="pwa-install-prompt"
      className="!fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-[320px] box-border overflow-hidden pointer-events-auto rounded-2xl p-3.5 border border-outline-variant/70 dark:border-obsidian-750/90 dark:bg-obsidian-900/95 bg-white/95 backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shrink-0 shadow-md">
          <Smartphone className="w-5 h-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-on-surface dark:text-slate-100 uppercase tracking-wider truncate">
              Install SmartRoute
            </h4>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
              className="text-on-surface-variant hover:text-on-surface dark:text-slate-400 dark:hover:text-white p-1 rounded-lg transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-on-surface-variant dark:text-slate-300 mt-0.5 leading-relaxed">
            Run as a native app with full-screen view and no browser URL bar.
          </p>

          {showIosGuide && (
            <div
              data-testid="ios-install-guide"
              className="mt-2.5 p-2 rounded-xl bg-surface-container/60 dark:bg-obsidian-800/80 text-[11px] text-on-surface-variant dark:text-slate-300 space-y-1 border border-outline-variant/50 dark:border-obsidian-700"
            >
              <p className="font-semibold text-primary dark:text-emerald-400 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5" /> On iPhone/iPad:
              </p>
              <p>
                1. Tap the <span className="font-semibold">Share</span> button in Safari.
              </p>
              <p>
                2. Select <span className="font-semibold">Add to Home Screen</span>.
              </p>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              data-testid="pwa-install-btn"
              className="spring-press flex-1 h-8 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {isIOS ? 'How to Install' : 'Install App'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="spring-press px-2.5 h-8 rounded-xl text-xs font-medium text-on-surface-variant hover:text-on-surface dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
