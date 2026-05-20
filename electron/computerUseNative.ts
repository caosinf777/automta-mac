/**
 * AutoMTA Mac — Computer Use Native Module
 * Captura pantalla y controla mouse/teclado usando APIs nativas de macOS
 *
 * Usa @nut-tree-fork/nut-js para control de input (compatible con Apple Silicon M1/M2/M3)
 * Usa electron's desktopCapturer para screenshots
 */

import { desktopCapturer, screen as electronScreen, nativeImage } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Lazy-load nut-js to avoid blocking startup (native module)
let nutMouse: any = null;
let nutKeyboard: any = null;
let nutScreen: any = null;
let nutButton: any = null;
let nutKey: any = null;

async function getNutJs() {
  if (!nutMouse) {
    try {
      const nut = await import('@nut-tree-fork/nut-js');
      nutMouse = nut.mouse;
      nutKeyboard = nut.keyboard;
      nutScreen = nut.screen;
      nutButton = nut.Button;
      nutKey = nut.Key;

      // Configure nut-js
      nutMouse.config.autoDelayMs = 50;
      nutKeyboard.config.autoDelayMs = 30;

      console.log('[ComputerUse] nut-js loaded successfully');
    } catch (error) {
      console.warn('[ComputerUse] nut-js not available, mouse/keyboard control disabled:', error);
    }
  }
  return { mouse: nutMouse, keyboard: nutKeyboard, screen: nutScreen, Button: nutButton, Key: nutKey };
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface ScreenCaptureResult {
  image: string;  // base64 PNG
  width: number;
  height: number;
  scaleFactor: number;
}

export interface ComputerAction {
  type: 'click' | 'doubleClick' | 'rightClick' | 'type' | 'key' | 'scroll' | 'screenshot' | 'move' | 'drag';
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  keys?: string[];   // For key combinations like ['ctrl', 'c']
  button?: 'left' | 'right' | 'middle';
  scrollX?: number;
  scrollY?: number;
  toX?: number;     // For drag actions
  toY?: number;
}

// ─── Screen Capture ────────────────────────────────────────────────────────────

/**
 * Capture the primary display as a base64 PNG
 * This is what gets sent to Claude for Computer Use analysis
 */
export async function captureScreen(): Promise<ScreenCaptureResult> {
  const primaryDisplay = electronScreen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const scaleFactor = primaryDisplay.scaleFactor;

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(width * Math.min(scaleFactor, 2)),   // Cap at 2x for performance
      height: Math.round(height * Math.min(scaleFactor, 2)),
    },
  });

  if (sources.length === 0) {
    throw new Error('No screen sources available. Ensure Screen Recording permission is granted.');
  }

  // Get the primary screen (first source)
  const primarySource = sources[0];
  const thumbnail = primarySource.thumbnail;

  // Convert to PNG base64
  const pngBuffer = thumbnail.toPNG();
  const base64Image = pngBuffer.toString('base64');

  return {
    image: base64Image,
    width: thumbnail.getSize().width,
    height: thumbnail.getSize().height,
    scaleFactor,
  };
}

/**
 * Capture a specific region of the screen
 */
export async function captureRegion(x: number, y: number, width: number, height: number): Promise<ScreenCaptureResult> {
  const fullCapture = await captureScreen();
  // For now, return full capture - region cropping can be added
  return fullCapture;
}

// ─── Mouse Control ─────────────────────────────────────────────────────────────

/**
 * Get current mouse cursor position
 */
export function getMousePosition(): { x: number; y: number } {
  const pos = electronScreen.getCursorScreenPoint();
  return { x: pos.x, y: pos.y };
}

/**
 * Move mouse to position (without clicking)
 */
async function moveMouse(x: number, y: number): Promise<void> {
  const { mouse } = await getNutJs();
  if (!mouse) throw new Error('Mouse control not available');
  await mouse.setPosition({ x, y });
}

/**
 * Click at a specific position
 */
