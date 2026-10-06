import { useRef, useState, useCallback, useEffect } from "react";

// Browser Web Speech API wrapper for voice input
export const useVoiceInput = (onResult) => {
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      onResult(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    return () => {
      try { rec.stop(); } catch (e) {}
    };
  }, [onResult]);

  const toggle = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      try {
        rec.start();
        setListening(true);
      } catch (e) {
        setListening(false);
      }
    }
  }, [listening]);

  return { listening, supported, toggle };
};
