import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { CameraEngine } from './CameraEngine';
import * as useWebcamModule from '../hooks/useWebcam';

// Mock useWebcam to avoid navigator.mediaDevices in tests
vi.mock('../hooks/useWebcam', () => ({
  useWebcam: vi.fn(() => ({
    videoRef: { current: null },
    stream: null,
    error: null,
    isLoading: false,
    retry: vi.fn(),
  })),
}));

describe('CameraEngine', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows loading when webcam is loading', () => {
    vi.mocked(useWebcamModule.useWebcam).mockReturnValueOnce({
      videoRef: { current: null },
      stream: null,
      error: null,
      isLoading: true,
      retry: vi.fn(),
    });

    render(
      <CameraEngine
        overlayUrl={undefined}
        sessionId="s1"
        photoCount={1}
        cameraSound={false}
        onStripReady={vi.fn()}
      />,
    );
    expect(screen.getByText(/iniciando câmera/i)).toBeInTheDocument();
  });

  it('shows error message when webcam fails', () => {
    vi.mocked(useWebcamModule.useWebcam).mockReturnValueOnce({
      videoRef: { current: null },
      stream: null,
      error: 'Camera not found',
      isLoading: false,
      retry: vi.fn(),
    });

    render(
      <CameraEngine
        overlayUrl={undefined}
        sessionId="s1"
        photoCount={1}
        cameraSound={false}
        onStripReady={vi.fn()}
      />,
    );
    expect(screen.getByText(/camera not found/i)).toBeInTheDocument();
  });

  it('renders countdown overlay when mounted (not loading, no error)', () => {
    render(
      <CameraEngine
        overlayUrl={undefined}
        sessionId="s1"
        photoCount={1}
        cameraSound={false}
        onStripReady={vi.fn()}
      />,
    );
    // CountdownOverlay starts at 3
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
