/**
 * localBridgeHandlers — IPC handlers para el bridge local
 * Se registran en el proceso main de Electron.
 * 
 * Conecta las llamadas del renderer (React) con los recursos reales del Mac:
 * filesystem, Calendar, Mail, clipboard, Spotlight, etc.
 */

import { ipcMain, BrowserWindow } from 'electron';
import {
  listFiles,
  readFile,
  writeFile,
  openFile,
  searchFiles,
  getClipboard,
  setClipboard,
  getCalendarEvents,
  createCalendarEvent,
  getUnreadMails,
  getRunningApps,
  getSystemStatus,
  executeLocalTool,
} from './localBridge';

// Tool metadata for the renderer
const LOCAL_TOOLS = [
  { name: 'read_file',             label: 'Leer archivo',              enabled: true },
  { name: 'write_file',            label: 'Escribir archivo',          enabled: true },
  { name: 'list_files',            label: 'Listar archivos',           enabled: true },
  { name: 'search_files',          label: 'Buscar archivos (Spotlight)', enabled: true },
  { name: 'open_file',             label: 'Abrir archivo',             enabled: true },
  { name: 'get_clipboard',         label: 'Leer portapapeles',         enabled: true },
  { name: 'set_clipboard',         label: 'Copiar al portapapeles',    enabled: true },
  { name: 'get_calendar_events',   label: 'Ver Calendar',              enabled: true },
  { name: 'create_calendar_event', label: 'Crear evento en Calendar',  enabled: true },
  { name: 'get_unread_mails',      label: 'Leer correos (Mail)',       enabled: true },
  { name: 'get_running_apps',      label: 'Apps en ejecución',         enabled: true },
  { name: 'get_system_status',     label: 'Estado del sistema',        enabled: true },
  { name: 'open_url',              label: 'Abrir URL en browser',      enabled: true },
];

// Watched folders for KB sync
const watchedFolders = new Map<string, any>();

export function registerLocalBridgeHandlers(mainWindow: BrowserWindow): void {

  // ── Execute any local tool ────────────────────────────────────────────────────
  ipcMain.handle('local-bridge:execute-tool', async (_event, toolName: string, params: Record<string, any>) => {
    console.log(`[LocalBridge] Executing tool: ${toolName}`, params);
    try {
      const result = await executeLocalTool(toolName, params);
      console.log(`[LocalBridge] Tool "${toolName}" succeeded`);
      return { success: true, data: result };
    } catch (err: any) {
      console.error(`[LocalBridge] Tool "${toolName}" failed:`, err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Get available tools ───────────────────────────────────────────────────────
  ipcMain.handle('local-bridge:get-tools', async () => {
    return LOCAL_TOOLS;
  });

  // ── Direct handlers for common operations ─────────────────────────────────────
  ipcMain.handle('local-bridge:list-files', async (_event, dirPath: string, options?: any) => {
    try {
      const files = await listFiles(dirPath, options);
      return { success: true, files };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('local-bridge:read-file', async (_event, filePath: string) => {
    try {
      const content = await readFile(filePath);
      return { success: true, content };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('local-bridge:write-file', async (_event, filePath: string, content: string) => {
    try {
      await writeFile(filePath, content);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('local-bridge:search-files', async (_event, query: string, dir?: string) => {
    try {
      const files = await searchFiles(query, dir);
      return { success: true, files };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('local-bridge:get-calendar', async (_event, days?: number) => {
    try {
      const events = await getCalendarEvents(days);
      return { success: true, events };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('local-bridge:get-mails', async (_event, count?: number) => {
    try {
      const mails = await getUnreadMails(count);
      return { success: true, mails };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('local-bridge:get-system-status', async () => {
    try {
      const status = await getSystemStatus();
      return { success: true, status };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('local-bridge:get-clipboard', async () => {
    return { success: true, content: getClipboard() };
  });

  ipcMain.handle('local-bridge:set-clipboard', async (_event, text: string) => {
    setClipboard(text);
    return { success: true };
  });

  // ── Folder watcher for KB sync ─────────────────────────────────────────────────
  ipcMain.handle('local-bridge:watch-folder', async (_event, folderPath: string, agentId: string) => {
    try {
      const fs = require('fs');

      // Stop existing watcher if any
      if (watchedFolders.has(folderPath)) {
        watchedFolders.get(folderPath).close();
      }

      const watcher = fs.watch(folderPath, { recursive: true }, (eventType: string, filename: string) => {
        if (filename) {
          mainWindow.webContents.send('local-bridge:folder-changed', {
            folderPath,
            agentId,
            eventType,
            filename,
          });
        }
      });

      watchedFolders.set(folderPath, watcher);
      console.log(`[LocalBridge] Watching folder: ${folderPath} for agent: ${agentId}`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('local-bridge:unwatch-folder', async (_event, folderPath: string) => {
    const watcher = watchedFolders.get(folderPath);
    if (watcher) {
      watcher.close();
      watchedFolders.delete(folderPath);
    }
    return { success: true };
  });

  console.log('[LocalBridge] ✅ All local bridge IPC handlers registered');
}

export function unregisterLocalBridgeHandlers(): void {
  const channels = [
    'local-bridge:execute-tool',
    'local-bridge:get-tools',
    'local-bridge:list-files',
    'local-bridge:read-file',
    'local-bridge:write-file',
    'local-bridge:search-files',
    'local-bridge:get-calendar',
    'local-bridge:get-mails',
    'local-bridge:get-system-status',
    'local-bridge:get-clipboard',
    'local-bridge:set-clipboard',
    'local-bridge:watch-folder',
    'local-bridge:unwatch-folder',
  ];
  channels.forEach(ch => ipcMain.removeAllListeners(ch));

  // Stop all watchers
  watchedFolders.forEach(w => w.close());
  watchedFolders.clear();
}