async function clickAt(x: number, y: number, button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
  const { mouse, Button } = await getNutJs();
  if (!mouse) throw new Error('Mouse control not available. Grant Accessibility permission.');

  const nutButton = button === 'right' ? Button.RIGHT : button === 'middle' ? Button.MIDDLE : Button.LEFT;

  await mouse.setPosition({ x, y });
  await mouse.click(nutButton);
}

/**
 * Double-click at position
 */
async function doubleClickAt(x: number, y: number): Promise<void> {
  const { mouse, Button } = await getNutJs();
  if (!mouse) throw new Error('Mouse control not available');
  await mouse.setPosition({ x, y });
  await mouse.doubleClick(Button.LEFT);
}

/**
 * Drag from one position to another
 */
async function dragFrom(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
  const { mouse, Button } = await getNutJs();
  if (!mouse) throw new Error('Mouse control not available');
  await mouse.setPosition({ x: fromX, y: fromY });
  await mouse.pressButton(Button.LEFT);
  await mouse.setPosition({ x: toX, y: toY });
  await mouse.releaseButton(Button.LEFT);
}

/**
 * Scroll at position
 */
async function scrollAt(x: number, y: number, scrollX: number, scrollY: number): Promise<void> {
  const { mouse } = await getNutJs();
  if (!mouse) throw new Error('Mouse control not available');
  await mouse.setPosition({ x, y });
  await mouse.scroll(scrollX, scrollY);
}

// ─── Keyboard Control ──────────────────────────────────────────────────────────

// Map of string key names to nut-js Key enum values
const KEY_MAP: Record<string, string> = {
  'enter': 'Return',
  'return': 'Return',
  'escape': 'Escape',
  'esc': 'Escape',
  'tab': 'Tab',
  'space': 'Space',
  'backspace': 'Backspace',
  'delete': 'Delete',
  'up': 'Up',
  'down': 'Down',
  'left': 'Left',
  'right': 'Right',
  'home': 'Home',
  'end': 'End',
  'pageup': 'PageUp',
  'pagedown': 'PageDown',
  'f1': 'F1', 'f2': 'F2', 'f3': 'F3', 'f4': 'F4',
  'f5': 'F5', 'f6': 'F6', 'f7': 'F7', 'f8': 'F8',
  'ctrl': 'LeftControl', 'control': 'LeftControl',
  'cmd': 'LeftSuper', 'command': 'LeftSuper', 'meta': 'LeftSuper',
  'alt': 'LeftAlt', 'option': 'LeftAlt',
  'shift': 'LeftShift',
  'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D', 'e': 'E',
  'f': 'F', 'g': 'G', 'h': 'H', 'i': 'I', 'j': 'J',
  'k': 'K', 'l': 'L', 'm': 'M', 'n': 'N', 'o': 'O',
  'p': 'P', 'q': 'Q', 'r': 'R', 's': 'S', 't': 'T',
  'u': 'U', 'v': 'V', 'w': 'W', 'x': 'X', 'y': 'Y', 'z': 'Z',
};

/**
 * Type text using keyboard
 */
async function typeText(text: string): Promise<void> {
  const { keyboard } = await getNutJs();
  if (!keyboard) throw new Error('Keyboard control not available');
  await keyboard.type(text);
}

/**
 * Press a single key (with optional modifiers)
 */
async function pressKey(keyName: string, modifiers: string[] = []): Promise<void> {
  const { keyboard, Key } = await getNutJs();
  if (!keyboard) throw new Error('Keyboard control not available');

  const keyStr = KEY_MAP[keyName.toLowerCase()];
  if (!keyStr || !Key[keyStr as keyof typeof Key]) {
    throw new Error(`Unknown key: ${keyName}`);
  }

  const keysToPress = [
    ...modifiers.map(m => Key[KEY_MAP[m.toLowerCase()] as keyof typeof Key]),
    Key[keyStr as keyof typeof Key],
  ].filter(Boolean);

  if (keysToPress.length === 1) {
    await keyboard.pressKey(keysToPress[0]);
    await keyboard.releaseKey(keysToPress[0]);
  } else {
    await keyboard.pressKey(...keysToPress);
    await keyboard.releaseKey(...keysToPress);
  }
}

