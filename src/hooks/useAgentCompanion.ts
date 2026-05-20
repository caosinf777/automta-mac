/**
 * useAgentCompanion — Hook para el asistente nativo de Mac
 * 
 * Maneja el ciclo completo:
 * 1. Usuario envía mensaje
 * 2. Backend (agente) responde o pide un tool_call local
 * 3. Si es tool_call local → ejecuta en el Mac via Electron
 * 4. Devuelve resultado al backend → respuesta final
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useElectron } from './useElectron';
import { executeLocalTool, LocalToolCall } from '../services/localBridgeClient';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface CompanionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCall?: LocalToolCall;
  toolResult?: any;
}

export interface AgentCapabilities {
  hasKnowledgeBase: boolean;
  hasMemory: boolean;
  toolCount: number;
  tools: { name: string; enabled: boolean }[];
  localTools: string[];
}

export interface CompanionAgent {
  id: string;
  name: string;
  emoji?: string;
  avatarUrl?: string;
  description?: string;
  isMaster?: boolean;
  capabilities?: AgentCapabilities;
}

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY  = process.env.REACT_APP_API_KEY  || '';

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useAgentCompanion() {
  const { isElectron } = useElectron();
  const [macAgents, setMacAgents] = useState<CompanionAgent[]>([]);
  const [activeAgent, setActiveAgent] = useState<CompanionAgent | null>(null);
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionId = useRef<string>(`session-${Date.now()}`);

  // ── Load Mac companion agents ────────────────────────────────────────────────
  useEffect(() => {
    loadMacAgents();
  }, []);

  const loadMacAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/companion/agents/mac`, {
        headers: { 'x-api-key': API_KEY },
      });
      if (!res.ok) throw new Error('Error cargando agentes');
      const data = await res.json();
      const agents: CompanionAgent[] = data.agents || [];
      setMacAgents(agents);
      if (agents.length > 0) {
        setActiveAgent(agents[0]);
        // Load agent capabilities
        loadAgentCapabilities(agents[0].id);
      }
    } catch (err) {
      console.error('[useAgentCompanion] Failed to load agents:', err);
    }
  }, []);

  // ── Load agent capabilities from backend ─────────────────────────────────────
  const loadAgentCapabilities = useCallback(async (agentId: string) => {
    try {
      const res = await fetch(`${API_BASE}/companion/status?agentId=${agentId}`, {
        headers: { 'x-api-key': API_KEY },
      });
      if (!res.ok) return;
      const data = await res.json();

      setActiveAgent(prev => prev ? {
        ...prev,
        capabilities: data.capabilities,
      } : null);

      setMacAgents(prev => prev.map(a => a.id === agentId ? {
        ...a,
        capabilities: data.capabilities,
      } : a));
    } catch { /* silently fail */ }
  }, []);

  // ── Switch active agent ───────────────────────────────────────────────────────
  const switchAgent = useCallback((agent: CompanionAgent) => {
    setActiveAgent(agent);
    setMessages([]);
    setError(null);
    sessionId.current = `session-${Date.now()}`;
    loadAgentCapabilities(agent.id);
  }, [loadAgentCapabilities]);

  // ── Toggle agent as Mac companion ─────────────────────────────────────────────
  const toggleMacCompanion = useCallback(async (agentId: string, enabled: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/companion/agents/${agentId}/mac`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        setMacAgents(prev => prev.map(a => a.id === agentId ? { ...a, isMacCompanion: enabled } : a));
      }
    } catch (err) {
      console.error('[useAgentCompanion] Toggle error:', err);
    }
  }, []);

  // ── Send message (with local tool loop) ───────────────────────────────────────
  const sendMessage = useCallback(async (
    userText: string,
    macContext?: string,
  ) => {
    if (!userText.trim() || !activeAgent) return;

    const userMsg: CompanionMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: userText.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setError(null);
    setIsLoading(true);

    try {
      await runAgentLoop(
        activeAgent.id,
        userText.trim(),
        macContext,
        messages,
        null,
      );
    } catch (err: any) {
      setError(err.message);
      addMessage('assistant', `Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [activeAgent, messages]); // eslint-disable-line

  // ── Core agent loop: handles tool_use back-and-forth ─────────────────────────
  const runAgentLoop = useCallback(async (
    agentId: string,
    message: string,
    macContext: string | undefined,
    history: CompanionMessage[],
    localToolResult: any,
    depth = 0,
  ): Promise<void> => {
    if (depth > 5) throw new Error('Demasiadas llamadas recursivas de herramientas');

    const res = await fetch(`${API_BASE}/companion/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        agentId,
        message,
        context: macContext,
        conversationHistory: history.slice(-8).map(m => ({
          role: m.role === 'system' ? 'user' : m.role,
          content: m.content,
        })),
        localToolResult,
        sessionId: sessionId.current,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Error del servidor: ${res.status}`);
    }

    const data = await res.json();

    // ── Agent needs a local Mac tool ──────────────────────────────────────────
    if (data.needsLocalTool && data.toolCall) {
      const { name, params } = data.toolCall;

      // Show partial response if any
      if (data.partialResponse) {
        addMessage('assistant', data.partialResponse);
      }

      // Show a system message so user knows what's happening
      addMessage('system', `🔧 Accediendo a: ${getToolLabel(name)}...`);

      // Execute the tool locally via Electron
      let toolResult: any;
      if (isElectron) {
        toolResult = await executeLocalTool(name, params);
      } else {
        toolResult = { error: 'No disponible fuera de la app de Mac' };
      }

      // Loop back with tool result
      await runAgentLoop(agentId, message, macContext, history, {
        toolName: name,
        result: toolResult,
      }, depth + 1);

      return;
    }

    // ── Final text response ───────────────────────────────────────────────────
    if (data.response) {
      addMessage('assistant', data.response);
    }
  }, [isElectron]); // eslint-disable-line

  const addMessage = useCallback((role: CompanionMessage['role'], content: string, extra?: Partial<CompanionMessage>) => {
    setMessages(prev => [...prev, {
      id: `${role}-${Date.now()}`,
      role,
      content,
      timestamp: Date.now(),
      ...extra,
    }]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    sessionId.current = `session-${Date.now()}`;
  }, []);

  return {
    macAgents,
    activeAgent,
    messages,
    isLoading,
    error,
    switchAgent,
    sendMessage,
    toggleMacCompanion,
    clearMessages,
    loadMacAgents,
  };
}

// ─── Label helper ──────────────────────────────────────────────────────────────
function getToolLabel(toolName: string): string {
  const labels: Record<string, string> = {
    read_file: 'Leyendo archivo',
    write_file: 'Escribiendo archivo',
    list_files: 'Listando archivos',
    search_files: 'Buscando archivos (Spotlight)',
    get_clipboard: 'Portapapeles',
    set_clipboard: 'Copiando al portapapeles',
    get_calendar_events: 'Calendar',
    create_calendar_event: 'Creando evento en Calendar',
    get_unread_mails: 'Mail (correos no leídos)',
    get_running_apps: 'Apps abiertas',
    open_url: 'Abriendo en browser',
    open_file: 'Abriendo archivo',
    get_system_status: 'Estado del sistema',
  };
  return labels[toolName] || toolName;
}
