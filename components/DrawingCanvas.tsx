
import React, { useRef, useEffect, useCallback } from 'react';

interface DrawingCanvasProps {
  color: string;
  brushSize: number;
  tool: 'brush' | 'eraser';
  onStrokeEnd: (sketchData: string) => void;
  onRealTimeUpdate?: (sketchData: string) => void;
  aspectRatio: string;
  scale: number;
  offset: { x: number; y: number };
  onTransformChange: (scale: number, offset: { x: number; y: number }) => void;
  backgroundImage?: string | null;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  color,
  brushSize,
  tool,
  onStrokeEnd,
  onRealTimeUpdate,
  aspectRatio,
  scale,
  offset,
  onTransformChange,
  backgroundImage
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const isSpacePressed = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastSnapshotTime = useRef(0);

  const getCtx = () => {
    const c = canvasRef.current;
    if (!c) return null;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    return ctx;
  };

  const setupCanvases = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const BASE = 1024;
    let width = BASE;
    let height = BASE;

    switch (aspectRatio) {
      case '16:9': height = Math.round(BASE * (9 / 16)); break;
      case '9:16': width = Math.round(BASE * (9 / 16)); break;
      case '4:3': height = Math.round(BASE * (3 / 4)); break;
      case '3:4': width = Math.round(BASE * (3 / 4)); break;
      default: break;
    }

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }, [aspectRatio]);

  useEffect(() => {
    setupCanvases();
    const handleKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') isSpacePressed.current = true; };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') isSpacePressed.current = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setupCanvases]);

  const getCoords = (e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };

  const captureCanvas = () => {
    if (canvasRef.current) {
      const sExport = document.createElement('canvas');
      sExport.width = canvasRef.current.width;
      sExport.height = canvasRef.current.height;
      const sCtx = sExport.getContext('2d');
      if (sCtx) {
        // If there's a background image, draw it first
        if (backgroundImage) {
          // Create temp image element to load and draw the background
          const img = new Image();
          img.src = backgroundImage;
          // Draw background image to fill the canvas
          sCtx.drawImage(img, 0, 0, sExport.width, sExport.height);
        } else {
          // No background image, fill with white
          sCtx.fillStyle = 'white';
          sCtx.fillRect(0, 0, sExport.width, sExport.height);
        }
        // Then draw the user's strokes on top
        sCtx.drawImage(canvasRef.current, 0, 0);
      }
      return sExport.toDataURL('image/png');
    }
    return '';
  };

  const handleStart = (e: any) => {
    const isTouch = e.type === 'touchstart';
    const native = isTouch ? e.touches[0] : e;

    if (isSpacePressed.current || e.button === 1 || (isTouch && e.touches.length > 1)) {
      isPanning.current = true;
      lastMousePos.current = { x: native.clientX, y: native.clientY };
      return;
    }

    isDrawing.current = true;
    const coords = getCoords(e);
    const ctx = getCtx();
    if (ctx) {
      const resScale = canvasRef.current!.width / 1024;
      const size = brushSize * resScale;

      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);

      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = size * 2;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
      }
    }
  };

  const handleMove = (e: any) => {
    const isTouch = e.type === 'touchmove';
    const native = isTouch ? e.touches[0] : e;

    if (isPanning.current) {
      onTransformChange(scale, {
        x: offset.x + (native.clientX - lastMousePos.current.x),
        y: offset.y + (native.clientY - lastMousePos.current.y)
      });
      lastMousePos.current = { x: native.clientX, y: native.clientY };
      return;
    }

    if (!isDrawing.current) return;
    if (e.cancelable) e.preventDefault();

    const coords = getCoords(e);
    const ctx = getCtx();
    if (ctx) {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      // Real-Time Throttled Update (approx every 800ms)
      const now = Date.now();
      if (now - lastSnapshotTime.current > 800 && onRealTimeUpdate) {
        lastSnapshotTime.current = now;
        onRealTimeUpdate(captureCanvas());
      }
    }
  };

  const handleEnd = () => {
    if (isPanning.current) { isPanning.current = false; return; }
    if (!isDrawing.current) return;
    isDrawing.current = false;

    // Always fire full update on end
    onStrokeEnd(captureCanvas());
  };

  useEffect(() => {
    const onWinMove = (e: MouseEvent | TouchEvent) => handleMove(e);
    const onWinEnd = () => handleEnd();
    window.addEventListener('mousemove', onWinMove);
    window.addEventListener('mouseup', onWinEnd);
    window.addEventListener('touchmove', onWinMove, { passive: false });
    window.addEventListener('touchend', onWinEnd);
    return () => {
      window.removeEventListener('mousemove', onWinMove);
      window.removeEventListener('mouseup', onWinEnd);
      window.removeEventListener('touchmove', onWinMove);
      window.removeEventListener('touchend', onWinEnd);
    };
  }, [tool, color, brushSize, scale, offset, backgroundImage, onStrokeEnd, onRealTimeUpdate]);

  const clearAll = () => {
    const ctx = getCtx();
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      onStrokeEnd(captureCanvas());
    }
  };

  return (
    <div className="w-full h-full relative group overflow-hidden select-none touch-none bg-white">
      <div
        className="origin-top-left relative"
        style={{
          width: '100%',
          height: '100%',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: isPanning.current ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        <div className="absolute inset-0 bg-white" />
        {backgroundImage && (
          <div className="absolute inset-0 bg-contain bg-center bg-no-repeat opacity-50" style={{ backgroundImage: `url(${backgroundImage})` }} />
        )}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-10 pointer-events-none" />
        <div
          className="absolute inset-0 z-30 cursor-crosshair pointer-events-auto"
          onMouseDown={handleStart}
          onTouchStart={handleStart}
        />
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 p-1.5 bg-black/90 backdrop-blur-md border border-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-all z-40 shadow-2xl scale-95 group-hover:scale-100">
        <button onClick={() => onTransformChange(Math.max(0.2, scale - 0.2), offset)} className="p-2 hover:bg-white/10 rounded-xl text-slate-300">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
        </button>
        <span className="text-[10px] font-black w-10 text-center text-indigo-400 font-mono">{Math.round(scale * 100)}%</span>
        <button onClick={() => onTransformChange(Math.min(8, scale + 0.2), offset)} className="p-2 hover:bg-white/10 rounded-xl text-slate-300">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </button>
        <div className="w-px h-4 bg-white/10" />
        <button onClick={clearAll} className="p-2 hover:bg-red-500/20 text-red-400 rounded-xl" title="Clear Canvas">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2.001 16.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
        </button>
      </div>
    </div>
  );
};

export default DrawingCanvas;
