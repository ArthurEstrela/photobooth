import React, { useState, useEffect } from 'react';

interface Props {
  startCount: number;
  onComplete: () => void;
}

/** Play a short beep using the Web Audio API. Higher pitch on the last second. */
function playBeep(count: number) {
  try {
    const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx() as AudioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    // Last second gets a higher-pitched "ready" tone
    osc.frequency.value = count === 1 ? 1047 : 698; // C6 vs F5
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => ctx.close();
  } catch {
    // Web Audio not available — no sound
  }
}

export const CountdownOverlay: React.FC<Props> = ({ startCount, onComplete }) => {
  const [count, setCount] = useState(startCount);
  const [isFlashing, setIsFlashing] = useState(false);

  // Beep on every number change (including the initial render)
  useEffect(() => {
    if (count > 0) playBeep(count);
  }, [count]);

  useEffect(() => {
    if (count <= 0) {
      setIsFlashing(true);
      const flashTimeout = setTimeout(() => {
        setIsFlashing(false);
        onComplete();
      }, 300);
      return () => clearTimeout(flashTimeout);
    }

    const timer = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, onComplete]);

  if (isFlashing) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-white"
        style={{ animation: 'flash 0.3s ease-out' }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        key={count}
        className="text-white font-black select-none"
        style={{
          fontSize: '20rem',
          lineHeight: 1,
          animation: 'countPop 0.9s ease-out forwards',
          textShadow: '0 0 60px rgba(255,255,255,0.5)',
        }}
      >
        {count}
      </div>
      <style>{`
        @keyframes countPop {
          0%   { transform: scale(1.8); opacity: 0; }
          20%  { transform: scale(1.0); opacity: 1; }
          80%  { transform: scale(1.0); opacity: 1; }
          100% { transform: scale(0.6); opacity: 0; }
        }
        @keyframes flash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};
