import { useState, useEffect, useRef, useCallback } from "react";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1200;

export function useVoiceRecognition({ onResult, continuous = false } = {}) {
  const [isListening, setIsListening]   = useState(false);
  const [transcript, setTranscript]     = useState("");
  const [error, setError]               = useState(null);
  const [isSupported, setIsSupported]   = useState(false);
  const [retryCount, setRetryCount]     = useState(0);

  const recognitionRef  = useRef(null);
  const retryCountRef   = useRef(0);
  const retryTimerRef   = useRef(null);
  const intendedRef     = useRef(false);

  const buildRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = continuous;

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        const text = result[0].transcript.trim();
        retryCountRef.current = 0;
        setRetryCount(0);
        setTranscript(text);
        if (onResult) onResult(text);
      }
    };

    recognition.onerror = (event) => {
      const err = event.error;

      if (err === "network") {
        if (intendedRef.current && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          setRetryCount(retryCountRef.current);

          retryTimerRef.current = setTimeout(() => {
            if (!intendedRef.current) return;
            try {
              recognitionRef.current?.abort();
              const fresh = buildRecognition();
              if (fresh) {
                recognitionRef.current = fresh;
                fresh.start();
                setIsListening(true);
                setError(null);
              }
            } catch {
            }
          }, RETRY_DELAY_MS);

          setError(`Network issue — retrying (${retryCountRef.current}/${MAX_RETRIES})…`);
        } else {
          intendedRef.current = false;
          setIsListening(false);
          setError(
            "Voice recognition couldn't connect. Check your internet connection and try again."
          );
        }
        return;
      }

      if (err === "no-speech") {
        setError("No speech detected. Please try again.");
      } else if (err === "not-allowed" || err === "service-not-allowed") {
        setError("Microphone access denied. Please allow microphone permission in your browser.");
      } else if (err === "audio-capture") {
        setError("No microphone found. Please connect a microphone and try again.");
      } else if (err === "aborted") {
        setError(null);
      } else {
        setError(`Voice error: ${err}. Please try again.`);
      }

      setIsListening(false);
      intendedRef.current = false;
    };

    recognition.onend = () => {
      if (intendedRef.current && continuous) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
          intendedRef.current = false;
        }
      } else if (!intendedRef.current) {
        setIsListening(false);
      }
    };

    return recognition;
  }, [continuous]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    recognitionRef.current = buildRecognition();

    return () => {
      clearTimeout(retryTimerRef.current);
      intendedRef.current = false;
      recognitionRef.current?.abort();
    };
  }, [buildRecognition]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    clearTimeout(retryTimerRef.current);
    retryCountRef.current = 0;
    setRetryCount(0);
    setError(null);
    setTranscript("");
    intendedRef.current = true;

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setIsListening(true);
    }
  }, []);

  const stopListening = useCallback(() => {
    clearTimeout(retryTimerRef.current);
    intendedRef.current = false;
    retryCountRef.current = 0;
    setRetryCount(0);
    setError(null);
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  return {
    isListening,
    transcript,
    error,
    isSupported,
    retryCount,
    startListening,
    stopListening,
  };
}
