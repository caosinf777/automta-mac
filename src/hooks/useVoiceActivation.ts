/**
 * useVoiceActivation — Hook de activación por voz tipo "Hey Siri"
 * 
 * Escucha continuamente el micrófono buscando "Hey [nombre del agente]"
 * Cuando lo detecta, activa el modo de comando de voz completo.
 * 
 * Usa Web Speech API (nativo en Chromium/Electron, sin dependencias extra)
 * Soporta español e inglés automáticamente según el agente.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────
export type VoiceState =
  | 'idle'           // No escuchando
  | 'listening'      // Escuchando wake word en segundo plano
  | 'activated'      // Wake word detectado, escuchando comando
  | 'processing'     // Enviando al agente
  | 'responding'     // El agente está respondiendo
  | 'error';         // Error de micrófono o no soportado

export interface VoiceActivationConfig {
  agentName: string;         // Ej: "Jarvis" → detecta "Hey Jarvis"
  language?: string;         // Ej: 'es-MX', 'es-ES', 'en-US'
  wakeWords?: string[];      // Palabras adicionales, por defecto ["hey", "oye", "ey"]
  onCommand: (transcript: string) => void;  // Callback cuando se captura un comando
  onActivated?: () => void;  // Callback cuando se activa (wake word detectado)
  autoStart?: boolean;       // Empezar a escuchar automáticamente
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_WAKE_PREFIXES = ['hey', 'oye', 'ey', 'ok', 'hola'];
const COMMAND_TIMEOUT_MS = 8000;    // Tiempo máximo para el comando después de activar
const SILENCE_TIMEOUT_MS = 2000;   // Silencio antes de enviar el comando
const CONFIDENCE_THRESHOLD = 0.6;  // Confianza mínima del reconocimiento

// ─── Hook ───────────────────────────────────────────────────────────────────────
export function useVoiceActivation({
  agentName,
  language = 'es-MX',
  wakeWords = DEFAULT_WAKE_PREFIXES,
  onCommand,
  onActivated,
  autoStart = false,
}: VoiceActivationConfig) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [volume, setVolume] = useState(0);     // 0-1 para el indicador visual

  const recognitionRef = useRef<any>(null);
  const commandRecognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const commandTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isActivatedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition
      || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  // ── Build wake word patterns ─────────────────────────────────────────────────
  const buildWakePatterns = useCallback((name: string): RegExp[] => {
    const nameLower = name.toLowerCase();
    const patterns: RegExp[] = [];

    // "Hey Jarvis", "Oye Jarvis", "Ok Jarvis"
    wakeWords.forEach(prefix => {
      patterns.push(new RegExp(`\\b${prefix}\\s+${nameLower}\\b`, 'i'));
    });

    // Just the name alone (if high confidence)
    patterns.push(new RegExp(`^${nameLower}$`, 'i'));

    // "Jarvis" at start of phrase
    patterns.push(new RegExp(`^${nameLower}\\s`, 'i'));

    return patterns;
  }, [wakeWords]);

  const detectWakeWord = useCallback((text: string, name: string): boolean => {
    const patterns = buildWakePatterns(name);
    return patterns.some(p => p.test(text.trim()));
  }, [buildWakePatterns]);

  // ── Volume meter for UI feedback ─────────────────────────────────────────────
  const startVolumeMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setVolume(avg / 128); // Normalize to 0-1
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };

      animFrameRef.current = requestAnimationFrame(updateVolume);
    } catch {
      // No microphone access or other error
    }
  }, []);

  const stopVolumeMeter = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setVolume(0);
  }, []);

  // ── Start listening for COMMAND (after wake word) ────────────────────────────
  const startCommandListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition
      || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    // Stop any existing command recognition
    if (commandRecognitionRef.current) {
      commandRecognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 3;

    let fullTranscript = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      fullTranscript = final || interim;
      setTranscript(fullTranscript);

      // Reset silence timer on new speech
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      // If we have final text, wait for silence then send
      if (final) {
        silenceTimerRef.current = setTimeout(() => {
          if (fullTranscript.trim()) {
            recognition.stop();
            onCommand(fullTranscript.trim());
            setState('processing');
          }
        }, SILENCE_TIMEOUT_MS);
      }
    };

    recognition.onerror = () => {
      setState('listening');
      isActivatedRef.current = false;
    };

    recognition.onend = () => {
      if (isActivatedRef.current && state === 'activated') {
        // Send whatever we have
        if (fullTranscript.trim()) {
          onCommand(fullTranscript.trim());
          setState('processing');
        } else {
          setState('listening');
          isActivatedRef.current = false;
        }
      }
    };

    commandRecognitionRef.current = recognition;
    recognition.start();

    // Auto-timeout for command
    commandTimerRef.current = setTimeout(() => {
      if (isActivatedRef.current) {
        recognition.stop();
        if (fullTranscript.trim()) {
          onCommand(fullTranscript.trim());
          setState('processing');
        } else {
          setState('listening');
          isActivatedRef.current = false;
        }
      }
    }, COMMAND_TIMEOUT_MS);
  }, [language, onCommand, state]);

  // ── Start Wake Word Listener ─────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition
      || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition || state === 'listening') return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    setState('listening');
    startVolumeMeter();

    recognition.onresult = (event: any) => {
      if (isActivatedRef.current) return; // Already in command mode

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (detectWakeWord(text, agentName)) {
          // 🎯 WAKE WORD DETECTED!
          isActivatedRef.current = true;
          setState('activated');
          setTranscript('');
          onActivated?.();

          // Brief pause then start command listening
          setTimeout(() => {
            startCommandListening();
          }, 300);

          break;
        }
      }
    };

    recognition.onend = () => {
      // Restart if we're still supposed to be listening
      if (state === 'listening' && !isActivatedRef.current) {
        setTimeout(() => {
          try { recognition.start(); } catch { /* ignore */ }
        }, 500);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setState('error');
        stopVolumeMeter();
      }
      // Restart on other errors
      else if (!isActivatedRef.current) {
        setTimeout(() => {
          try { recognition.start(); } catch { /* ignore */ }
        }, 1000);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setState('error');
    }
  }, [state, language, agentName, detectWakeWord, startCommandListening, onActivated, startVolumeMeter, stopVolumeMeter]);

  // ── Stop all listening ───────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Prevent auto-restart
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (commandRecognitionRef.current) {
      commandRecognitionRef.current.onend = null;
      commandRecognitionRef.current.stop();
      commandRecognitionRef.current = null;
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (commandTimerRef.current) clearTimeout(commandTimerRef.current);

    isActivatedRef.current = false;
    stopVolumeMeter();
    setState('idle');
    setTranscript('');
  }, [stopVolumeMeter]);

  // ── Mark as responded (ready to listen again) ────────────────────────────────
  const markResponded = useCallback(() => {
    isActivatedRef.current = false;
    setTranscript('');
    setState('listening');
  }, []);

  // ── Auto-start ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoStart && isSupported) {
      startListening();
    }
    return () => {
      stopListening();
    };
  }, [autoStart, isSupported]); // eslint-disable-line

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []); // eslint-disable-line

  return {
    state,
    transcript,
    isSupported,
    volume,
    isListening: state === 'listening' || state === 'activated',
    isActivated: state === 'activated',
    startListening,
    stopListening,
    markResponded,
  };
}
