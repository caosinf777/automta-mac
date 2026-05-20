/**
 * useComputerUse — Hook para gestionar sesiones de Computer Use
 * Maneja el loop de: captura → envío al agente → recibir acción → aprobar/rechazar → ejecutar
 */

import { useState, useCallback, useRef } from 'react';
import { useElectron } from './useElectron';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface ComputerUseAction {
  id: string;
  type: 'click' | 'doubleClick' | 'rightClick' | 'type' | 'key' | 'scroll' | 'screenshot' | 'move' | 'drag';
  description: string;
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  scrollX?: number;
  scrollY?: number;
  toX?: number;
  toY?: number;
  button?: 'left' | 'right' | 'middle';
  // Highlight zone for the approval UI
  highlightX?: number;
  highlightY?: number;
  highlightWidth?: number;
  highlightHeight?: number;
  timestamp: number;
}

export interface ComputerUseSession {
  id: string;
  agentId: string;
  task: string;
  status: 'idle' | 'capturing' | 'thinking' | 'awaiting-approval' | 'executing' | 'completed' | 'error';
  currentScreenshot?: string;
  screenshotWidth?: number;
  screenshotHeight?: number;
  pendingAction?: ComputerUseAction;
  executedActions: ComputerUseAction[];
  error?: string;
  startedAt: number;
  tokensUsed?: number;
}

