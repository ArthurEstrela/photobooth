import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import {
  BoothState,
  OfflineMode,
  BoothConfigDto,
  PixPaymentResponse,
  PaymentApprovedEvent,
  PaymentExpiredEvent,
} from '@packages/shared';

export function useBoothMachine(boothId: string, token: string, config: BoothConfigDto | null) {
  const [state, setState] = useState<BoothState>(BoothState.IDLE);
  const [currentPayment, setCurrentPayment] = useState<PixPaymentResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stripDataUrl, setStripDataUrl] = useState<string>('');
  const socketRef = useRef<Socket | null>(null);

  const transition = useCallback(
    (newState: BoothState) => {
      setState(newState);
      socketRef.current?.emit('update_state', { boothId, state: newState });
    },
    [boothId],
  );

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    const socket = io(`${apiUrl}/booth`, {
      query: { boothId },
      extraHeaders: { Authorization: `Bearer ${token}` },
    });

    socket.on('payment_approved', (data: PaymentApprovedEvent) => {
      setSessionId(data.sessionId);
      transition(BoothState.IN_SESSION);
    });

    socket.on('payment_expired', (_data: PaymentExpiredEvent) => {
      setCurrentPayment(null);
      transition(BoothState.IDLE);
    });

    socketRef.current = socket;
    return () => {
      socket.disconnect();
    };
  }, [boothId, token, transition]);

  const startPayment = useCallback(
    async (eventId: string, templateId: string | undefined, amount: number) => {
      transition(BoothState.WAITING_PAYMENT);
      const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
      try {
        const res = await axios.post<PixPaymentResponse>(`${apiUrl}/payments/pix`, {
          boothId,
          eventId,
          templateId,
          amount,
        });
        setCurrentPayment(res.data);
      } catch {
        const mode = config?.offlineMode ?? OfflineMode.BLOCK;
        if (mode === OfflineMode.DEMO) {
          setSessionId(`offline-${Date.now()}`);
          transition(BoothState.IN_SESSION);
        } else if (mode === OfflineMode.CREDITS && (config?.offlineCredits ?? 0) > 0) {
          setSessionId(`offline-${Date.now()}`);
          transition(BoothState.IN_SESSION);
        } else {
          transition(BoothState.IDLE);
        }
      }
    },
    [boothId, config, transition],
  );

  const completeSession = useCallback(
    async (dataUrl: string) => {
      setStripDataUrl(dataUrl);
      const totemAPI = (window as any).totemAPI;
      if (sessionId && totemAPI?.saveOfflinePhoto && totemAPI?.printPhoto) {
        totemAPI.saveOfflinePhoto({ sessionId, photoBase64: dataUrl });
        totemAPI.printPhoto();
      }
      transition(BoothState.DELIVERY);
      // NOTE: auto-reset is intentionally removed here.
      // DeliveryScreen drives the flow via onDone → machine.reset().
    },
    [sessionId, transition],
  );

  // Reset stripDataUrl when returning to IDLE so stale data is never reused
  useEffect(() => {
    if (state === BoothState.IDLE) {
      setStripDataUrl('');
      setCurrentPayment(null);
      setSessionId(null);
    }
  }, [state]);

  /** Called by DeliveryScreen when the user flow ends. */
  const resetToIdle = useCallback(() => {
    transition(BoothState.IDLE);
  }, [transition]);

  return {
    state,
    socket: socketRef.current,
    currentPayment,
    sessionId,
    stripDataUrl,
    startPayment,
    completeSession,
    resetToIdle,
  };
}
