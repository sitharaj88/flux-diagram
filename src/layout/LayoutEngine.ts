/**
 * Layout Engine - Auto-layout algorithms for fluxdiagram nodes
 */

import type { FlowNode, FlowEdge, Position, LayoutDirection } from '../types';

export interface LayoutOptions {
    direction?: LayoutDirection;
    nodeSpacing?: number;
    levelSpacing?: number;
    animate?: boolean;
}

export class LayoutEngine {
    /**
     * Hierarchical layout (Sugiyama-style)
     * Best for fluxdiagrams with clear direction
     */
    static hierarchical(
        nodes: FlowNode[],
        edges: FlowEdge[],
        options: LayoutOptions = {}
    ): Map<string, Position> {
        const direction = options.direction ?? 'TB';
        const nodeSpacing = options.nodeSpacing ?? 180;
        const levelSpacing = options.levelSpacing ?? 120;

        const positions = new Map<string, Position>();

        if (nodes.length === 0) { return positions; }

        // Build adjacency for outgoing edges
        const outgoing = new Map<string, string[]>();
        const incoming = new Map<string, string[]>();

        nodes.forEach((n) => {
            outgoing.set(n.id, []);
            incoming.set(n.id, []);
        });

        edges.forEach((e) => {
            outgoing.get(e.source.nodeId)?.push(e.target.nodeId);
            incoming.get(e.target.nodeId)?.push(e.source.nodeId);
        });

        // Find root nodes (no incoming edges)
        const roots = nodes.filter((n) => (incoming.get(n.id)?.length ?? 0) === 0);
        if (roots.length === 0) {
            // Fallback: use first node as root
            const firstNode = nodes[0];
            if (firstNode) { roots.push(firstNode); }
        }

        // Assign levels via BFS
        const levels = new Map<string, number>();
        const queue: Array<{ id: string; level: number }> = [];

        roots.forEach((r) => queue.push({ id: r.id, level: 0 }));

        while (queue.length > 0) {
            const { id, level } = queue.shift()!;

            if (levels.has(id)) {
                // Already visited, use max level
                levels.set(id, Math.max(levels.get(id)!, level));
                continue;
            }

            levels.set(id, level);

            const children = outgoing.get(id) ?? [];
            children.forEach((childId) => {
                if (!levels.has(childId)) {
                    queue.push({ id: childId, level: level + 1 });
                }
            });
        }

        // Handle disconnected nodes
        nodes.forEach((n) => {
            if (!levels.has(n.id)) {
                levels.set(n.id, 0);
            }
        });

        // Group nodes by level
        const levelGroups = new Map<number, FlowNode[]>();
        nodes.forEach((n) => {
            const level = levels.get(n.id) ?? 0;
            if (!levelGroups.has(level)) {
                levelGroups.set(level, []);
            }
            levelGroups.get(level)!.push(n);
        });

        // Position nodes
        const maxLevel = Math.max(...Array.from(levels.values()));

        levelGroups.forEach((levelNodes, level) => {
            const totalWidth = (levelNodes.length - 1) * nodeSpacing;
            const startX = -totalWidth / 2;

            levelNodes.forEach((node, index) => {
                let x: number, y: number;

                switch (direction) {
                    case 'TB':
                        x = startX + index * nodeSpacing;
                        y = level * levelSpacing;
                        break;
                    case 'BT':
                        x = startX + index * nodeSpacing;
                        y = (maxLevel - level) * levelSpacing;
                        break;
                    case 'LR':
                        x = level * levelSpacing;
                        y = startX + index * nodeSpacing;
                        break;
                    case 'RL':
                        x = (maxLevel - level) * levelSpacing;
                        y = startX + index * nodeSpacing;
                        break;
                    default:
                        x = startX + index * nodeSpacing;
                        y = level * levelSpacing;
                }

                positions.set(node.id, { x, y });
            });
        });

        return positions;
    }

