import React, { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  pinHash: string | null;
  onSuccess: () => void;
  onClose: () => void;
}

async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];

export const PinScreen: React.FC<Props> = ({ pinHash, onSuccess, onClose }) => {
  const [digits, setDigits] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState(false);

  const handleKey = async (key: string) => {
    if (key === '⌫') {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (key === '✓') {
      if (digits.length !== 4) return;
      const hash = await hashPin(digits);
      if (hash === pinHash) {
        onSuccess();
      } else {
        const next = attempts + 1;
        setAttempts(next);
        setError(true);
        setDigits('');
        setTimeout(() => setError(false), 800);
        if (next >= 3) onClose();
      }
      return;
    }
    if (digits.length < 4) setDigits((d) => d + key);
  };

  // Auto-submit when 4 digits entered
  React.useEffect(() => {
    if (digits.length === 4) handleKey('✓');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-3xl p-8 w-80 flex flex-col items-center gap-6 shadow-2xl border border-white/10">
        {/* Header */}
        <div className="w-full flex items-center justify-between">
          <p className="text-white font-semibold text-lg">PIN de Manutenção</p>
          <button
            aria-label="Fechar"
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Dots */}
        <div className="flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-colors ${
                error
                  ? 'bg-red-500'
                  : i < digits.length
                  ? 'bg-primary'
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {KEYS.map((key) => (
            <button
              key={key}
              onClick={() => handleKey(key)}
              className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xl font-semibold transition-colors"
            >
              {key}
            </button>
          ))}
        </div>

        {attempts > 0 && (
          <p className="text-red-400 text-sm">
            PIN incorreto — {3 - attempts} tentativa{3 - attempts !== 1 ? 's' : ''} restante{3 - attempts !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
};
