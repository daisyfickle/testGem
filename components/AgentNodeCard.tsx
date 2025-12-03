import React, { useRef, useEffect } from 'react';
import { AgentNode, NodeStatus } from '../types';
import { Trash2, Play, Circle, CheckCircle, Loader2, AlertCircle, Edit3 } from 'lucide-react';

interface AgentNodeCardProps {
  node: AgentNode;
  onUpdate: (id: string, data: Partial<AgentNode['data']>) => void;
  onDelete: (id: string) => void;
  onStartConnection: (id: string) => void;
  onEndConnection: (id: string) => void;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  isSelected: boolean;
}

export const AgentNodeCard: React.FC<AgentNodeCardProps> = ({
  node,
  onUpdate,
  onDelete,
  onStartConnection,
  onEndConnection,
  onMouseDown,
  isSelected,
}) => {
  const { id, data } = node;
  
  // Status Indicator Icon
  const StatusIcon = () => {
    switch (data.status) {
      case 'running': return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return <Circle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div
      className={`absolute w-80 bg-gray-800 border-2 rounded-xl shadow-xl flex flex-col backdrop-blur-sm bg-opacity-95 transition-shadow duration-200 
        ${isSelected ? 'border-blue-500 shadow-blue-500/20' : 'border-gray-700 shadow-black/40'}
      `}
      style={{
        left: node.position.x,
        top: node.position.y,
        cursor: 'grab',
        zIndex: isSelected ? 50 : 10,
      }}
      onMouseDown={(e) => onMouseDown(e, id)}
    >
      {/* --- Input Handle (Target) --- */}
      <div 
        className="absolute -left-3 top-1/2 w-6 h-6 flex items-center justify-center cursor-crosshair group z-50"
        onMouseUp={(e) => {
          e.stopPropagation();
          onEndConnection(id);
        }}
      >
        <div className="w-3 h-3 bg-gray-400 rounded-full border-2 border-gray-800 group-hover:bg-green-400 transition-colors" />
      </div>

      {/* --- Header --- */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-850/50 rounded-t-xl select-none">
        <div className="flex items-center space-x-2">
           <div className={`w-2 h-8 rounded-full ${
             data.status === 'completed' ? 'bg-green-500' : 
             data.status === 'running' ? 'bg-blue-500' : 
             data.status === 'error' ? 'bg-red-500' : 'bg-gray-600'
           }`} />
           <input
             className="bg-transparent text-white font-semibold outline-none w-40 placeholder-gray-500"
             value={data.label}
             onChange={(e) => onUpdate(id, { label: e.target.value })}
             placeholder="Agent Name"
             onMouseDown={(e) => e.stopPropagation()} // Allow text selection
           />
        </div>
        <div className="flex items-center space-x-2">
          <StatusIcon />
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(id); }}
            className="text-gray-500 hover:text-red-400 transition-colors p-1"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* --- Body --- */}
      <div className="p-3 space-y-3 flex-1 flex flex-col">
        {/* System Instruction (Persona) */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-400 flex items-center gap-1">
            <Edit3 size={12} />
            System Persona / Instructions
          </label>
          <textarea
            className="w-full h-24 bg-gray-900 border border-gray-700 rounded-md p-2 text-xs text-gray-200 resize-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="You are a helpful assistant. Be concise."
            value={data.systemInstruction}
            onChange={(e) => onUpdate(id, { systemInstruction: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()} 
          />
        </div>

        {/* Input/Output Display (Read Only) */}
        {(data.input || data.output) && (
          <div className="space-y-2 mt-2 pt-2 border-t border-gray-700">
             {data.input && (
                <div className="text-xs">
                  <span className="text-gray-500 uppercase tracking-wider font-bold">Last Input:</span>
                  <div className="text-gray-400 truncate mt-1 bg-gray-900/50 p-1 rounded">{data.input.substring(0, 50)}{data.input.length > 50 ? '...' : ''}</div>
                </div>
             )}
             {data.output && (
                <div className="text-xs">
                   <span className="text-green-500 uppercase tracking-wider font-bold">Output:</span>
                   <div className="text-gray-200 mt-1 max-h-32 overflow-y-auto bg-gray-900 p-2 rounded border border-gray-700 custom-scrollbar">
                     {data.output}
                   </div>
                </div>
             )}
             {data.errorMessage && (
               <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-900">
                 Error: {data.errorMessage}
               </div>
             )}
          </div>
        )}
      </div>

      {/* --- Output Handle (Source) --- */}
      <div 
        className="absolute -right-3 top-1/2 w-6 h-6 flex items-center justify-center cursor-crosshair group z-50"
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnection(id);
        }}
      >
        <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-gray-800 group-hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/50" />
      </div>
    </div>
  );
};