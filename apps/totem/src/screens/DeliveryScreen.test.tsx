import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DeliveryScreen } from './DeliveryScreen';

// Mock electronAPI
beforeEach(() => {
  (window as any).electronAPI = { printPhoto: vi.fn() };
});

describe('DeliveryScreen — free digital', () => {
  it('shows printing animation initially', () => {
    render(
      <DeliveryScreen
        sessionId="s-1"
        photoUrl="https://s3/photo.jpg"
        digitalPrice={null}
        brandName="MyBooth"
        onDone={vi.fn()}
      />
    );
    expect(screen.getByText('Imprimindo sua foto...')).toBeTruthy();
  });

  it('fires printPhoto IPC on mount', () => {
    render(
      <DeliveryScreen
        sessionId="s-1"
        photoUrl="https://s3/photo.jpg"
        digitalPrice={null}
        brandName="MyBooth"
        onDone={vi.fn()}
      />
    );
    expect((window as any).electronAPI.printPhoto).toHaveBeenCalledWith('https://s3/photo.jpg');
  });

  it('shows free download QR after print animation completes', async () => {
    render(
      <DeliveryScreen
        sessionId="s-1"
        photoUrl="https://s3/photo.jpg"
        digitalPrice={null}
        brandName="MyBooth"
        onDone={vi.fn()}
      />
    );
    
    // Using real timers for this one since fake timers are being flaky
    await waitFor(() => {
      expect(screen.getByText('Escaneie para baixar sua foto digital')).toBeTruthy();
    }, { timeout: 4000 });
  });
});

describe('DeliveryScreen — paid digital upsell', () => {
  it('shows upsell offer after print animation', async () => {
    render(
      <DeliveryScreen
        sessionId="s-1"
        photoUrl="https://s3/photo.jpg"
        digitalPrice={5}
        brandName="MyBooth"
        onDone={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Quer sua foto no celular?')).toBeTruthy();
    }, { timeout: 4000 });
  });

  it('shows "Não, obrigado" button on upsell screen', async () => {
    render(
      <DeliveryScreen
        sessionId="s-1"
        photoUrl="https://s3/photo.jpg"
        digitalPrice={5}
        brandName="MyBooth"
        onDone={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Não, obrigado')).toBeTruthy();
    }, { timeout: 4000 });
  });
});
