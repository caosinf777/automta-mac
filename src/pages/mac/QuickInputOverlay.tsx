/**
 * QuickInputOverlay — Panel Spotlight-style (⌘⇧Space)
 * Se abre sobre cualquier app para consultas rápidas al agente
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Send, Loader, X, Mic, BookOpen, Monitor, Calendar, Folder } from 'lucide-react';
import { useAgentCompanion } from '../../hooks/useAgentCompanion';
import { useVoiceActivation } from '../../hooks/useVoiceActivation';

const QUICK_SUGGESTIONS = [
  { icon: '📚', text: 'Revisa mi Base de Conocimiento' },
  { icon: '📅', text: '¿Qué tengo en el calendario hoy?' },
  { icon: '📧', text: 'Resume mis correos no leídos' },
  { icon: '🖥️', text: 'Controla el Mac para...' },
  { icon: '📂', text: 'Busca el archivo...' },
];

const QuickInputOverlay: React.FC = () => {
  const { activeAgent, messages, isLoading, sendMessage } = useAgentCompanion();
  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState<{ role: string; content: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        (window as any).electronAPI?.window?.hide?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Sync messages from companion
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant') {
      setLocalMessages(prev => {
        const exists = prev.find(m => m.content === last.content);
        if (exists) return prev;
        return [...prev, { role: last.role, content: last.content }];
      });
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setLocalMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    await sendMessage(text);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [input, isLoading, sendMessage]);

  const { state: voiceState, transcript: voiceTranscript, startListening, stopListening } = useVoiceActivation({
    agentName: activeAgent?.name || 'agente',
    onCommand: async (text) => {
      setInput(text);
      await sendMessage(text);
    },
  });

  const hasResponse = localMessages.length > 0;

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-[18vh]"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) (window as any).electronAPI?.window?.hide?.(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-full max-w-[640px] mx-4 rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(12, 10, 26, 0.97)',
          border: '1px solid rgba(124, 58, 237, 0.25)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 40px 80px rgba(0,0,0,0.7), 0 0 80px rgba(124,58,237,0.15)',
        }}
      >
        {/* Logo + Input */}
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shrink-0 shadow-lg shadow-purple-900/50">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={
              voiceState === 'listening'
                ? `Di "Hey ${activeAgent?.name || 'agente'}"...`
                : `Pregúntale a ${activeAgent?.name || 'tu agente'}...`
            }
            className="flex-1 bg-transparent text-white text-lg placeholder-slate-600 focus:outline-none"
          />
          <div className="flex items-center gap-2 shrink-0">
            {/* Voice toggle */}
            <button
              onClick={() => voiceState === 'idle' ? startListening() : stopListening()}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                voiceState !== 'idle'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                  : 'text-slate-600 hover:text-purple-400 hover:bg-purple-500/10'
              }`}
            >
              <Mic className={`w-4 h-4 ${voiceState === 'activated' ? 'animate-pulse' : ''}`} />
            </button>

            {input.trim() ? (
              <button
                onClick={handleSend}
                disabled={isLoading}
                className="w-8 h-8 rounded-xl bg-purple-600 hover:bg-purple-500 flex items-center justify-center transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
              </button>
            ) : (
              <button
                onClick={() => (window as any).electronAPI?.window?.hide?.()}
                className="w-8 h-8 rounded-xl text-slate-600 hover:text-white hover:bg-white/5 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

        {/* Voice transcript */}
        <AnimatePresence>
          {voiceState === 'activated' && voiceTranscript && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
              className="overflow-hidden px-5 py-2 flex items-center gap-2"
              style={{ background: 'rgba(124,58,237,0.08)' }}>
              <Mic className="w-3.5 h-3.5 text-purple-400 animate-pulse shrink-0" />
              <p className="text-sm text-purple-300 italic">"{voiceTranscript}"</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Response area */}
        <AnimatePresence mode="wait">
          {isLoading && !hasResponse && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="px-5 py-5 flex items-center gap-3">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-sm">
                {activeAgent?.emoji || '🤖'}
              </div>
              <div className="flex gap-1">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </motion.div>
          )}

          {hasResponse && (
            <motion.div key="response" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="px-5 py-4 max-h-64 overflow-y-auto space-y-3">
              {localMessages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-sm shrink-0">
                      {activeAgent?.emoji || '🤖'}
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white rounded-tr-sm'
                        : 'text-slate-200 rounded-tl-sm'
                    }`}
                    style={msg.role === 'assistant' ? {
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    } : {}}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-sm">
                    {activeAgent?.emoji || '🤖'}
                  </div>
                  <div className="flex gap-1 items-center">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={resultRef} />
            </motion.div>
          )}

          {/* Suggestions when empty */}
          {!hasResponse && !isLoading && (
            <motion.div key="suggestions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="px-4 py-3">
              {/* Agent info row */}
              {activeAgent && (
                <div className="flex items-center gap-2 px-2 mb-3">
                  <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-xs">
                    {activeAgent.emoji || '🤖'}
                  </div>
                  <span className="text-xs text-slate-500">{activeAgent.name} · AutoMTA</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-auto" />
                </div>
              )}
              <div className="grid grid-cols-1 gap-1">
                {QUICK_SUGGESTIONS.map(s => (
                  <button
                    key={s.text}
                    onClick={() => setInput(s.text)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-slate-400 hover:text-white transition-all group"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)')}
                    onMouseLeave={e => (e.currentTarget.style.border = '1px solid transparent')}
                  >
                    <span className="text-base shrink-0">{s.icon}</span>
                    <span>{s.text}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div
          className="px-5 py-2.5 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <div className="flex items-center gap-3 text-[10px] text-slate-700">
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> Skills activas</span>
            <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> Computer Use</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Calendar</span>
            <span className="flex items-center gap-1"><Folder className="w-3 h-3" /> Archivos</span>
          </div>
          <span className="text-[10px] text-slate-700">Esc para cerrar</span>
        </div>
      </motion.div>
    </div>
  );
};

export default QuickInputOverlay;
