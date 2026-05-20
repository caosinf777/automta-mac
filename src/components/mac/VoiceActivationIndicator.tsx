/**
 * VoiceActivationIndicator — UI del estado de escucha por voz
 * 
 * Aparece cuando el agente está escuchando tu wake word o tu comando.
 * Inspirado en el diseño de Siri pero con el branding de AutoMTA.
 * 
 * Estados visuales:
 * - Idle:      Ícono de micrófono pequeño en la barra (apagado)
 * - Listening: Ondas sutiles + micrófono pulsando (escuchando wake word)  
 * - Activated: Animación grande + "Te escucho..." (capturando comando)
 * - Processing: Spinner + "Procesando..." (enviando al agente)
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader, Zap } from 'lucide-react';
import { VoiceState } from '../../hooks/useVoiceActivation';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface VoiceActivationIndicatorProps {
  state: VoiceState;
  agentName: string;
  transcript?: string;
  volume?: number;       // 0-1 for visual feedback
  onToggle: () => void;  // Toggle listening on/off
  compact?: boolean;     // Compact mode for mini panel
}

// ─── Animated Sound Wave ────────────────────────────────────────────────────────
const SoundWave: React.FC<{ volume: number; isActive: boolean }> = ({ volume, isActive }) => {
  const bars = 5;
  return (
    <div className="flex items-center gap-0.5 h-6">
      {Array.from({ length: bars }).map((_, i) => {
        const delay = i * 0.08;
        const baseHeight = isActive ? 8 + volume * 20 : 4;
        const height = baseHeight + Math.sin(i * 0.8) * 4;

        return (
          <motion.div
            key={i}
            className="rounded-full bg-purple-400"
            style={{ width: 3 }}
            animate={{
              height: isActive ? [height, height * 1.5, height] : 4,
              opacity: isActive ? 1 : 0.3,
            }}
            transition={{
              duration: 0.6,
              delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        );
      })}
    </div>
  );
};

// ─── Pulse Ring ─────────────────────────────────────────────────────────────────
const PulseRing: React.FC<{ color?: string }> = ({ color = 'purple' }) => (
  <>
    {[1, 2, 3].map(i => (
      <motion.div
        key={i}
        className={`absolute inset-0 rounded-full border-2 border-${color}-500/40`}
        initial={{ scale: 1, opacity: 0.6 }}
        animate={{ scale: 1 + i * 0.4, opacity: 0 }}
        transition={{
          duration: 2,
          delay: i * 0.4,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
    ))}
  </>
);

// ─── Full Activation Overlay ────────────────────────────────────────────────────
const ActivationOverlay: React.FC<{
  agentName: string;
  transcript: string;
  state: VoiceState;
  volume: number;
}> = ({ agentName, transcript, state, volume }) => {
  const isCapturing = state === 'activated';
  const isProcessing = state === 'processing';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-8 pointer-events-none"
    >
      <div
        className="flex flex-col items-center gap-4 px-8 py-6 rounded-3xl pointer-events-auto"
        style={{
          background: 'rgba(10, 8, 20, 0.95)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(124, 58, 237, 0.3)',
          boxShadow: '0 0 60px rgba(124, 58, 237, 0.25), 0 25px 50px rgba(0,0,0,0.6)',
          minWidth: 340,
        }}
      >
        {/* AutoMTA + Agent name */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-semibold text-sm">{agentName}</span>
          <span className="text-slate-500 text-sm">· AutoMTA</span>
        </div>

        {/* Main visual indicator */}
        <div className="relative flex items-center justify-center w-20 h-20">
          {isCapturing && <PulseRing />}

          <motion.div
            className="w-16 h-16 rounded-full flex items-center justify-center relative"
            style={{
              background: isProcessing
                ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                : 'linear-gradient(135deg, #7c3aed, #a855f7)',
              boxShadow: isCapturing
                ? '0 0 30px rgba(168, 85, 247, 0.6)'
                : '0 0 15px rgba(124, 58, 237, 0.4)',
            }}
            animate={isCapturing ? {
              scale: [1, 1 + volume * 0.15, 1],
            } : {}}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {isProcessing ? (
              <Loader className="w-7 h-7 text-white animate-spin" />
            ) : (
              <Mic className="w-7 h-7 text-white" />
            )}
          </motion.div>
        </div>

        {/* Sound waves */}
        {isCapturing && (
          <SoundWave volume={volume} isActive={true} />
        )}

        {/* Status text */}
        <div className="text-center">
          {isCapturing && !transcript && (
            <p className="text-purple-300 text-sm font-medium animate-pulse">
              Te escucho...
            </p>
          )}
          {isCapturing && transcript && (
            <motion.p
              key={transcript}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-white text-sm font-medium max-w-[260px] text-center leading-relaxed"
            >
              "{transcript}"
            </motion.p>
          )}
          {isProcessing && (
            <p className="text-purple-300 text-sm font-medium">
              Procesando tu solicitud...
            </p>
          )}
          <p className="text-slate-600 text-xs mt-1">
            {isCapturing ? 'Habla con claridad · Esc para cancelar' : ''}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Compact Mic Button (for mini panel) ───────────────────────────────────────