// ─── Main Dispatcher ───────────────────────────────────────────────────────────

/**
 * Execute a Computer Use action
 * This is called after the user approves an action in the UI
 */
export async function executeComputerAction(action: ComputerAction): Promise<void> {
  console.log('[ComputerUse] Executing action:', action.type, action);

  switch (action.type) {
    case 'screenshot':
      // Screenshot is read-only, no action needed
      break;

    case 'move':
      if (action.x === undefined || action.y === undefined) {
        throw new Error('Move action requires x and y coordinates');
      }
      await moveMouse(action.x, action.y);
      break;

    case 'click':
      if (action.x === undefined || action.y === undefined) {
        throw new Error('Click action requires x and y coordinates');
      }
      await clickAt(action.x, action.y, action.button || 'left');
      break;

    case 'doubleClick':
      if (action.x === undefined || action.y === undefined) {
        throw new Error('Double-click action requires x and y coordinates');
      }
      await doubleClickAt(action.x, action.y);
      break;

    case 'rightClick':
      if (action.x === undefined || action.y === undefined) {
        throw new Error('Right-click action requires x and y coordinates');
      }
      await clickAt(action.x, action.y, 'right');
      break;

    case 'type':
      if (!action.text) throw new Error('Type action requires text');
      await typeText(action.text);
      break;

    case 'key':
      if (!action.key) throw new Error('Key action requires key name');
      // Support "ctrl+c" style shorthand
      if (action.key.includes('+')) {
        const parts = action.key.split('+');
        const modifiers = parts.slice(0, -1);
        const key = parts[parts.length - 1];
        await pressKey(key, modifiers);
      } else {
        await pressKey(action.key, action.keys || []);
      }
      break;

    case 'scroll':
      if (action.x === undefined || action.y === undefined) {
        throw new Error('Scroll action requires x and y coordinates');
      }
      await scrollAt(action.x, action.y, action.scrollX || 0, action.scrollY || 0);
      break;

    case 'drag':
      if (action.x === undefined || action.y === undefined || action.toX === undefined || action.toY === undefined) {
        throw new Error('Drag action requires from and to coordinates');
      }
      await dragFrom(action.x, action.y, action.toX, action.toY);
      break;

    default:
      throw new Error(`Unknown action type: ${(action as any).type}`);
  }

  console.log('[ComputerUse] Action completed successfully');
}

// ─── Running Apps (macOS specific) ────────────────────────────────────────────

/**
 * Get list of running applications using AppleScript
 */
export async function getRunningApps(): Promise<{ name: string; bundleId: string; pid: number }[]> {
  try {
    const script = `
      tell application "System Events"
        set appList to {}
        repeat with proc in (processes whose background only is false)
          set appList to appList & {{name:name of proc, pid:unix id of proc}}
        end repeat
        return appList
      end tell
    `;

    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "\\'")}'`);

    // Parse AppleScript output
    const apps: { name: string; bundleId: string; pid: number }[] = [];
    const lines = stdout.trim().split(', ');

    // Simplified parsing - AppleScript output format varies
    for (let i = 0; i < lines.length; i += 2) {
      if (lines[i] && lines[i + 1]) {
        apps.push({
          name: lines[i].trim(),
          bundleId: '',
          pid: parseInt(lines[i + 1].trim()) || 0,
        });
      }
    }

    return apps;
  } catch (error) {
    console.warn('[ComputerUse] Could not get running apps:', error);
    return [];
  }
}

/**
 * Bring a specific app to focus using AppleScript
 */
export async function focusApp(appName: string): Promise<void> {
  await execAsync(`osascript -e 'tell application "${appName}" to activate'`);
}
