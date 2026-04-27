import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useWebcam } from '../hooks/useWebcam';
import { CountdownOverlay } from './CountdownOverlay';

interface Props {
  overlayUrl?: string;
  sessionId: string;
  photoCount: 1 | 2 | 4;
  /** Layout for 4-photo templates: 'grid' (2×2) or 'strip' (1×4 vertical). Default: 'grid'. */
  layout?: string | null;
  cameraSound: boolean;
  onProcessing?: () => void;
  onStripReady: (stripDataUrl: string) => void;
}

export const CameraEngine: React.FC<Props> = ({
  overlayUrl,
  sessionId: _sessionId,
  photoCount,
  layout,
  cameraSound,
  onProcessing,
  onStripReady,
}) => {
  const { videoRef, error, isLoading } = useWebcam();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayImageRef = useRef<HTMLImageElement>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [showCountdown, setShowCountdown] = useState(true);

  const playShutter = useCallback(() => {
    if (!cameraSound) return;
    // Try to play an audio file first; fall back to a synthesised click
    const audio = new Audio('/shutter.mp3');
    audio.play().catch(() => {
      // Synthesise a short white-noise burst that sounds like a shutter click
      try {
        const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx() as AudioContext;
        const bufferSize = Math.floor(ctx.sampleRate * 0.08); // 80 ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = 0.6;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start();
        source.onended = () => ctx.close();
      } catch {
        // No audio at all — silently ignore
      }
    });
  }, [cameraSound]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    return canvas.toDataURL('image/jpeg', 0.95);
  }, [overlayUrl]);

  const buildStrip = useCallback(
    (photos: string[]): Promise<string> => {
      return new Promise((resolve) => {
        const stripCanvas = document.createElement('canvas');
        const ctx = stripCanvas.getContext('2d')!;

        const applyOverlay = () => {
          if (
            overlayUrl &&
            overlayImageRef.current &&
            overlayImageRef.current.complete &&
            overlayImageRef.current.naturalWidth > 0
          ) {
            ctx.drawImage(overlayImageRef.current, 0, 0, stripCanvas.width, stripCanvas.height);
          }
          resolve(stripCanvas.toDataURL('image/jpeg', 0.95));
        };

        if (photoCount === 1) {
          const img = new Image();
          img.onload = () => {
            stripCanvas.width = img.width;
            stripCanvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            applyOverlay();
          };
          img.src = photos[0];

        } else if (photoCount === 2) {
          // 1×2 vertical strip
          const imgs = [new Image(), new Image()];
          let loaded = 0;
          const onLoad = () => {
            if (++loaded < 2) return;
            const w = imgs[0].width;
            const h = imgs[0].height;
            stripCanvas.width = w;
            stripCanvas.height = h * 2;
            ctx.drawImage(imgs[0], 0, 0, w, h);
            ctx.drawImage(imgs[1], 0, h, w, h);
            applyOverlay();
          };
          imgs[0].onload = onLoad;
          imgs[1].onload = onLoad;
          imgs[0].src = photos[0];
          imgs[1].src = photos[1] ?? photos[0];

        } else {
          // photoCount === 4
          const imgs = photos.map((src) => {
            const img = new Image();
            img.src = src;
            return img;
          });
          let loaded = 0;
          const onLoad = () => {
            if (++loaded < 4) return;
            const w = imgs[0].width;
            const h = imgs[0].height;

            if (layout === 'strip') {
              // 1×4 vertical tira — classic photobooth strip
              stripCanvas.width = w;
              stripCanvas.height = h * 4;
              imgs.forEach((img, i) => ctx.drawImage(img, 0, h * i, w, h));
            } else {
              // 2×2 grid (default)
              stripCanvas.width = w * 2;
              stripCanvas.height = h * 2;
              ctx.drawImage(imgs[0], 0, 0, w, h);
              ctx.drawImage(imgs[1] ?? imgs[0], w, 0, w, h);
              ctx.drawImage(imgs[2] ?? imgs[0], 0, h, w, h);
              ctx.drawImage(imgs[3] ?? imgs[0], w, h, w, h);
            }
            applyOverlay();
          };
          imgs.forEach((img) => (img.onload = onLoad));
        }
      });
    },
    [photoCount, layout, overlayUrl],
  );

  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    playShutter();

    const photo = captureFrame();
    if (!photo) return;

    const next = [...capturedPhotos, photo];
    setCapturedPhotos(next);

    if (next.length < photoCount) {
      setTimeout(() => setShowCountdown(true), 500);
    } else {
      onProcessing?.();
      buildStrip(next).then(onStripReady);
    }
  }, [
    capturedPhotos,
    photoCount,
    captureFrame,
    buildStrip,
    playShutter,
    onProcessing,
    onStripReady,
  ]);

  useEffect(() => {
    setShowCountdown(true);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <p className="text-red-400 text-2xl">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <p className="text-white text-2xl animate-pulse">Iniciando câmera...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />
      {overlayUrl && (
        <img ref={overlayImageRef} src={overlayUrl} className="hidden" alt="" crossOrigin="anonymous" />
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover transform scale-x-[-1]"
      />

      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-2">
        {Array.from({ length: photoCount }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border-2 border-white transition-all ${
              i < capturedPhotos.length ? 'bg-white' : 'bg-transparent'
            }`}
          />
        ))}
      </div>

      {showCountdown && (
        <CountdownOverlay startCount={3} onComplete={handleCountdownComplete} />
      )}
    </div>
  );
};
