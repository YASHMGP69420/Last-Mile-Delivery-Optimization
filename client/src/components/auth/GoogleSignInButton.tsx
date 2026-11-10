import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void | Promise<void>;
  onError?: (message: string) => void;
  disabled?: boolean;
}

const GSI_SCRIPT_ID = 'google-identity-services-script';
const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onCredential,
  onError,
  disabled = false,
}) => {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  const [sdkReady, setSdkReady] = useState<boolean>(() => Boolean(window.google?.accounts?.id));
  const [sdkFailed, setSdkFailed] = useState(false);

  callbackRef.current = onCredential;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!clientId) return;

    if (window.google?.accounts?.id) {
      setSdkReady(true);
      return;
    }

    let script = document.getElementById(GSI_SCRIPT_ID) as HTMLScriptElement | null;
    const handleLoad = () => {
      if (window.google?.accounts?.id) {
        setSdkReady(true);
      } else {
        setSdkFailed(true);
        onErrorRef.current?.('Google Sign-In SDK initialized without accounts API.');
      }
    };
    const handleScriptError = () => {
      setSdkFailed(true);
      onErrorRef.current?.('Failed to load Google Sign-In script. Check network access.');
    };

    if (!script) {
      script = document.createElement('script');
      script.id = GSI_SCRIPT_ID;
      script.src = GSI_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleScriptError);

    return () => {
      script?.removeEventListener('load', handleLoad);
      script?.removeEventListener('error', handleScriptError);
    };
  }, [clientId]);

  useEffect(() => {
    if (!clientId || !sdkReady || !buttonContainerRef.current || !window.google?.accounts?.id) {
      return;
    }

    const container = buttonContainerRef.current;
    container.innerHTML = '';

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response?.credential) {
          callbackRef.current(response.credential);
        } else {
          onErrorRef.current?.('Google Sign-In did not return a verified ID token.');
        }
      },
      auto_select: false,
    });

    const width = Math.min(360, Math.max(240, container.clientWidth || 320));
    window.google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width,
    });
  }, [clientId, sdkReady]);

  if (!clientId) {
    return (
      <div
        data-testid="google-unconfigured-notice"
        className="w-full rounded-lg border border-outline-variant/60 bg-surface-low/60 px-3 py-2.5 text-[11px] text-on-surface-variant flex items-center gap-2"
      >
        <AlertCircle className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
        <span>
          Google Sign-In unavailable in this environment — set{' '}
          <code className="font-mono text-on-surface">VITE_GOOGLE_CLIENT_ID</code> and{' '}
          <code className="font-mono text-on-surface">GOOGLE_CLIENT_ID</code> to enable OAuth.
        </span>
      </div>
    );
  }

  if (sdkFailed) {
    return (
      <div className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Google Sign-In script could not be loaded. Use Email or Phone OTP below.</span>
      </div>
    );
  }

  return (
    <div className={`relative flex justify-center ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      {!sdkReady && (
        <div className="w-full h-10 rounded-lg border border-outline-variant/60 bg-surface-low/60 flex items-center justify-center gap-2 text-xs text-on-surface-variant">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Loading Google Sign-In…</span>
        </div>
      )}
      <div
        ref={buttonContainerRef}
        className={sdkReady ? 'w-full flex justify-center min-h-[40px]' : 'hidden'}
      />
    </div>
  );
};
