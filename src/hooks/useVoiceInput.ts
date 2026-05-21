import { useState, useCallback, useRef } from 'react';

// Extend window for webkit prefix
declare global {
  interface Window {
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

interface UseVoiceInputReturn {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useVoiceInput(onFinal?: (text: string) => void): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recRef = useRef<SpeechRecognition | null>(null);

  const SpeechRec =
    typeof window !== 'undefined'
      ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
      : undefined;

  const isSupported = !!SpeechRec;

  const start = useCallback(() => {
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    rec.lang = 'fr-FR';
    rec.continuous = false;
    rec.interimResults = true;

    rec.onstart = () => setIsListening(true);

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let final = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
      if (final) onFinal?.(final.trim());
    };

    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);

    recRef.current = rec;
    rec.start();
    if (navigator.vibrate) navigator.vibrate(50);
  }, [SpeechRec, onFinal]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setIsListening(false);
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
  }, []);

  const reset = useCallback(() => {
    stop();
    setTranscript('');
  }, [stop]);

  return { isListening, transcript, isSupported, start, stop, reset };
}
