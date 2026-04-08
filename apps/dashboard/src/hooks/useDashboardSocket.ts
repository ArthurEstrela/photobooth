// apps/dashboard/src/hooks/useDashboardSocket.ts

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useDashboardSocket = (tenantId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tenantId) return;

    const socket = io(SOCKET_URL, {
      query: { tenantId },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to Dashboard Real-time Engine');
      socket.emit('join_tenant', tenantId);
    });

    // When a payment is approved or session ends, refresh metrics
    socket.on('payment_approved', (data: unknown) => {
      console.log('Payment Approved Real-time Update', data);
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    });

    socket.on('session_completed', () => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [tenantId, queryClient]);
};
