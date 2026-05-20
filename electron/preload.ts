/**
 * AutoMTA Mac — Preload Script
 * Expone APIs seguras de Electron al renderer (la web app de React)
 * Usa contextBridge para aislar el proceso renderer del main
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface SystemInfo {
  platform: string;
  arch: string;
  version: string;
  isElectron: boolean;
  appVersion: string;
}

export interface ComputerUseAction {
  type: 'click' | 'type' | 'key' | 'scroll' | 'screenshot' | 'move';
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  button?: 'left' | 'right' | 'middle';
  scrollX?: number;
  scrollY?: number;
}

export interface PermissionsStatus {
  screen: 'granted' | 'denied' | 'not-determined';
  accessibility: 'granted' | 'denied' | 'not-determined';
  microphone?: 'granted' | 'denied' | 'not-determined';
}

// ─── Allowed IPC Channels ──────────────────────────────────────────────────────
const ALLOWED_SEND_CHANNELS = [
  'app:minimize',
  'app:maximize',
  'app:close',
  'app:hide',
  'computer-use:capture-screen',
  'computer-use:execute-action',
  'computer-use:get-open-apps',
  'computer-use:get-mouse-position',
  'system:get-clipboard',
  'system:set-clipboard',
  'system:open-file-dialog',
  'system:save-file-dialog',
  'system:send-notification',
  'system:get-info',
  'system:get-permissions',
  'system:request-permissions',
  'system:open-external',
  'settings:get',
  'settings:set',
  'updater:check',
  'updater:download',
  'updater:install',
] as const;

const ALLOWED_ON_CHANNELS = [
  'navigate',
  'computer-use:activate',
  'computer-use:action-result',
  'computer-use:pending-update',
  'system:notification-clicked',
  'updater:update-available',
  'updater:update-downloaded',
  'updater:download-progress',
  'app:focus',
  'app:blur',
] as const;

// ─── Exposed API ───────────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {
  // ── System Info ──────────────────────────────────────────────────────────
  isElectron: true,
  getSystemInfo: (): Promise<SystemInfo> =>
    ipcRenderer.invoke('system:get-info'),

  // ── Window Controls ──────────────────────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.send('app:minimize'),
    maximize: () => ipcRenderer.send('app:maximize'),
    close: () => ipcRenderer.send('app:close'),
    hide: () => ipcRenderer.send('app:hide'),
  },

  // ── Computer Use ─────────────────────────────────────────────────────────
  computerUse: {
    /**
     * Capture a screenshot of the primary screen
     * Returns base64 encoded PNG image
     */
    captureScreen: (): Promise<{ success: boolean; image?: string; width?: number; height?: number; error?: string }> =>
      ipcRenderer.invoke('computer-use:capture-screen'),

    /**
     * Execute a mouse/keyboard action (requires accessibility permission)
     */
    executeAction: (action: ComputerUseAction): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('computer-use:execute-action', action),

    /**
     * Get list of running applications on the Mac
     */
    getOpenApps: (): Promise<{ name: string; bundleId: string; pid: number }[]> =>
      ipcRenderer.invoke('computer-use:get-open-apps'),

    /**
     * Get current mouse cursor position
     */
    getMousePosition: (): Promise<{ x: number; y: number }> =>
      ipcRenderer.invoke('computer-use:get-mouse-position'),
  },

  // ── System ───────────────────────────────────────────────────────────────
  system: {
    /**
     * Get clipboard content
     */
    getClipboard: (): Promise<string> =>
      ipcRenderer.invoke('system:get-clipboard'),

    /**
     * Write text to clipboard
     */
    setClipboard: (text: string): Promise<void> =>
      ipcRenderer.invoke('system:set-clipboard', text),

    /**
     * Open native file picker dialog
     */
    openFileDialog: (options?: {
      title?: string;
      filters?: { name: string; extensions: string[] }[];
      multiple?: boolean;
    }): Promise<string[]> =>
      ipcRenderer.invoke('system:open-file-dialog', options),

    /**
     * Save file dialog
     */
    saveFileDialog: (options?: {
      title?: string;
      defaultPath?: string;
      filters?: { name: string; extensions: string[] }[];
    }): Promise<string | null> =>
      ipcRenderer.invoke('system:save-file-dialog', options),

    /**
     * Send a native macOS notification
     */
    sendNotification: (options: {
      title: string;
      body: string;
      silent?: boolean;
      icon?: string;
    }): Promise<void> =>
      ipcRenderer.invoke('system:send-notification', options),

    /**
     * Open URL in default browser
     */
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke('system:open-external', url),

    /**
     * Get current permissions status
     */
    getPermissions: (): Promise<PermissionsStatus> =>
      ipcRenderer.invoke('system:get-permissions'),

    /**
     * Request specific permissions from user
     */
    requestPermissions: (permissions: ('screen' | 'accessibility' | 'microphone')[]): Promise<PermissionsStatus> =>
      ipcRenderer.invoke('system:request-permissions', permissions),
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  settings: {
    get: <T>(key: string): Promise<T> =>
      ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown): Promise<void> =>
      ipcRenderer.invoke('settings:set', key, value),
  },

  // ── Auto Updater ─────────────────────────────────────────────────────────
  updater: {
    checkForUpdates: (): Promise<void> =>
      ipcRenderer.invoke('updater:check'),
    downloadUpdate: (): Promise<void> =>
      ipcRenderer.invoke('updater:download'),
    installUpdate: (): Promise<void> =>
      ipcRenderer.invoke('updater:install'),
  },

  // ── Local Bridge — Mac Resources ─────────────────────────────────────────
  // Connects the cloud agent's tool_use requests to actual Mac capabilities
  localBridge: {
    /**
     * Execute any local Mac tool (filesystem, calendar, mail, etc.)
     * Called when the cloud agent requests a local resource
     */
    executeTool: (toolName: string, params: Record<string, unknown>): Promise<unknown> =>
      ipcRenderer.invoke('local-bridge:execute-tool', toolName, params),

    /**
     * Get list of all available local tools and their status
     */
    getAvailableTools: (): Promise<{ name: string; label: string; enabled: boolean }[]> =>
      ipcRenderer.invoke('local-bridge:get-tools'),

    /**
     * Watch a folder for changes (for KB sync)
     */
    watchFolder: (folderPath: string, agentId: string): Promise<void> =>
      ipcRenderer.invoke('local-bridge:watch-folder', folderPath, agentId),

    /**
     * Stop watching a folder
     */
    unwatchFolder: (folderPath: string): Promise<void> =>
      ipcRenderer.invoke('local-bridge:unwatch-folder', folderPath),
  },

  // ── Event Listeners ──────────────────────────────────────────────────────
  on: (channel: typeof ALLOWED_ON_CHANNELS[number], listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => {
    ipcRenderer.on(channel, listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener(channel, listener);
  },

  once: (channel: typeof ALLOWED_ON_CHANNELS[number], listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => {
    ipcRenderer.once(channel, listener);
  },

  removeListener: (channel: typeof ALLOWED_ON_CHANNELS[number], listener: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, listener);
  },

  removeAllListeners: (channel: typeof ALLOWED_ON_CHANNELS[number]) => {
    ipcRenderer.removeAllListeners(channel);
  },
});


