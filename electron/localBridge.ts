/**
 * AutoMTA Mac — Local Bridge Service
 * El puente entre los recursos del Mac y el agente en la nube.
 * 
 * Cuando el agente necesita leer un archivo, ver el calendario, acceder
 * al correo o cualquier recurso local → pasa por aquí.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { clipboard, shell, app } from 'electron';
import { execAsync } from './utils';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface LocalFile {
  name: string;
  path: string;
  size: number;
  type: string;
  modifiedAt: string;
  content?: string;
}

export interface CalendarEvent {
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
  notes?: string;
  calendar: string;
}

export interface MailMessage {
  subject: string;
  from: string;
  to: string;
  date: string;
  preview: string;
  isRead: boolean;
}

export interface RunningApp {
  name: string;
  bundleId: string;
  pid: number;
}

export interface LocalSystemStatus {
  platform: string;
  macosVersion: string;
  hostname: string;
  username: string;
  homeDir: string;
  cpuUsage: number;
  memoryTotal: number;
  memoryFree: number;
  diskTotal: number;
  diskFree: number;
  activeApps: RunningApp[];
}

// ─── FILE SYSTEM ───────────────────────────────────────────────────────────────

/**
 * List files in a directory (safe, respects home dir boundary)
 */
export async function listFiles(dirPath: string, options?: {
  recursive?: boolean;
  extensions?: string[];
  maxFiles?: number;
}): Promise<LocalFile[]> {
  const safePath = resolveSafePath(dirPath);
  if (!safePath) throw new Error('Ruta no permitida');

  const maxFiles = options?.maxFiles || 100;
  const files: LocalFile[] = [];

  function scanDir(dir: string, depth = 0) {
    if (files.length >= maxFiles) return;
    if (depth > (options?.recursive ? 3 : 0)) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= maxFiles) break;
        if (entry.name.startsWith('.')) continue; // Skip hidden files

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && options?.recursive) {
          scanDir(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();

          if (options?.extensions && !options.extensions.includes(ext)) continue;

          try {
            const stat = fs.statSync(fullPath);
            files.push({
              name: entry.name,
              path: fullPath,
              size: stat.size,
              type: ext || 'file',
              modifiedAt: stat.mtime.toISOString(),
            });
          } catch { /* skip inaccessible files */ }
        }
      }
    } catch { /* skip inaccessible dirs */ }
  }

  scanDir(safePath);
  return files;
}

/**
 * Read a file's content (text files up to 1MB)
 */
export async function readFile(filePath: string): Promise<string> {
  const safePath = resolveSafePath(filePath);
  if (!safePath) throw new Error('Acceso denegado');

  const stat = fs.statSync(safePath);
  if (stat.size > 1_000_000) throw new Error('Archivo demasiado grande (max 1MB)');

  const ext = path.extname(safePath).toLowerCase();
  const textExtensions = ['.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml',
    '.js', '.ts', '.tsx', '.jsx', '.py', '.sh', '.html', '.css', '.sql'];

  if (!textExtensions.includes(ext)) {
    throw new Error(`Tipo de archivo no soportado para lectura: ${ext}`);
  }

  return fs.readFileSync(safePath, 'utf-8');
}

/**
 * Write content to a file (with user confirmation expected at UI level)
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  const safePath = resolveSafePath(filePath);
  if (!safePath) throw new Error('Acceso denegado');

  fs.mkdirSync(path.dirname(safePath), { recursive: true });
  fs.writeFileSync(safePath, content, 'utf-8');
}

/**
 * Open a file in its default app
 */
export async function openFile(filePath: string): Promise<void> {
  const safePath = resolveSafePath(filePath);
  if (!safePath) throw new Error('Acceso denegado');

  await shell.openPath(safePath);
}

/**
 * Search files by content
 */
export async function searchFiles(query: string, dirPath?: string): Promise<LocalFile[]> {
  const searchDir = dirPath ? resolveSafePath(dirPath) : os.homedir();
  if (!searchDir) return [];

  try {
    // Use macOS spotlight for fast file search
    const { stdout } = await execAsync(
      `mdfind -onlyin "${searchDir}" "${query}" | head -20`
    );
    const filePaths = stdout.trim().split('\n').filter(Boolean);

    return filePaths.map(fp => {
      try {
        const stat = fs.statSync(fp);
        return {
          name: path.basename(fp),
          path: fp,
          size: stat.size,
          type: path.extname(fp) || 'file',
          modifiedAt: stat.mtime.toISOString(),
        };
      } catch {
        return null;
      }
    }).filter((f): f is LocalFile => f !== null);
  } catch {
    return [];
  }
}

// ─── CLIPBOARD ─────────────────────────────────────────────────────────────────

export function getClipboard(): string {
  return clipboard.readText();
}

export function setClipboard(text: string): void {
  clipboard.writeText(text);
}

// ─── CALENDAR (via AppleScript) ───────────────────────────────────────────────

export async function getCalendarEvents(days = 7): Promise<CalendarEvent[]> {
  const script = `
    set startDate to current date
    set endDate to startDate + (${days} * days)
    
    set eventList to {}
    tell application "Calendar"
      set allCalendars to every calendar
      repeat with cal in allCalendars
        set events to (every event of cal whose start date ≥ startDate and start date ≤ endDate)
        repeat with evt in events
          set evtData to {summary of evt, start date of evt as string, end date of evt as string, name of cal}
          copy evtData to end of eventList
        end repeat
      end repeat
    end tell
    return eventList
  `;

  try {
    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "\\'")}'`);
    const items = stdout.trim().split(', ');
    const events: CalendarEvent[] = [];

    // Parse 4-item groups: title, start, end, calendar
    for (let i = 0; i + 3 < items.length; i += 4) {
      events.push({
        title: items[i]?.trim() || '',
        startDate: items[i + 1]?.trim() || '',
        endDate: items[i + 2]?.trim() || '',
        calendar: items[i + 3]?.trim() || '',
      });
    }

    return events;
  } catch {
    return [];
  }
}

