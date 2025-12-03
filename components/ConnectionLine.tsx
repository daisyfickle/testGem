import React from 'react';
import { Position } from '../types';

interface ConnectionLineProps {
  start: Position;
  end: Position;
  isTemp?: boolean;
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({ start, end, isTemp = false }) => {
  // Calculate control points for a smooth Bezier curve
  const deltaX = Math.abs(end.x - start.x);
  const controlPointOffset = Math.max(deltaX * 0.5, 50);

  const cp1 = { x: start.x + controlPointOffset, y: start.y };
  const cp2 = { x: end.x - controlPointOffset, y: end.y };

  const path = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;

  return (
    <g>
      {/* Shadow/Outline for visibility on dark background */}
      <path
        d={path}
        stroke="#0f172a"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Actual Line */}
      <path
        d={path}
        stroke={isTemp ? "#60a5fa" : "#94a3b8"} // Blue for dragging, Slate for established
        strokeWidth="3"
        fill="none"
        strokeDasharray={isTemp ? "5,5" : "none"}
        className="pointer-events-none transition-colors duration-300"
      />
      {/* Arrowhead at the end (optional, simulated with a circle for now) */}
       {!isTemp && <circle cx={end.x} cy={end.y} r="3" fill="#94a3b8" />}
    </g>
  );
};