/**
 * AutoMTA Mac — Menu Bar Panel (Companion Popover)
 * Crea la ventana flotante que aparece cuando el usuario hace click en el tray icon
 * Diseño: panel pequeño pegado a la barra de menú, sin marco nativo
 */

import { BrowserWindow, Tray, screen as electronScreen } from 'electron';
import * as path from 'path';

const isDev = process.env.NODE_ENV === 'development' || process.env.IS_ELECTRON === 'true';

let menuBarWindow: BrowserWindow | null = null;

export function createMenuBarPanel(): BrowserWindow {
  const win = new BrowserWindow({
    width: 380,
    height: 520,
    show: false,
    frame: false,                    // Sin barra de título nativa
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,               // No aparece en el dock
    transparent: true,               // Fondo transparente para bordes redondeados
    hasShadow: true,
    vibrancy: 'menu',                // Blur nativo de macOS
    visualEffectState: 'active',
    backgroundColor: '#00000000',    // Transparente
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the companion mini app route
  const companionUrl = isDev
    ? 'http://localhost:3000/#/mac/companion'
    : `file://${path.join(process.resourcesPath, 'app', 'index.html')}#/mac/companion`;

  win.loadURL(companionUrl);

  // Hide when loses focus (click outside)
  win.on('blur', () => {
    if (!isDev) {
      win.hide();
    }
  });

  menuBarWindow = win;
  return win;
}

/**
 * Toggle the menu bar panel visibility
 * Positions it below the tray icon
 */
export function toggleMenuBarPanel(tray: Tray, win: BrowserWindow) {
  if (win.isVisible()) {
    win.hide();
    return;
  }

  // Calculate position: below the tray icon, right-aligned
  const trayBounds = tray.getBounds();
  const windowBounds = win.getBounds();
  const { workArea } = electronScreen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  });

  // Center the panel horizontally with the tray icon
  // Keep it within screen bounds
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  let y = Math.round(trayBounds.y + trayBounds.height + 4); // 4px gap below tray

  // Clamp to screen bounds
  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - windowBounds.width));
  y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - windowBounds.height));

  win.setPosition(x, y, false);
  win.show();
  win.focus();
}

/**
 * Create the Spotlight-style quick input window
 * Opens with Cmd+Shift+Space from anywhere
 */
export function createQuickInputWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = electronScreen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: 620,
    height: 72,           // Starts small, expands when agent responds
    x: Math.round(screenWidth / 2 - 310),
    y: Math.round(screenHeight * 0.3),  // 30% from top — above center
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    hasShadow: true,
    vibrancy: 'popover',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const quickInputUrl = isDev
    ? 'http://localhost:3000/#/mac/quick-input'
    : `file://${path.join(process.resourcesPath, 'app', 'index.html')}#/mac/quick-input`;

  win.loadURL(quickInputUrl);

  win.on('blur', () => {
    win.hide();
    // Reset size when hidden
    win.setSize(620, 72);
  });

  return win;
}

export { menuBarWindow };
