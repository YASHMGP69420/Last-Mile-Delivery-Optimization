import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PwaInstallPrompt } from '../PwaInstallPrompt';
import * as pwaHook from '../../../hooks/usePwaInstall';

describe('PwaInstallPrompt Component', () => {
  const mockPromptInstall = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('does not render when app is already in standalone mode', () => {
    vi.spyOn(pwaHook, 'usePwaInstall').mockReturnValue({
      isInstallable: false,
      isStandalone: true,
      isIOS: false,
      promptInstall: mockPromptInstall,
    });

    render(<PwaInstallPrompt />);
    expect(screen.queryByTestId('pwa-install-prompt')).toBeNull();
  });

  it('does not render when app is not installable and not iOS', () => {
    vi.spyOn(pwaHook, 'usePwaInstall').mockReturnValue({
      isInstallable: false,
      isStandalone: false,
      isIOS: false,
      promptInstall: mockPromptInstall,
    });

    render(<PwaInstallPrompt />);
    expect(screen.queryByTestId('pwa-install-prompt')).toBeNull();
  });

  it('renders install prompt when installable on Chromium/Desktop', async () => {
    mockPromptInstall.mockResolvedValue(true);
    vi.spyOn(pwaHook, 'usePwaInstall').mockReturnValue({
      isInstallable: true,
      isStandalone: false,
      isIOS: false,
      promptInstall: mockPromptInstall,
    });

    render(<PwaInstallPrompt />);

    expect(screen.getByTestId('pwa-install-prompt')).toBeInTheDocument();
    expect(screen.getByText(/Install SmartRoute/i)).toBeInTheDocument();
    expect(screen.getByText(/Run as a native app with full-screen view and no browser URL bar/i)).toBeInTheDocument();

    const installBtn = screen.getByTestId('pwa-install-btn');
    expect(installBtn).toHaveTextContent('Install App');

    await act(async () => {
      fireEvent.click(installBtn);
    });

    expect(mockPromptInstall).toHaveBeenCalledTimes(1);
  });

  it('shows iOS installation guide when on iOS', () => {
    vi.spyOn(pwaHook, 'usePwaInstall').mockReturnValue({
      isInstallable: true,
      isStandalone: false,
      isIOS: true,
      promptInstall: mockPromptInstall,
    });

    render(<PwaInstallPrompt />);

    const installBtn = screen.getByTestId('pwa-install-btn');
    expect(installBtn).toHaveTextContent('How to Install');

    fireEvent.click(installBtn);

    expect(screen.getByTestId('ios-install-guide')).toBeInTheDocument();
    expect(screen.getByText(/Add to Home Screen/i)).toBeInTheDocument();
  });

  it('hides prompt and remembers dismissal when user clicks dismiss', () => {
    vi.spyOn(pwaHook, 'usePwaInstall').mockReturnValue({
      isInstallable: true,
      isStandalone: false,
      isIOS: false,
      promptInstall: mockPromptInstall,
    });

    render(<PwaInstallPrompt />);

    const dismissBtn = screen.getByRole('button', { name: /Dismiss install prompt/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByTestId('pwa-install-prompt')).toBeNull();
    expect(sessionStorage.getItem('sr_pwa_prompt_dismissed')).toBe('true');
  });
});
