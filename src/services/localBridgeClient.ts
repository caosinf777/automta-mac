/**
 * localBridgeClient — Cliente del bridge local para el renderer (React)
 * Llama a los IPC handlers del proceso main para ejecutar tools locales
 */

export interface LocalToolCall {
  name: string;
  params: Record<string, any>;
}

/**
 * Execute a local Mac tool via Electron IPC
 * The main process has access to all Node.js APIs and Mac system
 */
export async function executeLocalTool(toolName: string, params: Record<string, any>): Promise<any> {
  if (!window.electronAPI) {
    throw new Error('No disponible fuera de la app de Mac');
  }

  try {
    const result = await (window as any).electronAPI.localBridge.executeTool(toolName, params);
    return result;
  } catch (err: any) {
    console.error(`[localBridgeClient] Tool "${toolName}" failed:`, err);
    return { error: err.message || 'Error ejecutando herramienta local' };
  }
}
