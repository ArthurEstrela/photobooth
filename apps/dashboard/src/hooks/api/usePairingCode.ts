import { useMutation } from '@tanstack/react-query';
import api from '../../lib/api';

export interface PairingCodeResponse {
  code: string;
  expiresAt: string;
}

export const usePairingCode = () =>
  useMutation<PairingCodeResponse, unknown, string>({
    mutationFn: (boothId: string) =>
      api.post(`/booths/${boothId}/pairing-code`).then((r) => r.data),
  });
