"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { VoiceCapture } from "@/lib/types";

interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}

interface RecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: RecognitionResult;
  };
}

interface RecognitionErrorEvent extends Event {
  error: string;
}

interface RecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionConstructor = new () => RecognitionInstance;

function getRecognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const browserWindow = window as Window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
}

function subscribeToBrowserCapability() {
  return () => undefined;
}

function recognitionErrorMessage(error: string) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "请允许浏览器使用麦克风，然后再试一次。";
  }
  if (error === "audio-capture") return "没有检测到可用麦克风。";
  if (error === "no-speech") return "没有听清，可以点击麦克风重新说。";
  if (error === "network") return "语音识别暂时不可用，你仍可以打字发言。";
  return "语音输入没有完成，你仍可以打字发言。";
}

export function useSpeechInput({
  value,
  onChange,
  onCapture,
}: {
  value: string;
  onChange: (next: string) => void;
  onCapture: (capture: VoiceCapture) => void;
}) {
  const isSupported = useSyncExternalStore(
    subscribeToBrowserCapability,
    () => Boolean(getRecognitionConstructor()),
    () => false,
  );
  const [isListening, setIsListening] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [notice, setNotice] = useState("");
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const startedAtRef = useRef(0);
  const lastResultAtRef = useRef(0);
  const pauseCountRef = useRef(0);
  const baseTextRef = useRef("");
  const finalTextRef = useRef("");
  const hasSpeechRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onCaptureRef = useRef(onCapture);

  useEffect(() => {
    onChangeRef.current = onChange;
    onCaptureRef.current = onCapture;
  }, [onCapture, onChange]);

  useEffect(() => {
    if (!isListening) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(
        Math.max(1, Math.round((performance.now() - startedAtRef.current) / 1000)),
      );
    }, 500);
    return () => window.clearInterval(timer);
  }, [isListening]);

  const completeCapture = useCallback(() => {
    setIsListening(false);
    recognitionRef.current = null;
    if (!hasSpeechRef.current || !startedAtRef.current) return;
    const durationSeconds = Math.max(
      1,
      Math.round((performance.now() - startedAtRef.current) / 1000),
    );
    setElapsedSeconds(durationSeconds);
    onCaptureRef.current({
      durationSeconds,
      pauseCount: pauseCountRef.current,
    });
  }, []);

  const start = useCallback(() => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setNotice("当前浏览器不支持语音输入，你仍可以打字发言。");
      return;
    }

    setNotice("");
    setElapsedSeconds(0);
    baseTextRef.current = value.trim();
    finalTextRef.current = "";
    pauseCountRef.current = 0;
    lastResultAtRef.current = 0;
    hasSpeechRef.current = false;
    startedAtRef.current = performance.now();

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "zh-CN";
    recognition.onresult = (event) => {
      const now = performance.now();
      if (lastResultAtRef.current && now - lastResultAtRef.current > 1800) {
        pauseCountRef.current += 1;
      }
      lastResultAtRef.current = now;

      let finalChunk = "";
      let interimChunk = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;
        hasSpeechRef.current = true;
        if (result.isFinal) finalChunk += transcript;
        else interimChunk += transcript;
      }
      if (finalChunk) finalTextRef.current += finalChunk;
      const next = [baseTextRef.current, finalTextRef.current, interimChunk]
        .filter(Boolean)
        .join(" ");
      onChangeRef.current(next);
    };
    recognition.onerror = (event) => {
      setNotice(recognitionErrorMessage(event.error));
    };
    recognition.onend = completeCapture;
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      recognitionRef.current = null;
      setNotice("麦克风启动失败，你仍可以打字发言。");
    }
  }, [completeCapture, value]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      completeCapture();
    }
  }, [completeCapture]);

  const cancel = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    hasSpeechRef.current = false;
    startedAtRef.current = 0;
    setIsListening(false);
    try {
      recognition?.abort();
    } catch {
      // The browser may already have ended the recognition session.
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  return {
    isSupported,
    isListening,
    elapsedSeconds,
    notice,
    start,
    stop,
    cancel,
    clearNotice: () => setNotice(""),
  };
}

export function useSpeechPlayback() {
  const isSupported = useSyncExternalStore(
    subscribeToBrowserCapability,
    () =>
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      "SpeechSynthesisUtterance" in window,
    () => false,
  );
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (muted && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [muted]);

  const speak = useCallback(
    (text: string) => {
      if (
        muted ||
        !text.trim() ||
        typeof window === "undefined" ||
        !("speechSynthesis" in window)
      ) {
        return;
      }
      const speech = window.speechSynthesis;
      speech.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 1.02;
      const voices = speech.getVoices();
      utterance.voice =
        voices.find((voice) => voice.lang.toLowerCase() === "zh-cn") ??
        voices.find((voice) => voice.lang.toLowerCase().startsWith("zh")) ??
        null;
      speech.speak(utterance);
    },
    [muted],
  );

  const cancel = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { isSupported, muted, setMuted, speak, cancel };
}