type ApprovalMode = 'manual' | 'auto';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export function useComputerUse() {
  const { isElectron, api } = useElectron();
  const [session, setSession] = useState<ComputerUseSession | null>(null);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('manual');
  const abortRef = useRef<boolean>(false);
  const sessionRef = useRef<ComputerUseSession | null>(null);

  sessionRef.current = session;

  // ── Update session helper ──────────────────────────────────────────────────
  const updateSession = useCallback((updates: Partial<ComputerUseSession>) => {
    setSession(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  // ── Start a new Computer Use session ──────────────────────────────────────
  const startSession = useCallback(async (agentId: string, task: string) => {
    if (!isElectron) {
      throw new Error('Computer Use solo está disponible en la app de Mac');
    }

    abortRef.current = false;
    const sessionId = `cu-${Date.now()}`;

    const newSession: ComputerUseSession = {
      id: sessionId,
      agentId,
      task,
      status: 'idle',
      executedActions: [],
      startedAt: Date.now(),
    };

    setSession(newSession);

    // Start the Computer Use loop
    await runComputerUseLoop(newSession);
  }, [isElectron]); // eslint-disable-line

  // ── Main Computer Use Loop ─────────────────────────────────────────────────
  const runComputerUseLoop = useCallback(async (initialSession: ComputerUseSession) => {
    let currentSession = initialSession;
    let loopCount = 0;
    const MAX_LOOPS = 50; // Safety limit

    while (!abortRef.current && loopCount < MAX_LOOPS) {
      loopCount++;

      try {
        // 1. Capture current screen state
        updateSession({ status: 'capturing' });
        const captureResult = await api!.computerUse.captureScreen();

        if (!captureResult.success || !captureResult.image) {
          throw new Error(captureResult.error || 'No se pudo capturar la pantalla');
        }

        const screenshot = captureResult.image;
        updateSession({
          currentScreenshot: screenshot,
          screenshotWidth: captureResult.width,
          screenshotHeight: captureResult.height,
        });

        // 2. Send to backend/agent for analysis
        updateSession({ status: 'thinking' });

        const response = await fetch(`${API_BASE}/computer-use/session/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.REACT_APP_API_KEY || '',
          },
          body: JSON.stringify({
            sessionId: currentSession.id,
            agentId: currentSession.agentId,
            task: currentSession.task,
            screenshot, // base64 PNG
            executedActions: currentSession.executedActions,
            loopCount,
          }),
        });

        if (!response.ok) {
          throw new Error(`Error del servidor: ${response.status}`);
        }

        const result = await response.json();

        // 3. Check if task is complete
        if (result.completed) {
          updateSession({ status: 'completed' });
          
          // Send native notification
          await api!.system.sendNotification({
            title: '✅ Tarea completada',
            body: result.summary || `AutoMTA completó: ${currentSession.task}`,
          });
          break;
        }

        // 4. Agent proposes next action
        if (!result.action) {
          // No action needed, task might be done
          updateSession({ status: 'completed' });
          break;
        }

        const proposedAction: ComputerUseAction = {
          id: `action-${Date.now()}`,
          ...result.action,
          description: result.actionDescription || getActionDescription(result.action),
          timestamp: Date.now(),
        };

        // 5. Show action for approval (or auto-approve if in auto mode)
        updateSession({
          status: 'awaiting-approval',
          pendingAction: proposedAction,
        });

        if (approvalMode === 'auto') {
          // Auto-approve: execute immediately
          await executeAction(proposedAction);
        } else {
          // Manual: wait for user approval via approveAction() or rejectAction()
          await waitForApproval(proposedAction.id);
        }

        currentSession = sessionRef.current!;

        // Small delay between actions for stability
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        if (abortRef.current) break; // Intentional stop
        console.error('[ComputerUse] Loop error:', error);
        updateSession({ status: 'error', error: error.message });
        break;
      }
    }

    if (loopCount >= MAX_LOOPS) {
      updateSession({ status: 'error', error: 'Se alcanzó el límite máximo de acciones' });
    }
  }, [api, approvalMode, updateSession]); // eslint-disable-line

  // ── Execute an approved action ─────────────────────────────────────────────
  const executeAction = useCallback(async (action: ComputerUseAction) => {
    updateSession({ status: 'executing' });

    const result = await api!.computerUse.executeAction({
      type: action.type as any,
      x: action.x,
      y: action.y,
      text: action.text,
      key: action.key,
      scrollX: action.scrollX,
      scrollY: action.scrollY,
      toX: action.toX,
      toY: action.toY,
      button: action.button,
    });

    if (!result.success) {
      throw new Error(result.error || 'Error al ejecutar la acción');
    }

    // Add to executed actions log
    setSession(prev => prev ? {
      ...prev,
      executedActions: [...prev.executedActions, action],
      pendingAction: undefined,
    } : null);
  }, [api, updateSession]);

  // ── Approval control ───────────────────────────────────────────────────────
  const approveQueue = useRef<Map<string, () => void>>(new Map());

  const waitForApproval = useCallback((actionId: string): Promise<void> => {
    return new Promise((resolve) => {
      approveQueue.current.set(actionId, resolve);
    });
  }, []);

  const approveAction = useCallback(async () => {
    const pending = sessionRef.current?.pendingAction;
    if (!pending) return;

    try {
      await executeAction(pending);
      const resolver = approveQueue.current.get(pending.id);
      if (resolver) {
        approveQueue.current.delete(pending.id);
        resolver();
      }
    } catch (error: any) {
      updateSession({ status: 'error', error: error.message });
    }
  }, [executeAction, updateSession]);

  const rejectAction = useCallback(() => {
    const pending = sessionRef.current?.pendingAction;
    if (!pending) return;

    // Remove from queue and continue loop (agent will try something different)
    const resolver = approveQueue.current.get(pending.id);
    if (resolver) {
      approveQueue.current.delete(pending.id);
      // Update session to skip this action
      setSession(prev => prev ? {
        ...prev,
        pendingAction: undefined,
        executedActions: [...prev.executedActions, { ...pending, description: `[RECHAZADA] ${pending.description}` }],
      } : null);
      resolver(); // Resume loop
    }
  }, []);

  // ── Stop the session ───────────────────────────────────────────────────────
  const stopSession = useCallback(() => {
    abortRef.current = true;
    approveQueue.current.clear();
    updateSession({ status: 'idle', pendingAction: undefined });
  }, [updateSession]);

  return {
    session,
    approvalMode,
    setApprovalMode,
    startSession,
    approveAction,
    rejectAction,
    stopSession,
    isRunning: session?.status !== 'idle' && session?.status !== 'completed' && session?.status !== 'error',
  };
}

// ─── Helper ────────────────────────────────────────────────────────────────────
function getActionDescription(action: any): string {
  switch (action.type) {
    case 'click': return `Click en (${action.x}, ${action.y})`;
    case 'doubleClick': return `Doble click en (${action.x}, ${action.y})`;
    case 'rightClick': return `Click derecho en (${action.x}, ${action.y})`;
    case 'type': return `Escribir: "${action.text}"`;
    case 'key': return `Presionar tecla: ${action.key}`;
    case 'scroll': return `Scroll en (${action.x}, ${action.y})`;
    case 'move': return `Mover mouse a (${action.x}, ${action.y})`;
    case 'drag': return `Arrastrar de (${action.x}, ${action.y}) a (${action.toX}, ${action.toY})`;
    case 'screenshot': return 'Capturar pantalla';
    default: return `Acción: ${action.type}`;
  }
}
