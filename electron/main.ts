/**
 * AutoMTA Mac — Electron Main Process
 * Gestiona la ventana principal, tray icon, menú nativo y ciclo de vida de la app
 */

import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  shell,
  ipcMain,
  Notification,
  globalShortcut,
  dialog,
  clipboard,
  screen as electronScreen,
  desktopCapturer,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
import { registerIpcHandlers } from './ipcHandlers';
import { registerLocalBridgeHandlers } from './localBridgeHandlers';
import { requestSystemPermissions, getPermissionsStatus } from './systemPermissions';

// ─── Constants ────────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development' || process.env.IS_ELECTRON === 'true';
const FRONTEND_DEV_URL = 'http://localhost:3000';
const APP_PROTOCOL = 'automta';

// Persistent store for app settings
const store = new Store<{
  windowBounds: { width: number; height: number; x?: number; y?: number };
  isFirstRun: boolean;
  autoLaunch: boolean;
  computerUseAutoApprove: boolean;
  theme: 'dark' | 'light' | 'system';
}>({
  defaults: {
    windowBounds: { width: 1280, height: 800 },
    isFirstRun: true,
    autoLaunch: false,
    computerUseAutoApprove: false,
    theme: 'system',
  },
});

// ─── Global References ────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// ─── App Protocol Registration ─────────────────────────────────────────────────
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(APP_PROTOCOL);
}

// ─── Single Instance Lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    // If user opens a second instance, focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Handle deep links on second instance
    const url = commandLine.find((arg) => arg.startsWith(`${APP_PROTOCOL}://`));
    if (url) handleDeepLink(url);
  });
}

// ─── Window Creation ───────────────────────────────────────────────────────────
async function createMainWindow(): Promise<BrowserWindow> {
  const savedBounds = store.get('windowBounds');
  const { width: screenWidth, height: screenHeight } = electronScreen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.min(savedBounds.width, screenWidth),
    height: Math.min(savedBounds.height, screenHeight),
    x: savedBounds.x,
    y: savedBounds.y,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // macOS native: traffic lights overlay
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0f0f1a',  // Match app dark bg
    vibrancy: 'under-window',    // macOS blur effect
    visualEffectState: 'active',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev, // Allow localhost in dev
      allowRunningInsecureContent: isDev,
    },
    show: false, // Show after ready-to-show for smooth launch
  });

  // ── Load Content ────────────────────────────────────────────────────────────
  if (isDev) {
    await win.loadURL(FRONTEND_DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Load the built React app from extraResources
    const indexPath = path.join(process.resourcesPath, 'app', 'index.html');
    await win.loadFile(indexPath);
  }

  // ── Window Events ───────────────────────────────────────────────────────────
  win.once('ready-to-show', () => {
    win.show();
    // Animate in
    win.setOpacity(0);
    let opacity = 0;
    const fadeIn = setInterval(() => {
      opacity += 0.05;
      win.setOpacity(Math.min(opacity, 1));
      if (opacity >= 1) clearInterval(fadeIn);
    }, 16);
  });

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide(); // Hide to tray instead of quitting
    }
  });

  win.on('resize', () => saveBounds(win));
  win.on('move', () => saveBounds(win));

  // ── Open external links in browser ─────────────────────────────────────────
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes('localhost')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  return win;
}

function saveBounds(win: BrowserWindow) {
  const bounds = win.getBounds();
  store.set('windowBounds', bounds);
}

// ─── Tray Setup ────────────────────────────────────────────────────────────────
function createTray(): Tray {
  const iconPath = path.join(__dirname, '../assets/trayIcon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });

  const t = new Tray(icon);
  t.setToolTip('AutoMTA — Agentes de IA');

  const updateContextMenu = (pendingActions: number = 0) => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'AutoMTA',
        icon: nativeImage.createFromPath(path.join(__dirname, '../assets/icon-small.png')).resize({ width: 16, height: 16 }),
        enabled: false,
      },
      { type: 'separator' },
      {
        label: '📋 Abrir AutoMTA',
        accelerator: 'CmdOrCtrl+Shift+A',
        click: () => showMainWindow(),
      },
      {
        label: `🤖 Computer Use${pendingActions > 0 ? ` (${pendingActions} pendientes)` : ''}`,
        click: () => {
          showMainWindow();
          mainWindow?.webContents.send('navigate', '/computer-use');
        },
      },
      { type: 'separator' },
      {
        label: '🔔 Notificaciones',
        type: 'checkbox',
        checked: true,
        click: () => {},
      },
      {
        label: '🚀 Iniciar al arrancar',
        type: 'checkbox',
        checked: store.get('autoLaunch'),
        click: (item) => {
          store.set('autoLaunch', item.checked);
          app.setLoginItemSettings({ openAtLogin: item.checked });
        },
      },
      { type: 'separator' },
      {
        label: '🔄 Buscar actualizaciones',
        click: () => autoUpdater.checkForUpdatesAndNotify(),
      },
      { type: 'separator' },
      {
        label: 'Salir de AutoMTA',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    t.setContextMenu(menu);
  };

  updateContextMenu();
  t.on('click', () => showMainWindow());

  // Expose update method globally
  (global as any).updateTrayMenu = updateContextMenu;

  return t;
}

function showMainWindow() {
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
}

