/**
 * CompanionMiniApp — Panel principal del Menu Bar de AutoMTA para Mac
 * 
 * Incluye:
 * - Branding AutoMTA prominente
 * - Skills activas del agente (terminología de la plataforma)
 * - Chat con el agente
 * - Wake word "Hey [nombre del agente]" tipo Siri
 * - Selector de agentes disponibles en Mac
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Maximize2, Monitor, ChevronDown, Zap, Loader,
  Plus, CheckCircle, Settings, Mic, X, Volume2,
} from 'lucide-react';
import { useAgentCompanion } from '../../hooks/useAgentCompanion';
import { useVoiceActivation } from '../../hooks/useVoiceActivation';
import { SkillBadge } from './SkillsPanel';
import VoiceActivationIndicator, { VoiceMicButton } from '../../components/mac/VoiceActivationIndicator';

// ─── AutoMTA Logo ───────────────────────────────────────────────────────────────
const AutoMTALogo: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => (
  <div className={`flex items-center gap-${size === 'sm' ? '1.5' : '2'}`}>
    <div className={`${size === 'sm' ? 'w-5 h-5' : 'w-6 h-6'} rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/40`}>
      <Zap className={`${size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-white`} />
    </div>
    <span className={`font-bold text-white ${size === 'sm' ? 'text-sm' : 'text-base'} tracking-tight`}>
      AutoMTA
    </span>
  </div>
);

// ─── Agent Avatar ───────────────────────────────────────────────────────────────
const AgentAvatar: React.FC<{ name: string; emoji?: string; avatarUrl?: string; size?: 'sm' | 'md' }> = ({
  name, emoji, avatarUrl, size = 'md',
}) => {
  const s = size === 'sm' ? 'w-7 h-7 text-sm' : 'w-9 h-9 text-base';
  return (
    <div className={`${s} rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shrink-0 shadow-lg shadow-purple-900/30 font-medium text-white`}>
      {avatarUrl
        ? <img src={avatarUrl} alt={name} className="w-full h-full rounded-xl object-cover" />
        : (emoji || name.charAt(0).toUpperCase())}
    </div>
  );
};

// ─── Message Bubble ─────────────────────────────────────────────────────────────
const MessageBubble: React.FC<{
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentEmoji?: string;
}> = ({ role, content, agentEmoji }) => {
  if (role === 'system') {
    return (
      <div className="flex items-center gap-2 text-[10px] text-slate-600 justify-center">
        <div className="h-px bg-slate-800 flex-1" />
        <span>{content}</span>
        <div className="h-px bg-slate-800 flex-1" />
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2 ${role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {role === 'assistant' && (
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shrink-0 text-xs mt-auto">
          {agentEmoji || '🤖'}
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
          role === 'user'
            ? 'bg-purple-600 text-white rounded-tr-sm'
            : 'text-slate-200 rounded-tl-sm'
        }`}
        style={role === 'assistant' ? {
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.06)',
        } : {}}
      >
        {content}
      </div>
    </motion.div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────
const CompanionMiniApp: React.FC = () => {
  const {
    macAgents,
    activeAgent,
    messages,
    isLoading,
    switchAgent,
    sendMessage,
  } = useAgentCompanion();

  const [input, setInput] = useState('');
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Voice Activation (Hey [AgentName]) ───────────────────────────────────────
  const {
    state: voiceState,
    transcript: voiceTranscript,
    volume,
    isSupported: voiceSupported,
    startListening,
    stopListening,
    markResponded,
  } = useVoiceActivation({
    agentName: activeAgent?.name || 'Jarvis',
    language: 'es-MX',
    wakeWords: ['hey', 'oye', 'ey', 'ok', 'hola'],
    onCommand: async (text) => {
      // Send voice command to agent
      await sendMessage(text);
      setTimeout(markResponded, 500);
    },
    onActivated: () => {
      // Flash the panel when wake word detected
      window.electronAPI?.system?.sendNotification?.({
        title: activeAgent?.name || 'AutoMTA',
        body: 'Te escucho...',
        silent: true,
      });
    },
  });

  const toggleVoice = useCallback(() => {
    if (voiceState === 'idle') {
      setVoiceEnabled(true);
      startListening();
    } else {
      setVoiceEnabled(false);
      stopListening();
    }
  }, [voiceState, startListening, stopListening]);

  // Auto-focus & auto-scroll
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Re-enable listening after agent responds (if voice was on)
  useEffect(() => {
    if (voiceEnabled && voiceState === 'idle') {
      startListening();
    }
  }, [messages.length]); // eslint-disable-line

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput('');
    await sendMessage(text);
  }, [input, isLoading, sendMessage]);

  const openFullApp = () => {
    (window as any).electronAPI?.window?.maximize?.();
  };

  // ── Quick suggestion chips ───────────────────────────────────────────────────
  const suggestions = [
    `Revisa mi Base de Conocimiento`,
    `¿Qué tengo en Calendar hoy?`,
    `Resume mis correos no leídos`,
    `Abre Safari y busca...`,
  ];

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden rounded-2xl select-none"
      style={{ background: 'rgba(10, 8, 20, 0.96)', backdropFilter: 'blur(40px) saturate(180%)' }}
    >
      {/* ── HEADER ── */}
      <div
        className="px-4 pt-4 pb-3 border-b shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        {/* AutoMTA branding + window controls */}
        <div className="flex items-center justify-between mb-3">
          <AutoMTALogo />
          <div className="flex items-center gap-1">
            {/* Voice toggle */}
            {voiceSupported && (
              <VoiceMicButton
                state={voiceState}
                volume={volume}
                onToggle={toggleVoice}
                agentName={activeAgent?.name || 'tu agente'}
              />
            )}
            <button
              onClick={openFullApp}
              title="Abrir AutoMTA completo"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Active Agent */}
        <button
          onClick={() => setShowAgentPicker(!showAgentPicker)}
          className="w-full flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          {activeAgent ? (
            <>
              <AgentAvatar name={activeAgent.name} emoji={activeAgent.emoji} size="sm" />
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-white text-sm font-semibold leading-none truncate">
                    {activeAgent.name}
                  </p>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                </div>
                <p className="text-slate-500 text-[10px] mt-0.5">
                  {voiceState === 'listening'
                    ? `🎙️ Escuchando "Hey ${activeAgent.name}"...`
                    : voiceState === 'activated'
                      ? '🔴 Grabando comando...'
                      : 'En tu Mac · AutoMTA'}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-slate-500">
              <div className="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center">
                <Loader className="w-3.5 h-3.5 animate-spin" />
              </div>
              <span className="text-sm">Cargando agente...</span>
            </div>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-600 ml-auto transition-transform shrink-0 ${showAgentPicker ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* ── AGENT PICKER ── */}
      <AnimatePresence>
        {showAgentPicker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b shrink-0"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <div className="p-3 space-y-1">
              <p className="text-[10px] text-slate-600 px-2 mb-2 uppercase tracking-wider">
                Agentes en tu Mac
              </p>
              {macAgents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => { switchAgent(agent); setShowAgentPicker(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left"
                  style={{
                    background: activeAgent?.id === agent.id
                      ? 'rgba(124, 58, 237, 0.12)'
                      : 'rgba(255,255,255,0)',
                    border: activeAgent?.id === agent.id
                      ? '1px solid rgba(124, 58, 237, 0.2)'
                      : '1px solid transparent',
                  }}
                >
                  <AgentAvatar name={agent.name} emoji={agent.emoji} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{agent.name}</p>
                    {agent.description && (
                      <p className="text-xs text-slate-500 truncate">{agent.description}</p>
                    )}
                  </div>
                  {activeAgent?.id === agent.id && (
                    <CheckCircle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  )}
                </button>
              ))}
              <button
                onClick={() => { setShowAgentPicker(false); openFullApp(); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-slate-500 hover:text-slate-300 hover:bg-white/3 transition-all"
              >
                <div className="w-7 h-7 rounded-xl border border-dashed border-slate-700 flex items-center justify-center shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs">Traer otro agente a Mac...</p>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SKILLS BADGES ── */}
      {activeAgent?.capabilities && (
        <div
          className="px-4 py-2.5 border-b shrink-0 overflow-hidden"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1.5">Skills Activas</p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {activeAgent.capabilities.hasKnowledgeBase && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-blue-400 shrink-0"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)' }}>
                📚 Base de Conocimiento
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-purple-400 shrink-0"
              style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.15)' }}>
              🖥️ Computer Use
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-amber-400 shrink-0"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.15)' }}>
              📂 Archivos Mac
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-red-400 shrink-0"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.15)' }}>
              📅 Calendar
            </span>
            {activeAgent.capabilities.tools.slice(0, 2).map(t => (
              <span key={t.name} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-slate-400 shrink-0"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                ⚡ {t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── MESSAGES ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-4">
            {activeAgent && (
              <AgentAvatar name={activeAgent.name} emoji={activeAgent.emoji} />
            )}
            <p className="text-white font-semibold mt-3 text-sm">
              {activeAgent?.name || 'Tu agente'}
            </p>
            <p className="text-slate-600 text-[11px] max-w-[200px] mt-1 leading-relaxed">
              {voiceSupported
                ? `Di "Hey ${activeAgent?.name || 'agente'}" o escribe para empezar`
                : 'Tu asistente nativo en Mac'}
            </p>

            {/* Quick suggestions */}
            <div className="mt-4 w-full space-y-1.5">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="w-full text-left px-3 py-2 rounded-xl text-[11px] text-slate-400 hover:text-slate-200 transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            agentEmoji={activeAgent?.emoji}
          />
        ))}

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-xs">
              {activeAgent?.emoji || '🤖'}
            </div>
            <div className="flex items-center gap-1 px-3 py-2 rounded-2xl rounded-tl-sm"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {[0, 150, 300].map(delay => (
                <span key={delay} className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${delay}ms` }} />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── INPUT ── */}
      <div
        className="px-3 pb-3 pt-2.5 border-t shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        {/* Voice transcript preview */}
        <AnimatePresence>
          {voiceState === 'activated' && voiceTranscript && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2 px-3 py-1.5 rounded-xl text-xs text-purple-300 flex items-center gap-2"
              style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}
            >
              <Mic className="w-3 h-3 shrink-0 animate-pulse" />
              <span className="italic truncate">"{voiceTranscript}"</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              if (e.key === 'Escape') (window as any).electronAPI?.window?.hide?.();
            }}
            placeholder={
              voiceState === 'listening'
                ? `Di "Hey ${activeAgent?.name || 'agente'}" o escribe...`
                : `Pregúntale a ${activeAgent?.name || 'tu agente'}...`
            }
            className="flex-1 bg-transparent text-white text-xs placeholder-slate-600 focus:outline-none min-w-0"
          />

          {/* Computer Use quick */}
          <button
            title="Computer Use"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 hover:text-purple-400 transition-all shrink-0"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-6 h-6 rounded-lg flex items-center justify-center bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
          >
            {isLoading ? <Loader className="w-3 h-3 text-white animate-spin" /> : <Send className="w-3 h-3 text-white" />}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-700 text-[9px] mt-2">
          {voiceSupported
            ? `⌘⇧Space · Hey ${activeAgent?.name || 'agente'} · Esc cierra`
            : '⌘⇧Space para abrir · Esc para cerrar'}
        </p>
      </div>

      {/* Voice overlay (rendered at body level via portal in production) */}
      <VoiceActivationIndicator
        state={voiceState}
        agentName={activeAgent?.name || 'tu agente'}
        transcript={voiceTranscript}
        volume={volume}
        onToggle={toggleVoice}
        compact={true}
      />
    </div>
  );
};

export default CompanionMiniApp;
