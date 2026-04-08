// apps/totem/src/components/CameraEngine.tsx

import React, { useRef, useState, useCallback } from 'react';
import { useWebcam } from '../hooks/useWebcam';

interface Props {
  overlayUrl?: string; // PNG Frame URL
  sessionId: string;
  onPhotoTaken?: (dataUrl: string) => void;
}

export const CameraEngine: React.FC<Props> = ({ overlayUrl, sessionId, onPhotoTaken }) => {
  const { videoRef, error, isLoading } = useWebcam();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayImageRef = useRef<HTMLImageElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // 1. Match canvas size to video stream
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 2. Layer 1: Draw Video (Mirrored)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    // 3. Layer 2: Draw Overlay (PNG Frame)
    if (overlayUrl && overlayImageRef.current) {
      ctx.drawImage(overlayImageRef.current, 0, 0, canvas.width, canvas.height);
    }

    // 4. Export to DataURL (JPEG Quality 0.95)
    const photoBase64 = canvas.toDataURL('image/jpeg', 0.95);

    // 5. Send to Electron for Printing & Offline Save
    if ((window as any).totemAPI) {
      (window as any).totemAPI.saveOfflinePhoto({
        sessionId,
        photoBase64,
      });
      (window as any).totemAPI.printPhoto();
    }

    onPhotoTaken?.(photoBase64);
    setIsCapturing(false);
  }, [overlayUrl, sessionId, isCapturing, onPhotoTaken]);

  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (isLoading) return <div className="text-white">Iniciando câmera...</div>;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
      {/* Hidden reference elements */}
      <canvas ref={canvasRef} className="hidden" />
      {overlayUrl && (
        <img
          ref={overlayImageRef}
          src={overlayUrl}
          className="hidden"
          alt="overlay-frame"
          crossOrigin="anonymous"
        />
      )}

      {/* Live Video (Mirrored via CSS) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover transform scale-x-[-1]"
      />

      {/* Capture UI overlay */}
      <div className="absolute bottom-10 flex flex-col items-center">
        <button
          onClick={capturePhoto}
          disabled={isCapturing}
          className={`w-20 h-20 rounded-full border-4 border-white ${
            isCapturing ? 'bg-gray-500' : 'bg-red-500'
          } shadow-lg transition-transform active:scale-95`}
        />
        <p className="mt-2 text-white font-bold text-lg">Tirar Foto</p>
      </div>

      {/* Visual PNG Frame Overlay for the user (feedback) */}
      {overlayUrl && (
        <img
          src={overlayUrl}
          className="absolute inset-0 w-full h-full pointer-events-none"
          alt="frame-preview"
        />
      )}
    </div>
  );
};
