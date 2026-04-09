import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useDashboardSocket = () => {
  const queryClient = useQueryClient();

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

    socket.on('payment_approved', () => {
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

    return () => { socket.disconnect(); };
  }, [queryClient]);
};
