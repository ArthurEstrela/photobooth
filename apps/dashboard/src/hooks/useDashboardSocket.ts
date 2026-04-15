import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { DeviceStatusEvent } from '@packages/shared';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface RecentPayment {
  paymentId: string;
  eventName?: string;
  boothName?: string;
  amount: number;
}

export const useDashboardSocket = () => {
  const queryClient = useQueryClient();
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to Dashboard Real-time Engine');
    });

    socket.on('connect_error', (err) => {
      console.error('Dashboard socket auth failed:', err.message);
    });

    socket.on('payment_approved', (data: RecentPayment) => {
      setRecentPayments((prev) => [data, ...prev].slice(0, 20));
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    });

    socket.on('session_completed', () => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    });

    socket.on('photo_synced', () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    });

    socket.on('booth_status', () => {
      queryClient.invalidateQueries({ queryKey: ['booths'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    });

    socket.on('device_status', (data: DeviceStatusEvent) => {
      queryClient.setQueryData(['booth_devices', data.boothId], {
        ...data,
        lastSeen: data.lastSeen,
      });
    });

    return () => { socket.disconnect(); };
  }, [queryClient]);

  return { recentPayments };
};