export const VoiceMicButton: React.FC<{
  state: VoiceState;
  volume: number;
  onToggle: () => void;
  agentName: string;
}> = ({ state, volume, onToggle, agentName }) => {
  const isListening = state === 'listening';
  const isActivated = state === 'activated' || state === 'processing';
  const isError = state === 'error';

  return (
    <button
      onClick={onToggle}
      title={isListening
        ? `Escuchando "Hey ${agentName}"... (click para detener)`
        : isError
          ? 'Error de micrófono'
          : `Activar "Hey ${agentName}"`
      }
      className={`relative w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
        isActivated
          ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
          : isListening
            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
            : isError
              ? 'bg-red-500/10 text-red-400'
              : 'text-slate-500 hover:text-purple-400 hover:bg-purple-500/10'
      }`}
    >
      {isError ? (
        <MicOff className="w-3.5 h-3.5" />
      ) : (
        <Mic className={`w-3.5 h-3.5 ${isListening || isActivated ? 'animate-pulse' : ''}`} />
      )}

      {/* Volume ring when listening */}
      {isListening && (
        <motion.div
          className="absolute inset-0 rounded-lg border border-purple-500/60"
          animate={{ scale: [1, 1 + volume * 0.3, 1], opacity: [0.6, 0.2, 0.6] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}

      {/* Active dot */}
      {isListening && (
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-900" />
      )}
    </button>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────
const VoiceActivationIndicator: React.FC<VoiceActivationIndicatorProps> = ({
  state,
  agentName,
  transcript = '',
  volume = 0,
  onToggle,
  compact = false,
}) => {
  const showOverlay = state === 'activated' || state === 'processing';

  if (compact) {
    return (
      <>
        <VoiceMicButton
          state={state}
          volume={volume}
          onToggle={onToggle}
          agentName={agentName}
        />
        <AnimatePresence>
          {showOverlay && (
            <ActivationOverlay
              agentName={agentName}
              transcript={transcript}
              state={state}
              volume={volume}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // Full indicator bar (for the full companion window)
  return (
    <div>
      <motion.div
        className="flex items-center justify-between px-4 py-2.5 rounded-xl mx-4 mb-3"
        style={{
          background: state === 'listening'
            ? 'rgba(124, 58, 237, 0.08)'
            : state === 'activated'
              ? 'rgba(168, 85, 247, 0.12)'
              : 'rgba(255,255,255,0.04)',
          border: state === 'listening' || state === 'activated'
            ? '1px solid rgba(124, 58, 237, 0.25)'
            : '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onToggle}
            className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              state === 'listening' || state === 'activated'
                ? 'bg-purple-600 shadow-lg shadow-purple-900/40'
                : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            {state === 'processing' ? (
              <Loader className="w-4 h-4 text-white animate-spin" />
            ) : state === 'error' ? (
              <MicOff className="w-4 h-4 text-red-400" />
            ) : (
              <Mic className={`w-4 h-4 ${
                state === 'listening' || state === 'activated' ? 'text-white' : 'text-slate-400'
              }`} />
            )}
            {state === 'listening' && (
              <motion.div
                className="absolute inset-0 rounded-xl border-2 border-purple-400/50"
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 0, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </button>

          <div>
            <p className="text-xs font-medium text-white">
              {state === 'idle' && `Activar "Hey ${agentName}"`}
              {state === 'listening' && `Escuchando "Hey ${agentName}"`}
              {state === 'activated' && transcript ? `"${transcript}"` : state === 'activated' ? 'Te escucho...' : ''}
              {state === 'processing' && 'Procesando...'}
              {state === 'error' && 'Error de micrófono'}
            </p>
            <p className="text-[10px] text-slate-500">
              {state === 'idle' && 'Di "Hey ' + agentName + '" para activar'}
              {state === 'listening' && 'Micrófono activo · En espera'}
              {state === 'activated' && 'Di tu comando ahora'}
              {state === 'processing' && 'Enviando al agente...'}
              {state === 'error' && 'Verifica los permisos de micrófono'}
            </p>
          </div>
        </div>

        {/* Sound wave visual */}
        {(state === 'listening' || state === 'activated') && (
          <SoundWave volume={volume} isActive={state === 'activated'} />
        )}
      </motion.div>

      <AnimatePresence>
        {showOverlay && (
          <ActivationOverlay
            agentName={agentName}
            transcript={transcript}
            state={state}
            volume={volume}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceActivationIndicator;
