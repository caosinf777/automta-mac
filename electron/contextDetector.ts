/**
 * AutoMTA Mac — Context Detector
 * Detecta qué está haciendo el usuario en su Mac para dar contexto al agente
 * Usa AppleScript para obtener la app activa, URL del browser y texto seleccionado
 */

import { execAsync } from './utils';
import { clipboard } from 'electron';

export interface MacContext {
  activeApp: string;
  activeAppBundleId: string;
  browserUrl?: string;
  browserTitle?: string;
  selectedText?: string;
  windowTitle?: string;
  timestamp: number;
}

/**
 * Get the currently active application
 */
async function getActiveApp(): Promise<{ name: string; bundleId: string; windowTitle: string }> {
  try {
    const script = `
      tell application "System Events"
        set frontApp to first application process whose frontmost is true
        set appName to name of frontApp
        set bundleId to bundle identifier of frontApp
        set winTitle to ""
        try
          set winTitle to name of front window of frontApp
        end try
        return appName & "|||" & bundleId & "|||" & winTitle
      end tell
    `;
    const { execAsync: exec } = await import('./utils');
    const { stdout } = await exec(`osascript -e '${script.replace(/'/g, "\\'")}'`);
    const parts = stdout.trim().split('|||');
    return {
      name: parts[0] || 'Unknown',
      bundleId: parts[1] || '',
      windowTitle: parts[2] || '',
    };
  } catch {
    return { name: 'Unknown', bundleId: '', windowTitle: '' };
  }
}

/**
 * Get the URL from the active browser (Safari, Chrome, Firefox, Arc)
 */
async function getBrowserUrl(appName: string): Promise<{ url: string; title: string } | null> {
  const browserScripts: Record<string, string> = {
    Safari: `tell application "Safari" to return {URL of current tab of front window, name of current tab of front window}`,
    'Google Chrome': `tell application "Google Chrome" to return {URL of active tab of front window, title of active tab of front window}`,
    'Brave Browser': `tell application "Brave Browser" to return {URL of active tab of front window, title of active tab of front window}`,
    Arc: `tell application "Arc" to return {URL of active tab of front window, title of active tab of front window}`,
    Firefox: `tell application "Firefox" to return URL of current tab of front window`,
  };

  const script = browserScripts[appName];
  if (!script) return null;

  try {
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const parts = stdout.trim().split(', ');
    return {
      url: parts[0]?.replace(/^"/, '').replace(/"$/, '') || '',
      title: parts[1]?.replace(/^"/, '').replace(/"$/, '') || '',
    };
  } catch {
    return null;
  }
}

/**
 * Get currently selected text (reads clipboard after simulating Cmd+C)
 * Only does this if user has granted accessibility permission
 */
async function getSelectedText(): Promise<string | undefined> {
  try {
    // Save current clipboard
    const previousClipboard = clipboard.readText();

    // Simulate Cmd+C to copy selection
    // Note: This requires accessibility permission
    const script = `
      tell application "System Events"
        keystroke "c" using {command down}
      end tell
    `;
    await execAsync(`osascript -e '${script}'`);

    // Small delay for clipboard to update
    await new Promise(resolve => setTimeout(resolve, 150));

    const selectedText = clipboard.readText();

    // Restore previous clipboard
    clipboard.writeText(previousClipboard);

    // Only return if something was actually selected (different from before)
    if (selectedText && selectedText !== previousClipboard && selectedText.length < 5000) {
      return selectedText;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get the full context of what the user is currently doing
 * Called before sending a message to the agent to enrich the prompt
 */
export async function getCurrentContext(): Promise<MacContext> {
  const { name, bundleId, windowTitle } = await getActiveApp();

  const context: MacContext = {
    activeApp: name,
    activeAppBundleId: bundleId,
    windowTitle,
    timestamp: Date.now(),
  };

  // Get browser URL if in a browser
  const browserApps = ['Safari', 'Google Chrome', 'Chrome', 'Brave Browser', 'Arc', 'Firefox'];
  if (browserApps.includes(name)) {
    const browserInfo = await getBrowserUrl(name);
    if (browserInfo) {
      context.browserUrl = browserInfo.url;
      context.browserTitle = browserInfo.title;
    }
  }

  return context;
}

/**
 * Format context into a human-readable string for the agent prompt
 */
export function formatContextForAgent(ctx: MacContext): string {
  const parts: string[] = [];

  if (ctx.activeApp && ctx.activeApp !== 'Unknown') {
    parts.push(`App activa: ${ctx.activeApp}`);
  }

  if (ctx.windowTitle) {
    parts.push(`Ventana: "${ctx.windowTitle}"`);
  }

  if (ctx.browserUrl) {
    parts.push(`URL: ${ctx.browserUrl}`);
    if (ctx.browserTitle) {
      parts.push(`Título: ${ctx.browserTitle}`);
    }
  }

  if (ctx.selectedText) {
    parts.push(`Texto seleccionado:\n"${ctx.selectedText.substring(0, 500)}${ctx.selectedText.length > 500 ? '...' : ''}"`);
  }

  if (parts.length === 0) return '';

  return `[Contexto del Mac del usuario]\n${parts.join('\n')}`;
}
