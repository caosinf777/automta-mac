/**
 * AutoMTA Mac — IPC Handlers
 * Registra todos los handlers del proceso main para responder a llamadas del renderer
 */

import {
  ipcMain,
  BrowserWindow,
  clipboard,
  dialog,
  Notification,
  shell,
  app,
  desktopCapturer,
  screen as electronScreen,
  systemPreferences,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import { store } from './main';
import {
  captureScreen,
  executeComputerAction,
  getRunningApps,
  getMousePosition,
} from './computerUseNative';
import { getPermissionsStatus, requestScreenPermission, requestAccessibilityPermission } from './systemPermissions';

export function registerIpcHandlers(mainWindow: BrowserWindow) {

  // ─── Window Controls ────────────────────────────────────────────────────────
  ipcMain.on('app:minimize', () => mainWindow.minimize());
  ipcMain.on('app:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('app:close', () => mainWindow.hide());
  ipcMain.on('app:hide', () => mainWindow.hide());

  // ─── System Info ────────────────────────────────────────────────────────────
  ipcMain.handle('system:get-info', () => ({
    platform: process.platform,
    arch: process.arch,
    version: process.version,
    isElectron: true,
    appVersion: app.getVersion(),
    appName: app.getName(),
  }));

  // ─── Computer Use: Screen Capture ────────────────────────────────────────────
  ipcMain.handle('computer-use:capture-screen', async () => {
    try {
      const result = await captureScreen();
      return { success: true, ...result };
    } catch (error: any) {
      console.error('[IPC] Screen capture failed:', error);
      return { success: false, error: error.message };
    }
  });

  // ─── Computer Use: Execute Action ────────────────────────────────────────────
  ipcMain.handle('computer-use:execute-action', async (_event, action) => {
    try {
      await executeComputerAction(action);
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] Action execution failed:', error, action);
      return { success: false, error: error.message };
    }
  });

  // ─── Computer Use: Get Open Apps ─────────────────────────────────────────────
  ipcMain.handle('computer-use:get-open-apps', async () => {
    try {
      return await getRunningApps();
    } catch (error: any) {
      console.error('[IPC] Get open apps failed:', error);
      return [];
    }
  });

  // ─── Computer Use: Mouse Position ────────────────────────────────────────────
  ipcMain.handle('computer-use:get-mouse-position', () => {
    return getMousePosition();
  });

  // ─── Clipboard ───────────────────────────────────────────────────────────────
  ipcMain.handle('system:get-clipboard', () => {
    return clipboard.readText();
  });

  ipcMain.handle('system:set-clipboard', (_event, text: string) => {
    clipboard.writeText(text);
  });

  // ─── File Dialogs ────────────────────────────────────────────────────────────
  ipcMain.handle('system:open-file-dialog', async (_event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: options?.title || 'Seleccionar archivo',
      properties: options?.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: options?.filters || [
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('system:save-file-dialog', async (_event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: options?.title || 'Guardar archivo',
      defaultPath: options?.defaultPath,
      filters: options?.filters || [
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
    });
    return result.canceled ? null : result.filePath;
  });

  // ─── Notifications ───────────────────────────────────────────────────────────
  ipcMain.handle('system:send-notification', (_event, options: {
    title: string;
    body: string;
    silent?: boolean;
  }) => {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        silent: options.silent || false,
        icon: undefined, // Will use app icon
      });

      notification.on('click', () => {
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('system:notification-clicked', options.title);
      });

      notification.show();
    }
  });

  // ─── Open External URL ───────────────────────────────────────────────────────
  ipcMain.handle('system:open-external', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // ─── Permissions ─────────────────────────────────────────────────────────────
  ipcMain.handle('system:get-permissions', async () => {
    return getPermissionsStatus();
  });

  ipcMain.handle('system:request-permissions', async (_event, permissions: string[]) => {
    const results: Record<string, string> = {};

    for (const permission of permissions) {
      if (permission === 'screen') {
        const status = await requestScreenPermission();
        results.screen = status;
      } else if (permission === 'accessibility') {
        const status = await requestAccessibilityPermission();
        results.accessibility = status;
      }
    }

    return results;
  });

  // ─── Settings ────────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', (_event, key: string) => {
    return store.get(key as any);
  });

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    store.set(key as any, value as any);
  });

  // ─── Auto Updater ────────────────────────────────────────────────────────────
  ipcMain.handle('updater:check', async () => {
    await autoUpdater.checkForUpdates();
  });

  ipcMain.handle('updater:download', async () => {
    await autoUpdater.downloadUpdate();
  });

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall();
  });

  // Setup updater events to forward to renderer
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('updater:update-available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('updater:update-downloaded', info);
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('updater:download-progress', progress);
  });

  console.log('[IPC] All handlers registered successfully');
}
