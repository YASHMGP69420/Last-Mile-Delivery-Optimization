import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaInstallState {
  isInstallable: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  promptInstall: () => Promise<boolean>;
}

export function usePwaInstall(): PwaInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if app is running as standalone PWA
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(Boolean(isStandaloneMode));
    };

    checkStandalone();

    // Check if running on iOS device
    const checkIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isAppleMobile = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isAppleMobile);
    };

    checkIOS();

    // Listen for beforeinstallprompt event (Chromium browsers)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('PWA installation prompt failed:', err);
      return false;
    }
  }, [deferredPrompt]);

  return {
    isInstallable: !isStandalone && (Boolean(deferredPrompt) || isIOS),
    isStandalone,
    isIOS,
    promptInstall,
  };
}
