/**
 * useElectron — Hook para detectar y usar APIs de Electron desde React
 * Funciona tanto en Electron (app Mac) como en browser (web app normal)
 */

import { useCallback, useEffect, useRef } from 'react';

// Check if running inside Electron
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
};

export const electronAPI = () => {
  return (window as any).electronAPI as typeof import('../../../automta-mac/electron/preload').electronAPIType | null;
};

/**
 * Hook principal de Electron
 */
export function useElectron() {
  const api = isElectron() ? (window as any).electronAPI : null;

  const navigate = useCallback((route: string) => {
    // This is called FROM main process via IPC, handled in AppRouter
    // But we can also programmatically navigate
    window.dispatchEvent(new CustomEvent('electron:navigate', { detail: route }));
  }, []);

  return {
    isElectron: isElectron(),
    api,
    navigate,
    // Convenience shortcuts
    captureScreen: api?.computerUse?.captureScreen,
    executeAction: api?.computerUse?.executeAction,
    sendNotification: api?.system?.sendNotification,
    getClipboard: api?.system?.getClipboard,
    setClipboard: api?.system?.setClipboard,
    openFileDialog: api?.system?.openFileDialog,
    openExternal: api?.system?.openExternal,
    getPermissions: api?.system?.getPermissions,
    requestPermissions: api?.system?.requestPermissions,
  };
}

/**
 * Hook para escuchar eventos IPC del proceso main de Electron
 */
export function useElectronEvent(
  channel: string,
  handler: (...args: any[]) => void,
  deps: any[] = []
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!isElectron()) return;

    const api = (window as any).electronAPI;
    if (!api?.on) return;

    const cleanup = api.on(channel as any, (_event: any, ...args: any[]) => {
      handlerRef.current(...args);
    });

    return () => {
      if (typeof cleanup === 'function') cleanup();
      else api.removeAllListeners?.(channel as any);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, ...deps]);
}
