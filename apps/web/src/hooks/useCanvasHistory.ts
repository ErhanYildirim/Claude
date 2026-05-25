import { useState, useCallback, useRef } from "react";
import type { Node, Edge } from "@xyflow/react";

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

export function useCanvasHistory(initialNodes: Node[], initialEdges: Edge[]) {
  const past   = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);

  const [, forceRender] = useState(0);
  const rerender = () => forceRender(n => n + 1);

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;

  const pushHistory = useCallback((nodes: Node[], edges: Edge[]) => {
    past.current = [...past.current.slice(-MAX_HISTORY + 1), { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }];
    future.current = [];
    rerender();
  }, []);

  const undo = useCallback((currentNodes: Node[], currentEdges: Edge[]): Snapshot | null => {
    if (past.current.length === 0) return null;
    const prev = past.current[past.current.length - 1];
    past.current = past.current.slice(0, -1);
    future.current = [{ nodes: JSON.parse(JSON.stringify(currentNodes)), edges: JSON.parse(JSON.stringify(currentEdges)) }, ...future.current.slice(0, MAX_HISTORY - 1)];
    rerender();
    return prev;
  }, []);

  const redo = useCallback((currentNodes: Node[], currentEdges: Edge[]): Snapshot | null => {
    if (future.current.length === 0) return null;
    const next = future.current[0];
    future.current = future.current.slice(1);
    past.current = [...past.current.slice(-MAX_HISTORY + 1), { nodes: JSON.parse(JSON.stringify(currentNodes)), edges: JSON.parse(JSON.stringify(currentEdges)) }];
    rerender();
    return next;
  }, []);

  return { canUndo, canRedo, pushHistory, undo, redo };
}