export async function createCalendarEvent(event: Omit<CalendarEvent, 'calendar'>): Promise<boolean> {
  const script = `
    tell application "Calendar"
      tell calendar 1
        make new event with properties {summary:"${event.title}", start date:date "${event.startDate}", end date:date "${event.endDate}"}
      end tell
    end tell
  `;
  try {
    await execAsync(`osascript -e '${script}'`);
    return true;
  } catch {
    return false;
  }
}

// ─── MAIL (via AppleScript) ───────────────────────────────────────────────────

export async function getUnreadMails(maxCount = 10): Promise<MailMessage[]> {
  const script = `
    tell application "Mail"
      set unreadMessages to (messages of inbox whose read status is false)
      set msgList to {}
      set msgCount to count of unreadMessages
      if msgCount > ${maxCount} then set msgCount to ${maxCount}
      repeat with i from 1 to msgCount
        set msg to item i of unreadMessages
        set msgData to {subject of msg, sender of msg, date received of msg as string}
        copy msgData to end of msgList
      end repeat
      return msgList
    end tell
  `;

  try {
    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "\\'")}'`);
    const items = stdout.trim().split(', ');
    const mails: MailMessage[] = [];

    for (let i = 0; i + 2 < items.length; i += 3) {
      mails.push({
        subject: items[i]?.trim() || '(sin asunto)',
        from: items[i + 1]?.trim() || '',
        to: '',
        date: items[i + 2]?.trim() || '',
        preview: '',
        isRead: false,
      });
    }

    return mails;
  } catch {
    return [];
  }
}

// ─── RUNNING APPS ─────────────────────────────────────────────────────────────

export async function getRunningApps(): Promise<RunningApp[]> {
  const script = `
    tell application "System Events"
      set appList to {}
      repeat with proc in application processes
        if background only of proc is false then
          set appList to appList & {name of proc}
        end if
      end repeat
      return appList
    end tell
  `;

  try {
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    return stdout.trim().split(', ')
      .filter(Boolean)
      .map((name, i) => ({
        name: name.trim(),
        bundleId: '',
        pid: i, // AppleScript doesn't easily return PIDs this way
      }));
  } catch {
    return [];
  }
}

// ─── SYSTEM STATUS ─────────────────────────────────────────────────────────────

export async function getSystemStatus(): Promise<LocalSystemStatus> {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  let diskTotal = 0;
  let diskFree = 0;
  try {
    const { stdout } = await execAsync("df -k / | tail -1 | awk '{print $2, $4}'");
    const [total, free] = stdout.trim().split(' ').map(Number);
    diskTotal = total * 1024;
    diskFree = free * 1024;
  } catch { /* ignore */ }

  const activeApps = await getRunningApps();

  return {
    platform: 'macOS',
    macosVersion: os.release(),
    hostname: os.hostname(),
    username: os.userInfo().username,
    homeDir: os.homedir(),
    cpuUsage: 0, // Would need native addon for real CPU usage
    memoryTotal: totalMem,
    memoryFree: freeMem,
    diskTotal,
    diskFree,
    activeApps: activeApps.slice(0, 10),
  };
}

// ─── AGENT TOOL EXECUTOR ─────────────────────────────────────────────────────
/**
 * Execute a local tool request from the cloud agent
 * The backend sends a tool call, we execute it locally and return results
 */
export async function executeLocalTool(toolName: string, params: Record<string, any>): Promise<any> {
  switch (toolName) {
    case 'read_file':
      return { content: await readFile(params.path) };

    case 'write_file':
      await writeFile(params.path, params.content);
      return { success: true };

    case 'list_files':
      return { files: await listFiles(params.path, params) };

    case 'search_files':
      return { files: await searchFiles(params.query, params.dir) };

    case 'open_file':
      await openFile(params.path);
      return { success: true };

    case 'get_clipboard':
      return { content: getClipboard() };

    case 'set_clipboard':
      setClipboard(params.text);
      return { success: true };

    case 'get_calendar_events':
      return { events: await getCalendarEvents(params.days || 7) };

    case 'create_calendar_event':
      return { success: await createCalendarEvent({
        title: params.title as string,
        startDate: params.startDate as string,
        endDate: params.endDate as string,
        location: params.location as string | undefined,
        notes: params.notes as string | undefined,
      }) };

    case 'get_unread_mails':
      return { mails: await getUnreadMails(params.count || 10) };

    case 'get_running_apps':
      return { apps: await getRunningApps() };

    case 'get_system_status':
      return await getSystemStatus();

    case 'open_url':
      await shell.openExternal(params.url);
      return { success: true };

    default:
      throw new Error(`Herramienta local desconocida: ${toolName}`);
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Resolve a path safely, ensuring it stays within allowed directories
 */
function resolveSafePath(inputPath: string): string | null {
  const home = os.homedir();
  const allowedRoots = [
    home,
    '/tmp',
    app.getPath('downloads'),
    app.getPath('documents'),
    app.getPath('desktop'),
  ];

  const resolved = path.resolve(inputPath.replace('~', home));

  const isAllowed = allowedRoots.some(root => resolved.startsWith(root));
  if (!isAllowed) return null;

  return resolved;
}