// ─── Native App Menu ───────────────────────────────────────────────────────────
function buildAppMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: 'Acerca de AutoMTA' },
        { type: 'separator' },
        {
          label: 'Preferencias...',
          accelerator: 'Cmd+,',
          click: () => {
            showMainWindow();
            mainWindow?.webContents.send('navigate', '/settings');
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: 'Ocultar AutoMTA' },
        { role: 'hideOthers', label: 'Ocultar otros' },
        { role: 'unhide', label: 'Mostrar todo' },
        { type: 'separator' },
        {
          label: 'Salir de AutoMTA',
          accelerator: 'Cmd+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Nuevo agente...',
          accelerator: 'Cmd+N',
          click: () => {
            showMainWindow();
            mainWindow?.webContents.send('navigate', '/workspace/new');
          },
        },
        {
          label: 'Nueva conversación',
          accelerator: 'Cmd+T',
          click: () => {
            showMainWindow();
            mainWindow?.webContents.send('navigate', '/chat');
          },
        },
        { type: 'separator' },
        { role: 'close', label: 'Cerrar ventana' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'forceReload', label: 'Forzar recarga' },
        ...(isDev ? [{ role: 'toggleDevTools' as const, label: 'Herramientas de desarrollador' }] : []),
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamaño real' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
      ],
    },
    {
      label: 'Agentes',
      submenu: [
        {
          label: '🤖 Computer Use',
          accelerator: 'Cmd+Shift+C',
          click: () => {
            showMainWindow();
            mainWindow?.webContents.send('navigate', '/computer-use');
          },
        },
        {
          label: '💬 Chat con agentes',
          accelerator: 'Cmd+Shift+Space',
          click: () => {
            showMainWindow();
            mainWindow?.webContents.send('navigate', '/chat');
          },
        },
        {
          label: '📋 Mis agentes',
          click: () => {
            showMainWindow();
            mainWindow?.webContents.send('navigate', '/agents');
          },
        },
        { type: 'separator' },
        {
          label: '🔧 Workspace de agentes',
          click: () => {
            showMainWindow();
            mainWindow?.webContents.send('navigate', '/workspace');
          },
        },
      ],
    },
    {
      label: 'Ventana',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'zoom', label: 'Zoom' },
        { type: 'separator' },
        { role: 'front', label: 'Traer al frente' },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Documentación',
          click: () => shell.openExternal('https://automta.au/docs'),
        },
        {
          label: 'Soporte',
          click: () => shell.openExternal('https://automta.au/support'),
        },
        { type: 'separator' },
        {
          label: 'Reportar un problema',
          click: () => shell.openExternal('https://automta.au/feedback'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Global Shortcuts ──────────────────────────────────────────────────────────
function registerGlobalShortcuts() {
  // Cmd+Shift+A: Open AutoMTA from anywhere
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    showMainWindow();
  });

  // Cmd+Shift+C: Open Computer Use panel
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    showMainWindow();
    mainWindow?.webContents.send('navigate', '/computer-use');
    mainWindow?.webContents.send('computer-use:activate');
  });
}

// ─── Deep Link Handler ─────────────────────────────────────────────────────────
function handleDeepLink(url: string) {
  const parsed = new URL(url);
  const route = parsed.pathname || '/';
  if (mainWindow) {
    mainWindow.webContents.send('navigate', route);
  }
}

// ─── Auto Updater ──────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Actualización disponible',
        message: `AutoMTA ${info.version} está disponible.`,
        detail: 'La actualización se descargará en segundo plano. Puedes continuar usando la app.',
        buttons: ['Descargar', 'Más tarde'],
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.downloadUpdate();
      });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Actualización lista',
        message: 'La actualización está lista para instalar.',
        detail: 'AutoMTA se reiniciará para aplicar la actualización.',
        buttons: ['Reiniciar ahora', 'Más tarde'],
      })
      .then(({ response }) => {
        if (response === 0) {
          isQuitting = true;
          autoUpdater.quitAndInstall();
        }
      });
  });

  // Check for updates after 3 seconds of app start
  if (!isDev) {
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 3000);
  }
}

// ─── App Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Set app user model ID (needed for notifications on some systems)
  if (process.platform === 'win32') {
    app.setAppUserModelId('au.automta.mac');
  }

  // Build native menu
  buildAppMenu();

  // Create main window
  mainWindow = await createMainWindow();

  // Create tray
  tray = createTray();

  // Register IPC handlers (computer use, system, etc.)
  registerIpcHandlers(mainWindow);
  registerLocalBridgeHandlers(mainWindow);

  // Register global keyboard shortcuts
  registerGlobalShortcuts();

  // Setup auto-updater
  setupAutoUpdater();

  // Request system permissions (async, shows guide if needed)
  const isFirstRun = store.get('isFirstRun');
  if (isFirstRun) {
    store.set('isFirstRun', false);
    // Give the window time to fully load before showing permission dialogs
    setTimeout(async () => {
      await requestSystemPermissions(mainWindow!);
    }, 2000);
  }

  // macOS: re-create window if dock icon clicked and no windows open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow().then((win) => {
        mainWindow = win;
      });
    } else {
      showMainWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle deep links on macOS (opened via automta:// URLs)
app.on('open-url', (_event, url) => {
  _event.preventDefault();
  handleDeepLink(url);
});

// Export store for use in other modules
export { store, mainWindow };
