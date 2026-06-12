import React, { useRef, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Pen, Eraser, RotateCcw, RotateCw, Trash2, 
  Download, Copy, Check, Users, ArrowLeft 
} from 'lucide-react';
import keycloak from '../keycloak';
import jsPDF from 'jspdf';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  userId: string;
  type: 'pen' | 'eraser';
  points: Point[];
  color: string;
  width: number;
}

interface User {
  socketId: string;
  userId: string;
  userName: string;
  color: string;
  cursor?: Point | null;
}

interface WhiteboardProps {
  roomId: string;
  onLeaveRoom: () => void;
}

const Whiteboard: React.FC<WhiteboardProps> = ({ roomId, onLeaveRoom }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const currentStrokePointsRef = useRef<Point[]>([]);

  // Whiteboard States
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#121214');
  const [width, setWidth] = useState(4);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [remoteUsers, setRemoteUsers] = useState<User[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<{ [socketId: string]: Point }>({});
  const [myColor, setMyColor] = useState('#0078d7');
  const [copied, setCopied] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  const userId = keycloak.tokenParsed?.sub || 'anonymous';
  const userName = keycloak.tokenParsed?.given_name || keycloak.tokenParsed?.preferred_username || 'Anonymous';

  // Canvas virtual dimension constants
  const VIRTUAL_WIDTH = 1600;
  const VIRTUAL_HEIGHT = 900;

  // Initialize Socket connection and listeners
  useEffect(() => {
    const socket = io('http://localhost:8081');
    socketRef.current = socket;

    socket.emit('join-room', { roomId, userId, userName });

    socket.on('room-data', ({ strokes: roomStrokes, users: roomUsers, myColor: assignedColor }) => {
      setStrokes(roomStrokes);
      setRemoteUsers(roomUsers.filter((u: User) => u.socketId !== socket.id));
      setMyColor(assignedColor);
    });

    socket.on('user-joined', (user: User) => {
      setRemoteUsers(prev => [...prev, user]);
    });

    socket.on('user-left', ({ socketId }: { socketId: string }) => {
      setRemoteUsers(prev => prev.filter(u => u.socketId !== socketId));
      setRemoteCursors(prev => {
        const copy = { ...prev };
        delete copy[socketId];
        return copy;
      });
    });

    socket.on('stroke-added', (stroke: Stroke) => {
      setStrokes(prev => [...prev, stroke]);
    });

    socket.on('board-updated', ({ strokes: updatedStrokes }: { strokes: Stroke[] }) => {
      setStrokes(updatedStrokes);
    });

    socket.on('segment-added', (data: { prevPoint: Point; currentPoint: Point; color: string; width: number; type: 'pen' | 'eraser' }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawSegment(ctx, data.prevPoint, data.currentPoint, data.color, data.width, data.type);
      }
    });

    socket.on('user-cursor-moved', ({ socketId, cursor }: { socketId: string; cursor: Point }) => {
      setRemoteCursors(prev => ({
        ...prev,
        [socketId]: cursor
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, userId, userName]);

  // Redraw canvas whenever the list of strokes changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawAllStrokes(ctx, strokes);
    }
  }, [strokes]);

  // Handle window resizing to adjust client bounding rect properly
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawAllStrokes(ctx, strokes);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [strokes]);

  // Helper to draw a single path segment on the canvas context
  const drawSegment = (
    ctx: CanvasRenderingContext2D, 
    prev: Point, 
    curr: Point, 
    col: string, 
    w: number, 
    strokeType: 'pen' | 'eraser'
  ) => {
    ctx.beginPath();
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeType === 'eraser' ? '#ffffff' : col;
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
  };

  // Helper to draw all strokes in the board history
  const drawAllStrokes = (ctx: CanvasRenderingContext2D, strokeList: Stroke[]) => {
    ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    strokeList.forEach(stroke => {
      if (stroke.points.length === 0) return;
      ctx.beginPath();
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.type === 'eraser' ? '#ffffff' : stroke.color;
      
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  };

  // Map mouse or touch event coordinates to the fixed virtual dimension
  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = (clientX - rect.left) * (VIRTUAL_WIDTH / rect.width);
    const y = (clientY - rect.top) * (VIRTUAL_HEIGHT / rect.height);
    
    return { x, y };
  };

  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCoordinates(e);
    if (!coords) return;

    isDrawingRef.current = true;
    lastPointRef.current = coords;
    currentStrokePointsRef.current = [coords];

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawSegment(ctx, coords, coords, tool === 'eraser' ? '#ffffff' : color, width, tool);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCoordinates(e);
    if (!coords) return;

    // Emit user's current mouse position (throttled implicitly by browser animation frame / events)
    if (socketRef.current) {
      socketRef.current.emit('mouse-move', coords);
    }

    if (!isDrawingRef.current || !lastPointRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const activeColor = tool === 'eraser' ? '#ffffff' : color;
      
      // Draw segment locally
      drawSegment(ctx, lastPointRef.current, coords, activeColor, width, tool);
      
      // Stream segment to socket server
      if (socketRef.current) {
        socketRef.current.emit('draw-segment', {
          prevPoint: lastPointRef.current,
          currentPoint: coords,
          color: activeColor,
          width,
          type: tool
        });
      }

      currentStrokePointsRef.current.push(coords);
      lastPointRef.current = coords;
    }
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentStrokePointsRef.current.length > 0) {
      const stroke: Stroke = {
        id: Math.random().toString(36).substring(2, 9),
        userId,
        type: tool,
        points: currentStrokePointsRef.current,
        color: tool === 'eraser' ? '#ffffff' : color,
        width
      };

      // Push stroke to socket server
      if (socketRef.current) {
        socketRef.current.emit('draw-stroke', stroke);
      }

      // Add stroke locally
      setStrokes(prev => [...prev, stroke]);
    }

    lastPointRef.current = null;
    currentStrokePointsRef.current = [];
  };

  // Whiteboard control operations
  const handleUndo = () => {
    if (socketRef.current) {
      socketRef.current.emit('undo', { userId });
    }
  };

  const handleRedo = () => {
    if (socketRef.current) {
      socketRef.current.emit('redo', { userId });
    }
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the entire whiteboard?')) {
      if (socketRef.current) {
        socketRef.current.emit('clear-board');
      }
    }
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export board functions
  const exportAsImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a temporary canvas with a dark background to save instead of transparent
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = VIRTUAL_WIDTH;
    tempCanvas.height = VIRTUAL_HEIGHT;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
      // Draw background
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      
      // Draw standard grid
      tempCtx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      for (let x = 0; x < VIRTUAL_WIDTH; x += 24) {
        for (let y = 0; y < VIRTUAL_HEIGHT; y += 24) {
          tempCtx.fillRect(x, y, 1, 1);
        }
      }
      
      // Redraw drawing strokes
      drawAllStrokes(tempCtx, strokes);

      const dataUrl = tempCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `whiteboard-${roomId}.png`;
      link.href = dataUrl;
      link.click();
    }
    setShowExportDropdown(false);
  };

  const exportAsPDF = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a temporary canvas with background for PDF rendering
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = VIRTUAL_WIDTH;
    tempCanvas.height = VIRTUAL_HEIGHT;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      
      // Draw grid
      tempCtx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      for (let x = 0; x < VIRTUAL_WIDTH; x += 24) {
        for (let y = 0; y < VIRTUAL_HEIGHT; y += 24) {
          tempCtx.fillRect(x, y, 1, 1);
        }
      }

      drawAllStrokes(tempCtx, strokes);

      const dataUrl = tempCanvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [VIRTUAL_WIDTH, VIRTUAL_HEIGHT]
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      pdf.save(`whiteboard-${roomId}.pdf`);
    }
    setShowExportDropdown(false);
  };

  const colors = [
    '#121214', // Charcoal / Black
    '#e81123', // Red
    '#0078d7', // Blue
    '#107c41', // Green
    '#ffb900', // Yellow
    '#b4009e', // Magenta
    '#00b7c3', // Cyan
  ];

  const widths = [2, 4, 8, 16, 24];

  return (
    <div className="container-fluid min-vh-100 d-flex flex-column p-0 overflow-hidden" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      {/* Header bar */}
      <header className="whiteboard-header glass-panel border-0 border-bottom border-secondary border-opacity-15 rounded-0 px-3 py-2" style={{ backgroundColor: '#ffffff' }}>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-tool btn-sm" onClick={onLeaveRoom} title="Back to Dashboard">
            <ArrowLeft size={20} />
          </button>
          <div className="d-flex flex-column ms-1">
            <h5 className="m-0 fw-bold d-flex align-items-center gap-2">
              <span>Whiteboard</span>
              <span className="badge bg-secondary bg-opacity-10 text-dark border border-secondary border-opacity-20 font-monospace small">
                {roomId}
              </span>
            </h5>
          </div>
        </div>

        {/* Room sharing link and active participants */}
        <div className="d-flex align-items-center gap-2">
          {/* Invite Code button */}
          <button 
            onClick={handleCopyInvite} 
            className="btn btn-light border border-secondary border-opacity-20 hover-bg-light-opacity-5 d-flex align-items-center gap-2 px-3 py-1.5 rounded-3 btn-sm text-dark"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            <span className="small d-none d-md-inline">{copied ? 'Copied ID!' : 'Copy Session ID'}</span>
          </button>

          <span className="border-start border-secondary border-opacity-30 mx-1 align-self-stretch"></span>

          {/* Connected users indicator */}
          <div className="d-flex align-items-center gap-2 ms-2">
            <div className="d-flex align-items-center gap-1.5 text-secondary small bg-light px-2 py-1.5 rounded-3 border border-secondary border-opacity-20">
              <Users size={15} />
              <span className="fw-semibold text-dark ms-1">{remoteUsers.length + 1}</span>
            </div>
            {/* Active user circles */}
            <div className="d-none d-sm-flex align-items-center -space-x-2 ms-1">
              <div 
                className="rounded-circle border border-dark d-flex align-items-center justify-content-center text-white font-weight-bold" 
                style={{ 
                  backgroundColor: myColor, 
                  width: 28, 
                  height: 28, 
                  fontSize: 11,
                  marginLeft: -6,
                  zIndex: 10
                }}
                title={`${userName} (You)`}
              >
                {userName.charAt(0).toUpperCase()}
              </div>
              {remoteUsers.map((user, idx) => (
                <div 
                  key={user.socketId}
                  className="rounded-circle border border-dark d-flex align-items-center justify-content-center text-white font-weight-bold" 
                  style={{ 
                    backgroundColor: user.color, 
                    width: 28, 
                    height: 28, 
                    fontSize: 11,
                    marginLeft: -6,
                    zIndex: 9 - idx
                  }}
                  title={user.userName}
                >
                  {user.userName.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Board view */}
      <div className="canvas-container flex-grow-1">
        <canvas
          ref={canvasRef}
          width={VIRTUAL_WIDTH}
          height={VIRTUAL_HEIGHT}
          className="whiteboard-canvas"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {/* Overlay showing active cursor positions of remote users */}
        <div className="remote-cursor-container">
          {remoteUsers.map(u => {
            const cursor = remoteCursors[u.socketId];
            if (!cursor) return null;

            // Compute coordinates as percentages of the canvas viewport
            const leftPct = (cursor.x / VIRTUAL_WIDTH) * 100;
            const topPct = (cursor.y / VIRTUAL_HEIGHT) * 100;

            return (
              <div 
                key={u.socketId} 
                className="remote-cursor"
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              >
                <div 
                  className="remote-cursor-pointer" 
                  style={{ borderTopColor: u.color }} 
                />
                <div 
                  className="remote-cursor-label" 
                  style={{ backgroundColor: u.color }}
                >
                  {u.userName}
                </div>
              </div>
            );
          })}
        </div>

        {/* Center Floating Whiteboard Toolbar */}
        <div className="whiteboard-toolbar glass-panel">
          {/* Pen Tool */}
          <button 
            className={`btn-tool ${tool === 'pen' ? 'active' : ''}`}
            onClick={() => setTool('pen')}
            title="Pen Tool"
          >
            <Pen size={18} />
          </button>

          {/* Eraser Tool */}
          <button 
            className={`btn-tool ${tool === 'eraser' ? 'active' : ''}`}
            onClick={() => setTool('eraser')}
            title="Eraser Tool"
          >
            <Eraser size={18} />
          </button>

          <span className="border-start border-secondary border-opacity-30 h-25 mx-1"></span>

          {/* Color Palette (Disabled if Eraser is active) */}
          <div className="d-flex align-items-center gap-1.5 px-1">
            {colors.map(col => (
              <button
                key={col}
                className="rounded-circle border-0 p-0 transition-transform"
                style={{ 
                  backgroundColor: col, 
                  width: 20, 
                  height: 20,
                  transform: (color === col && tool === 'pen') ? 'scale(1.25)' : 'scale(1)',
                  boxShadow: (color === col && tool === 'pen') ? '0 0 8px white' : 'none',
                  opacity: tool === 'eraser' ? 0.3 : 1,
                  cursor: tool === 'eraser' ? 'not-allowed' : 'pointer'
                }}
                onClick={() => {
                  if (tool === 'pen') setColor(col);
                }}
                disabled={tool === 'eraser'}
                title={`Color: ${col}`}
              />
            ))}
          </div>

          <span className="border-start border-secondary border-opacity-30 h-25 mx-1"></span>

          {/* Brush Sizes */}
          <div className="d-flex align-items-center gap-2 px-1">
            {widths.map(w => (
              <button
                key={w}
                className="btn-tool p-0 rounded-circle border-0 d-flex align-items-center justify-content-center bg-transparent text-secondary hover-bg-light-opacity-5"
                style={{ 
                  width: 22, 
                  height: 22,
                }}
                onClick={() => setWidth(w)}
                title={`Brush size: ${w}px`}
              >
                <div 
                  className="rounded-circle"
                  style={{ 
                    backgroundColor: width === w ? 'var(--accent-color)' : 'var(--text-secondary)',
                    width: Math.max(3, w * 0.75), 
                    height: Math.max(3, w * 0.75),
                    maxHeight: 14,
                    maxWidth: 14
                  }} 
                />
              </button>
            ))}
          </div>

          <span className="border-start border-secondary border-opacity-30 h-25 mx-1"></span>

          {/* Undo Button */}
          <button 
            className="btn-tool"
            onClick={handleUndo}
            title="Undo last action"
          >
            <RotateCcw size={18} />
          </button>

          {/* Redo Button */}
          <button 
            className="btn-tool"
            onClick={handleRedo}
            title="Redo last action"
          >
            <RotateCw size={18} />
          </button>

          {/* Clear Button */}
          <button 
            className="btn-tool text-danger hover-bg-danger-opacity-10"
            onClick={handleClear}
            title="Clear Board"
          >
            <Trash2 size={18} />
          </button>

          <span className="border-start border-secondary border-opacity-30 h-25 mx-1"></span>

          {/* Export Dropdown */}
          <div className="position-relative">
            <button 
              className="btn-tool"
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              title="Export Whiteboard"
            >
              <Download size={18} />
            </button>
            
            {showExportDropdown && (
              <div 
                className="position-absolute bg-dark border border-secondary border-opacity-30 rounded-3 shadow-lg p-1.5"
                style={{ 
                  bottom: '52px', 
                  right: '0', 
                  minWidth: '150px',
                  zIndex: 2000
                }}
              >
                <button 
                  className="btn btn-dark text-start w-100 py-1.5 px-3 border-0 small text-light rounded-2"
                  onClick={exportAsImage}
                >
                  Save as PNG
                </button>
                <button 
                  className="btn btn-dark text-start w-100 py-1.5 px-3 border-0 small text-light rounded-2"
                  onClick={exportAsPDF}
                >
                  Save as PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Whiteboard;
