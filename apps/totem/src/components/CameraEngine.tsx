import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useWebcam } from '../hooks/useWebcam';
import { CountdownOverlay } from './CountdownOverlay';

interface Props {
  overlayUrl?: string;
  sessionId: string;
  photoCount: 1 | 2 | 4;
  cameraSound: boolean;
  onStripReady: (stripDataUrl: string) => void;
}

export const CameraEngine: React.FC<Props> = ({
  overlayUrl,
  sessionId: _sessionId,
  photoCount,
  cameraSound,
  onStripReady,
}) => {
  const { videoRef, error, isLoading } = useWebcam();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayImageRef = useRef<HTMLImageElement>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [showCountdown, setShowCountdown] = useState(true);

  const playShutter = useCallback(() => {
    if (!cameraSound) return;
    try {
      new Audio('/shutter.mp3').play().catch(() => {});
    } catch {}
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

    if (overlayUrl && overlayImageRef.current) {
      ctx.drawImage(overlayImageRef.current, 0, 0, canvas.width, canvas.height);
    }

    return canvas.toDataURL('image/jpeg', 0.95);
  }, [overlayUrl]);

  const buildStrip = useCallback(
    (photos: string[]): Promise<string> => {
      return new Promise((resolve) => {
        const stripCanvas = document.createElement('canvas');
        const ctx = stripCanvas.getContext('2d')!;

        if (photoCount === 1) {
          const img = new Image();
          img.onload = () => {
            stripCanvas.width = img.width;
            stripCanvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve(stripCanvas.toDataURL('image/jpeg', 0.95));
          };
          img.src = photos[0];
        } else if (photoCount === 2) {
          const img1 = new Image();
          const img2 = new Image();
          let loaded = 0;
          const onLoad = () => {
            loaded++;
            if (loaded < 2) return;
            stripCanvas.width = img1.width;
            stripCanvas.height = img1.height * 2;
            ctx.drawImage(img1, 0, 0);
            ctx.drawImage(img2, 0, img1.height);
            resolve(stripCanvas.toDataURL('image/jpeg', 0.95));
          };
          img1.onload = onLoad;
          img2.onload = onLoad;
          img1.src = photos[0];
          img2.src = photos[1] ?? photos[0];
        } else {
          const imgs = photos.map((src) => {
            const img = new Image();
            img.src = src;
            return img;
          });
          let loaded = 0;
          const onLoad = () => {
            loaded++;
            if (loaded < 4) return;
            const w = imgs[0].width;
            const h = imgs[0].height;
            stripCanvas.width = w * 2;
            stripCanvas.height = h * 2;
            ctx.drawImage(imgs[0], 0, 0, w, h);
            ctx.drawImage(imgs[1] ?? imgs[0], w, 0, w, h);
            ctx.drawImage(imgs[2] ?? imgs[0], 0, h, w, h);
            ctx.drawImage(imgs[3] ?? imgs[0], w, h, w, h);
            resolve(stripCanvas.toDataURL('image/jpeg', 0.95));
          };
          imgs.forEach((img) => (img.onload = onLoad));
        }
      });
    },
    [photoCount],
  );

  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    playShutter();

    const photo = captureFrame();
    if (!photo) return;

    setCapturedPhotos((prev) => {
      const next = [...prev, photo];
      if (next.length < photoCount) {
        setTimeout(() => setShowCountdown(true), 500);
      } else {
        buildStrip(next).then(onStripReady);
      }
      return next;
    });
  }, [photoCount, captureFrame, buildStrip, playShutter, onStripReady]);

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

      {overlayUrl && (
        <img
          src={overlayUrl}
          className="absolute inset-0 w-full h-full pointer-events-none"
          alt=""
        />
      )}

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
