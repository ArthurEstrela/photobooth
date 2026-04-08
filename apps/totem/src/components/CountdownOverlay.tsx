import React, { useState, useEffect } from 'react';

interface Props {
  startCount: number;
  onComplete: () => void;
}

export const CountdownOverlay: React.FC<Props> = ({ startCount, onComplete }) => {
  const [count, setCount] = useState(startCount);
  const [isFlashing, setIsFlashing] = useState(false);

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