// ─── Type Declaration (for TypeScript in renderer) ─────────────────────────────
// Provides window.electronAPI typings in the React app without duplicate conflicts.
// The actual implementation is injected by contextBridge above.
export type ElectronAPI = {
  isElectron: true;
  getSystemInfo: () => Promise<SystemInfo>;
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    hide: () => void;
  };
  computerUse: {
    captureScreen: () => Promise<{ success: boolean; image?: string; width?: number; height?: number; error?: string }>;
    executeAction: (action: ComputerUseAction) => Promise<{ success: boolean; error?: string }>;
    getOpenApps: () => Promise<{ name: string; bundleId: string; pid: number }[]>;
    getMousePosition: () => Promise<{ x: number; y: number }>;
  };
  system: {
    getClipboard: () => Promise<string>;
    setClipboard: (text: string) => Promise<void>;
    openFileDialog: (options?: { title?: string; filters?: { name: string; extensions: string[] }[]; multiple?: boolean }) => Promise<string[]>;
    saveFileDialog: (options?: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
    sendNotification: (options: { title: string; body: string; silent?: boolean; icon?: string }) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
    getPermissions: () => Promise<PermissionsStatus>;
    requestPermissions: (permissions: ('screen' | 'accessibility' | 'microphone')[]) => Promise<PermissionsStatus>;
  };
  settings: {
    get: <T>(key: string) => Promise<T>;
    set: (key: string, value: unknown) => Promise<void>;
  };
  updater: {
    checkForUpdates: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
  };
  on: (channel: typeof ALLOWED_ON_CHANNELS[number], listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => () => void;
  once: (channel: typeof ALLOWED_ON_CHANNELS[number], listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => void;
  removeListener: (channel: typeof ALLOWED_ON_CHANNELS[number], listener: (...args: unknown[]) => void) => void;
  removeAllListeners: (channel: typeof ALLOWED_ON_CHANNELS[number]) => void;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