    /**
     * Force-directed layout
     * Good for organic, balanced layouts
     */
    static forceDirected(
        nodes: FlowNode[],
        edges: FlowEdge[],
        options: LayoutOptions = {}
    ): Map<string, Position> {
        const nodeSpacing = options.nodeSpacing ?? 200;
        const iterations = 100;

        const positions = new Map<string, Position>();

        if (nodes.length === 0) { return positions; }

        // Initialize random positions
        nodes.forEach((n, i) => {
            const angle = (2 * Math.PI * i) / nodes.length;
            const radius = nodeSpacing * Math.sqrt(nodes.length);
            positions.set(n.id, {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
            });
        });

        // Build edge lookup
        const connected = new Map<string, Set<string>>();
        nodes.forEach((n) => connected.set(n.id, new Set()));
        edges.forEach((e) => {
            connected.get(e.source.nodeId)?.add(e.target.nodeId);
            connected.get(e.target.nodeId)?.add(e.source.nodeId);
        });

        // Iterate
        for (let iter = 0; iter < iterations; iter++) {
            const temperature = 1 - iter / iterations;
            const forces = new Map<string, Position>();

            nodes.forEach((n) => forces.set(n.id, { x: 0, y: 0 }));

            // Repulsion between all nodes
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const n1 = nodes[i]!;
                    const n2 = nodes[j]!;
                    const p1 = positions.get(n1.id)!;
                    const p2 = positions.get(n2.id)!;

                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);

                    const repulsion = (nodeSpacing * nodeSpacing) / dist;
                    const fx = (dx / dist) * repulsion;
                    const fy = (dy / dist) * repulsion;

                    forces.get(n1.id)!.x -= fx;
                    forces.get(n1.id)!.y -= fy;
                    forces.get(n2.id)!.x += fx;
                    forces.get(n2.id)!.y += fy;
                }
            }

            // Attraction along edges
            edges.forEach((e) => {
                const p1 = positions.get(e.source.nodeId);
                const p2 = positions.get(e.target.nodeId);
                if (!p1 || !p2) { return; }

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                const attraction = dist / nodeSpacing;
                const fx = (dx / dist) * attraction;
                const fy = (dy / dist) * attraction;

                forces.get(e.source.nodeId)!.x += fx;
                forces.get(e.source.nodeId)!.y += fy;
                forces.get(e.target.nodeId)!.x -= fx;
                forces.get(e.target.nodeId)!.y -= fy;
            });

            // Apply forces with cooling
            nodes.forEach((n) => {
                const f = forces.get(n.id)!;
                const p = positions.get(n.id)!;
                const mag = Math.sqrt(f.x * f.x + f.y * f.y);
                const maxMove = nodeSpacing * 0.1 * temperature;

                if (mag > 0) {
                    p.x += (f.x / mag) * Math.min(mag, maxMove);
                    p.y += (f.y / mag) * Math.min(mag, maxMove);
                }
            });
        }

        return positions;
    }

    /**
     * Grid layout
     * Simple uniform grid arrangement
     */
    static grid(
        nodes: FlowNode[],
        _edges: FlowEdge[],
        options: LayoutOptions = {}
    ): Map<string, Position> {
        const nodeSpacing = options.nodeSpacing ?? 200;
        const positions = new Map<string, Position>();

        if (nodes.length === 0) { return positions; }

        const cols = Math.ceil(Math.sqrt(nodes.length));

        nodes.forEach((n, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            positions.set(n.id, {
                x: col * nodeSpacing - (cols * nodeSpacing) / 2,
                y: row * nodeSpacing,
            });
        });

        return positions;
    }

    /**
     * Radial layout
     * Arranges nodes in concentric circles from root
     */
    static radial(
        nodes: FlowNode[],
        edges: FlowEdge[],
        options: LayoutOptions = {}
    ): Map<string, Position> {
        const levelSpacing = options.levelSpacing ?? 150;
        const positions = new Map<string, Position>();

        if (nodes.length === 0) { return positions; }

        // Find root (node with most outgoing edges or first node)
        const outDegree = new Map<string, number>();
        nodes.forEach((n) => outDegree.set(n.id, 0));
        edges.forEach((e) => {
            const count = outDegree.get(e.source.nodeId) ?? 0;
            outDegree.set(e.source.nodeId, count + 1);
        });

        let rootId = nodes[0]?.id;
        let maxOut = 0;
        outDegree.forEach((count, id) => {
            if (count > maxOut) {
                maxOut = count;
                rootId = id;
            }
        });

        // BFS for levels
        const levels = new Map<string, number>();
        const queue = [{ id: rootId!, level: 0 }];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const { id, level } = queue.shift()!;
            if (visited.has(id)) { continue; }
            visited.add(id);
            levels.set(id, level);

            edges.forEach((e) => {
                if (e.source.nodeId === id && !visited.has(e.target.nodeId)) {
                    queue.push({ id: e.target.nodeId, level: level + 1 });
                }
                if (e.target.nodeId === id && !visited.has(e.source.nodeId)) {
                    queue.push({ id: e.source.nodeId, level: level + 1 });
                }
            });
        }

        // Handle disconnected
        nodes.forEach((n) => {
            if (!levels.has(n.id)) { levels.set(n.id, 0); }
        });

        // Group by level
        const levelGroups = new Map<number, string[]>();
        levels.forEach((level, id) => {
            if (!levelGroups.has(level)) { levelGroups.set(level, []); }
            levelGroups.get(level)!.push(id);
        });

        // Position radially
        levelGroups.forEach((ids, level) => {
            const radius = level * levelSpacing;
            ids.forEach((id, i) => {
                const angle = (2 * Math.PI * i) / ids.length - Math.PI / 2;
                positions.set(id, {
                    x: radius * Math.cos(angle),
                    y: radius * Math.sin(angle),
                });
            });
        });

        return positions;
    }
}
