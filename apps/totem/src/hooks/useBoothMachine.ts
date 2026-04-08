// apps/totem/src/hooks/useBoothMachine.ts

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { BoothState, PaymentApprovedEvent } from '@packages/shared';

export function useBoothMachine(boothId: string, token: string) {
  const [state, setState] = useState<BoothState>(BoothState.IDLE);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentPayment, setCurrentPayment] = useState<any>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const s = io(`${process.env.VITE_API_URL}/booth`, {
      query: { boothId },
      extraHeaders: { Authorization: `Bearer ${token}` },
    });

    s.on('connect', () => {
      console.log('Connected to API WebSocket');
    });

    s.on('payment_approved', (data: PaymentApprovedEvent) => {
      console.log('Payment Approved!', data);
      transition(BoothState.IN_SESSION);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [boothId, token]);

  // Handle state transitions
  const transition = useCallback((newState: BoothState) => {
    setState(newState);
    if (socket) {
      socket.emit('update_state', { boothId, state: newState });
    }
  }, [socket, boothId]);

  const startPayment = async (eventId: string, amount: number) => {
    transition(BoothState.WAITING_PAYMENT);
    try {
      // TODO: Call API to create payment
      // const res = await api.post('/payments', { boothId, eventId, amount });
      // setCurrentPayment(res.data);
    } catch (error) {
      console.error('Failed to create payment', error);
      transition(BoothState.IDLE);
    }
  };

  const startSession = () => {
    // Logic for WebRTC / 3-2-1 Countdown
    transition(BoothState.IN_SESSION);
  };

  const completeSession = async (photoData: any) => {
    transition(BoothState.PROCESSING);
    // TODO: Apply frame filter
    
    transition(BoothState.DELIVERY);
    // TODO: Silent print and async upload
    
    // OFFLINE-FIRST: Save to SQLite local if upload fails
    // retryQueue.push({ ...photoData, timestamp: Date.now() });

    setTimeout(() => transition(BoothState.IDLE), 5000);
  };

  return {
    state,
    currentPayment,
    startPayment,
    startSession,
    completeSession,
  };
}
