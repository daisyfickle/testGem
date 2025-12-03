import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AgentNode, Connection, Position, DragState, ConnectionState } from './types';
import { AgentNodeCard } from './components/AgentNodeCard';
import { ConnectionLine } from './components/ConnectionLine';
import { generateAgentResponse } from './services/geminiService';
import { Plus, Play, RotateCcw, Box, Network, Zap } from 'lucide-react';

const INITIAL_NODE: AgentNode = {
  id: 'node-1',
  position: { x: 100, y: 150 },
  data: {
    label: 'Start Agent',
    systemInstruction: 'You are a creative writer. Receive a topic and write a short haiku about it.',
    input: '',
    output: '',
    status: 'idle',
  }
};

export default function App() {
  // --- State ---
  const [nodes, setNodes] = useState<AgentNode[]>([INITIAL_NODE]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [globalInput, setGlobalInput] = useState<string>("Artificial Intelligence");
  
  // Dragging State
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    nodeId: null,
    offset: { x: 0, y: 0 },
  });

  // Connection State
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnecting: false,
    sourceNodeId: null,
    mousePos: { x: 0, y: 0 },
  });

  // UI State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // Can implement panning later, for now just placeholder for math
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const [isRunning, setIsRunning] = useState(false);

  // --- Actions ---

  const addNode = () => {
    const id = `node-${Date.now()}`;
    const newNode: AgentNode = {
      id,
      position: { x: 200 + nodes.length * 20, y: 200 + nodes.length * 20 },
      data: {
        label: `Agent ${nodes.length + 1}`,
        systemInstruction: '',
        input: '',
        output: '',
        status: 'idle',
      },
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setConnections((prev) => prev.filter((c) => c.source !== id && c.target !== id));
  };

  const updateNodeData = (id: string, data: Partial<AgentNode['data']>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)));
  };

  // --- Drag Logic ---

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent canvas drag if we implemented it
    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    // Calculate offset inside the node
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    // Mouse pos relative to canvas
    const mouseX = (e.clientX - canvasRect.left);
    const mouseY = (e.clientY - canvasRect.top);

    setDragState({
      isDragging: true,
      nodeId: id,
      offset: {
        x: mouseX - node.position.x,
        y: mouseY - node.position.y,
      },
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    
    const mouseX = (e.clientX - canvasRect.left);
    const mouseY = (e.clientY - canvasRect.top);

    // Node Dragging
    if (dragState.isDragging && dragState.nodeId) {
      const newX = mouseX - dragState.offset.x;
      const newY = mouseY - dragState.offset.y;

      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragState.nodeId
            ? { ...n, position: { x: newX, y: newY } }
            : n
        )
      );
    }

    // Connection Dragging
    if (connectionState.isConnecting) {
      setConnectionState((prev) => ({
        ...prev,
        mousePos: { x: mouseX, y: mouseY },
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    setDragState({ isDragging: false, nodeId: null, offset: { x: 0, y: 0 } });
    setConnectionState({ isConnecting: false, sourceNodeId: null, mousePos: { x: 0, y: 0 } });
  };

  // --- Connection Logic ---

  const handleStartConnection = (id: string) => {
    setConnectionState({
      isConnecting: true,
      sourceNodeId: id,
      mousePos: { x: 0, y: 0 }, // Will update on first move
    });
  };

  const handleEndConnection = (targetId: string) => {
    if (connectionState.isConnecting && connectionState.sourceNodeId) {
      const sourceId = connectionState.sourceNodeId;

      // Prevent self-loops
      if (sourceId === targetId) return;

      // Prevent duplicate connections
      const exists = connections.some(
        (c) => c.source === sourceId && c.target === targetId
      );

      if (!exists) {
        setConnections((prev) => [
          ...prev,
          { id: `c-${Date.now()}`, source: sourceId, target: targetId },
        ]);
      }
    }
    setConnectionState({ isConnecting: false, sourceNodeId: null, mousePos: { x: 0, y: 0 } });
  };

  // --- Execution Logic ---

  // Helper to find roots (nodes with no incoming connections)
  // Or simply start with nodes that have no incoming connections from other agents
  // and feed them the global input.
  const getRootNodes = () => {
    const targets = new Set(connections.map((c) => c.target));
    return nodes.filter((n) => !targets.has(n.id));
  };

  const runFlow = async () => {
    if (isRunning) return;
    setIsRunning(true);

    // Reset status
    setNodes((prev) => prev.map((n) => ({ ...n, data: { ...n.data, status: 'idle', errorMessage: undefined } })));

    // Queue based execution (BFS)
    // We need to pass data along.
    // Map: NodeId -> InputData[]
    
    // 1. Identify Start Nodes
    const rootNodes = getRootNodes();
    
    if (rootNodes.length === 0 && nodes.length > 0) {
      // If there's a cycle or everything is connected in a loop, pick the first one roughly
      // But for DAGs, this logic works.
      alert("No start node found (a node with no incoming connections).");
      setIsRunning(false);
      return;
    }

    // Queue of { nodeId, inputData }
    const queue: { nodeId: string; input: string }[] = rootNodes.map(n => ({
      nodeId: n.id,
      input: globalInput
    }));

    // Keep track of processing to handle joins? 
    // For simplicity: A node runs when ANY input arrives. 
    // If a node has multiple inputs, it might run multiple times or wait. 
    // Simplification: Immediate trigger per input.
    
    // We need to update state asynchronously, so we can't just use a simple loop on `nodes`.
    // We will use a recursive function that updates state and then triggers children.
    
    // To avoid stale state issues, we will pass data down purely via function args where possible,
    // but we need to update the UI state (Nodes) as we go.
    
    const processQueue = async (currentQueue: { nodeId: string; input: string }[]) => {
      if (currentQueue.length === 0) {
        setIsRunning(false);
        return;
      }

      const nextQueue: { nodeId: string; input: string }[] = [];

      await Promise.all(currentQueue.map(async ({ nodeId, input }) => {
        // 1. Get current node data (from state ref/update)
        // We use a functional update to ensure we aren't overwriting concurrent updates
        
        let currentNode: AgentNode | undefined;
        setNodes(prev => {
           const found = prev.find(n => n.id === nodeId);
           currentNode = found;
           if (!found) return prev;
           return prev.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'running', input: input } } : n);
        });

        if (!currentNode) return; // Should not happen

        // 2. Call API
        try {
          // Retrieve the latest system instruction from the node (we need to read from state carefully)
          // Since setNodes is async, 'currentNode' above holds the state BEFORE 'running'. 
          // That's fine for reading systemInstruction.
          
          const systemInstruction = currentNode.data.systemInstruction;
          const output = await generateAgentResponse(input, systemInstruction);

          // 3. Update Node Success
          setNodes(prev => prev.map(n => n.id === nodeId ? { 
            ...n, 
            data: { ...n.data, status: 'completed', output: output } 
          } : n));

          // 4. Find Children
          const outgoingEdges = connections.filter(c => c.source === nodeId);
          for (const edge of outgoingEdges) {
            nextQueue.push({ nodeId: edge.target, input: output });
          }

        } catch (error: any) {
          setNodes(prev => prev.map(n => n.id === nodeId ? { 
            ...n, 
            data: { ...n.data, status: 'error', errorMessage: error.message } 
          } : n));
        }
      }));

      // Continue to next level
      if (nextQueue.length > 0) {
        await processQueue(nextQueue);
      } else {
        setIsRunning(false);
      }
    };

    processQueue(queue);
  };

  const handleReset = () => {
     setNodes(prev => prev.map(n => ({...n, data: {...n.data, status: 'idle', output: '', input: ''}})));
     setIsRunning(false);
  };

  // --- Rendering Helpers ---

  // Calculate center of node for connection lines
  const getNodeCenter = (id: string): Position => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return { x: 0, y: 0 };
    // Node width is roughly w-80 (320px), height varies but handles are centered vertically
    // We need to approximate the handle positions.
    // Input handle: left side (-12px), middle vertical
    // Output handle: right side (+12px), middle vertical
    // Let's assume height is roughly 150px for center calculation, but handles are absolute positioned in CSS.
    // In CSS, handles are top-1/2.
    // Width is 320px (w-80).
    return {
      x: node.position.x,
      y: node.position.y
    };
  };

  const getInputPos = (id: string): Position => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return { x: 0, y: 0 };
    // Handle is at left: -12px, top: ~80px (approx center depending on height). 
    // To be precise, we should probably measure refs, but for this simplified version, let's assume a fixed header height + padding.
    // Actually, CSS says top-1/2. Let's approximate dynamic height logic is hard without refs.
    // We will assume the "connection point" is roughly 120px down from top if extended.
    // BETTER: Let's assume the node is around 200px tall. top-1/2 is +100.
    // However, as content grows, top-1/2 moves.
    // This is the limitation of simple absolute positioning without a layout engine.
    // Hack: We'll assume a fixed offset for the anchor or try to calculate based on rendered DOM if possible.
    // SIMPLIFICATION: We will assume the anchor is at y + 80.
    return { x: node.position.x, y: node.position.y + 80 }; 
  };
  
  const getOutputPos = (id: string): Position => {
     const node = nodes.find((n) => n.id === id);
     if (!node) return { x: 0, y: 0 };
     return { x: node.position.x + 320, y: node.position.y + 80 };
  };

  return (
    <div className="flex h-screen w-screen bg-gray-950 text-white font-sans overflow-hidden">
      
      {/* Sidebar / Toolbar */}
      <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold flex items-center gap-2 text-blue-400">
            <Network className="w-6 h-6" />
            FlowAgent <span className="text-gray-500 font-light">Studio</span>
          </h1>
          <p className="text-xs text-gray-500 mt-2">Design AI agent chains using Gemini.</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-8">
           {/* Global Input */}
           <div className="space-y-3">
             <label className="text-sm font-semibold text-gray-400 flex items-center gap-2">
               <Zap size={14} className="text-yellow-400"/> Initial Input
             </label>
             <textarea 
               className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
               placeholder="Enter the starting prompt for your flow..."
               value={globalInput}
               onChange={(e) => setGlobalInput(e.target.value)}
             />
           </div>

           {/* Controls */}
           <div className="grid grid-cols-2 gap-3">
             <button 
                onClick={addNode}
                className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 p-3 rounded-lg transition-all text-sm font-medium"
             >
               <Plus size={16} /> Add Agent
             </button>
             <button 
                onClick={handleReset}
                className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 p-3 rounded-lg transition-all text-sm font-medium"
             >
               <RotateCcw size={16} /> Reset
             </button>
           </div>
           
           <div className="pt-4 border-t border-gray-800">
             <button 
               onClick={runFlow}
               disabled={isRunning}
               className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-lg shadow-lg transition-all transform active:scale-95
                 ${isRunning 
                   ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                   : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/20'
                 }`}
             >
               {isRunning ? <span className="animate-pulse">Processing...</span> : <><Play fill="currentColor" size={20} /> Run Flow</>}
             </button>
           </div>

           <div className="text-xs text-gray-600 mt-auto pt-10">
              <p>Tips:</p>
              <ul className="list-disc pl-4 space-y-1 mt-1">
                <li>Drag from <span className="text-blue-400">Blue Dot</span> to <span className="text-gray-400">Gray Dot</span> to connect.</li>
                <li>Define specific personas for each agent.</li>
                <li>Output of one agent becomes input for the next.</li>
              </ul>
           </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={canvasRef}
        className="flex-1 relative bg-gray-950 overflow-hidden cursor-crosshair grid-pattern"
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        // Basic zoom support could be added via transform: scale() on a wrapper div
      >
        {/* Connection Lines Layer */}
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-0 overflow-visible">
          {connections.map((conn) => (
            <ConnectionLine
              key={conn.id}
              start={getOutputPos(conn.source)}
              end={getInputPos(conn.target)}
            />
          ))}
          {/* Temporary Line when dragging */}
          {connectionState.isConnecting && connectionState.sourceNodeId && (
            <ConnectionLine
              start={getOutputPos(connectionState.sourceNodeId)}
              end={connectionState.mousePos}
              isTemp
            />
          )}
        </svg>

        {/* Nodes Layer */}
        <div className="absolute inset-0 z-10">
          {nodes.map((node) => (
            <AgentNodeCard
              key={node.id}
              node={node}
              isSelected={dragState.nodeId === node.id}
              onUpdate={updateNodeData}
              onDelete={deleteNode}
              onMouseDown={handleNodeMouseDown}
              onStartConnection={handleStartConnection}
              onEndConnection={handleEndConnection}
            />
          ))}
        </div>
        
        {/* Canvas Controls Overlay */}
        <div className="absolute top-4 right-4 z-20 bg-gray-900/80 backdrop-blur border border-gray-700 p-2 rounded-lg flex items-center space-x-2 text-xs text-gray-400">
           <Box size={14} />
           <span>Canvas</span>
        </div>

      </div>
    </div>
  );
}