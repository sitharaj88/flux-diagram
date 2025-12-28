/**
 * Graph data structure with efficient operations for flowchart management
 */

import type { FlowNode, FlowEdge, UUID, Bounds, Position } from '../../types';
import { getNodeBounds } from './Node';

export class Graph {
    private nodes: Map<UUID, FlowNode>;
    private edges: Map<UUID, FlowEdge>;
    private adjacencyList: Map<UUID, Set<UUID>>; // nodeId -> connected nodeIds
    private nodeEdges: Map<UUID, Set<UUID>>; // nodeId -> connected edgeIds

    constructor(nodes: FlowNode[] = [], edges: FlowEdge[] = []) {
        this.nodes = new Map();
        this.edges = new Map();
        this.adjacencyList = new Map();
        this.nodeEdges = new Map();

        // Initialize with provided data
        nodes.forEach((node) => this.addNode(node));
        edges.forEach((edge) => this.addEdge(edge));
    }

    // ========================================================================
    // Node Operations
    // ========================================================================

    addNode(node: FlowNode): void {
        this.nodes.set(node.id, node);
        this.adjacencyList.set(node.id, new Set());
        this.nodeEdges.set(node.id, new Set());
    }

    removeNode(nodeId: UUID): FlowNode | undefined {
        const node = this.nodes.get(nodeId);
        if (!node) {
            return undefined;
        }

        // Remove all connected edges first
        const connectedEdges = this.getNodeEdges(nodeId);
        connectedEdges.forEach((edge) => this.removeEdge(edge.id));

        // Remove from adjacency list
        this.adjacencyList.delete(nodeId);
        this.nodeEdges.delete(nodeId);

        // Remove references from other nodes
        this.adjacencyList.forEach((connections) => {
            connections.delete(nodeId);
        });

        // Remove the node
        this.nodes.delete(nodeId);
        return node;
    }

    getNode(nodeId: UUID): FlowNode | undefined {
        return this.nodes.get(nodeId);
    }

    updateNode(nodeId: UUID, updates: Partial<FlowNode>): FlowNode | undefined {
        const node = this.nodes.get(nodeId);
        if (!node) {
            return undefined;
        }

        const updatedNode = {
            ...node,
            ...updates,
            id: node.id, // Prevent ID change
        };
        this.nodes.set(nodeId, updatedNode);
        return updatedNode;
    }

    getAllNodes(): FlowNode[] {
        return Array.from(this.nodes.values());
    }

    getNodeCount(): number {
        return this.nodes.size;
    }

    hasNode(nodeId: UUID): boolean {
        return this.nodes.has(nodeId);
    }

    // ========================================================================
    // Edge Operations
    // ========================================================================

    addEdge(edge: FlowEdge): boolean {
        // Validate that source and target nodes exist
        if (!this.nodes.has(edge.source.nodeId) || !this.nodes.has(edge.target.nodeId)) {
            return false;
        }

        this.edges.set(edge.id, edge);

        // Update adjacency list
        this.adjacencyList.get(edge.source.nodeId)?.add(edge.target.nodeId);
        this.adjacencyList.get(edge.target.nodeId)?.add(edge.source.nodeId);

        // Update node edges
        this.nodeEdges.get(edge.source.nodeId)?.add(edge.id);
        this.nodeEdges.get(edge.target.nodeId)?.add(edge.id);

        return true;
    }

    removeEdge(edgeId: UUID): FlowEdge | undefined {
        const edge = this.edges.get(edgeId);
        if (!edge) {
            return undefined;
        }

        // Update adjacency list
        this.adjacencyList.get(edge.source.nodeId)?.delete(edge.target.nodeId);
        this.adjacencyList.get(edge.target.nodeId)?.delete(edge.source.nodeId);

        // Update node edges
        this.nodeEdges.get(edge.source.nodeId)?.delete(edgeId);
        this.nodeEdges.get(edge.target.nodeId)?.delete(edgeId);

        this.edges.delete(edgeId);
        return edge;
    }

    getEdge(edgeId: UUID): FlowEdge | undefined {
        return this.edges.get(edgeId);
    }

    updateEdge(edgeId: UUID, updates: Partial<FlowEdge>): FlowEdge | undefined {
        const edge = this.edges.get(edgeId);
        if (!edge) {
            return undefined;
        }

        const updatedEdge = {
            ...edge,
            ...updates,
            id: edge.id, // Prevent ID change
        };
        this.edges.set(edgeId, updatedEdge);
        return updatedEdge;
    }

    getAllEdges(): FlowEdge[] {
        return Array.from(this.edges.values());
    }

    getEdgeCount(): number {
        return this.edges.size;
    }

    hasEdge(edgeId: UUID): boolean {
        return this.edges.has(edgeId);
    }

    // ========================================================================
    // Relationship Queries
    // ========================================================================

    getNodeEdges(nodeId: UUID): FlowEdge[] {
        const edgeIds = this.nodeEdges.get(nodeId);
        if (!edgeIds) {
            return [];
        }
        return Array.from(edgeIds)
            .map((id) => this.edges.get(id))
            .filter((edge): edge is FlowEdge => edge !== undefined);
    }

    getConnectedNodes(nodeId: UUID): FlowNode[] {
        const connectedIds = this.adjacencyList.get(nodeId);
        if (!connectedIds) {
            return [];
        }
        return Array.from(connectedIds)
            .map((id) => this.nodes.get(id))
            .filter((node): node is FlowNode => node !== undefined);
    }

    getOutgoingEdges(nodeId: UUID): FlowEdge[] {
        return this.getNodeEdges(nodeId).filter((edge) => edge.source.nodeId === nodeId);
    }

    getIncomingEdges(nodeId: UUID): FlowEdge[] {
        return this.getNodeEdges(nodeId).filter((edge) => edge.target.nodeId === nodeId);
    }

    getSuccessors(nodeId: UUID): FlowNode[] {
        return this.getOutgoingEdges(nodeId)
            .map((edge) => this.nodes.get(edge.target.nodeId))
            .filter((node): node is FlowNode => node !== undefined);
    }

    getPredecessors(nodeId: UUID): FlowNode[] {
        return this.getIncomingEdges(nodeId)
            .map((edge) => this.nodes.get(edge.source.nodeId))
            .filter((node): node is FlowNode => node !== undefined);
    }

    findEdgeBetween(sourceNodeId: UUID, targetNodeId: UUID): FlowEdge | undefined {
        return this.getAllEdges().find(
            (edge) => edge.source.nodeId === sourceNodeId && edge.target.nodeId === targetNodeId
        );
    }

    // ========================================================================
    // Graph Analysis
    // ========================================================================

    getRootNodes(): FlowNode[] {
        return this.getAllNodes().filter((node) => this.getIncomingEdges(node.id).length === 0);
    }

    getLeafNodes(): FlowNode[] {
        return this.getAllNodes().filter((node) => this.getOutgoingEdges(node.id).length === 0);
    }

    isConnected(): boolean {
        if (this.nodes.size === 0) {
            return true;
        }

        const visited = new Set<UUID>();
        const firstNode = this.nodes.keys().next().value;
        if (!firstNode) {
            return true;
        }

        // BFS to check connectivity
        const queue: UUID[] = [firstNode];
        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) {
                continue;
            }
            visited.add(current);

            const neighbors = this.adjacencyList.get(current);
            if (neighbors) {
                neighbors.forEach((neighbor) => {
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                });
            }
        }

        return visited.size === this.nodes.size;
    }

    hasCycle(): boolean {
        const visited = new Set<UUID>();
        const recursionStack = new Set<UUID>();

        const dfs = (nodeId: UUID): boolean => {
            visited.add(nodeId);
            recursionStack.add(nodeId);

            const successors = this.getOutgoingEdges(nodeId).map((e) => e.target.nodeId);
            for (const successor of successors) {
                if (!visited.has(successor)) {
                    if (dfs(successor)) {
                        return true;
                    }
                } else if (recursionStack.has(successor)) {
                    return true;
                }
            }

            recursionStack.delete(nodeId);
            return false;
        };

        for (const nodeId of this.nodes.keys()) {
            if (!visited.has(nodeId)) {
                if (dfs(nodeId)) {
                    return true;
                }
            }
        }

        return false;
    }

    topologicalSort(): FlowNode[] | null {
        if (this.hasCycle()) {
            return null;
        }

        const result: FlowNode[] = [];
        const visited = new Set<UUID>();

        const visit = (nodeId: UUID): void => {
            if (visited.has(nodeId)) {
                return;
            }
            visited.add(nodeId);

            this.getSuccessors(nodeId).forEach((successor) => visit(successor.id));

            const node = this.nodes.get(nodeId);
            if (node) {
                result.unshift(node);
            }
        };

        this.nodes.forEach((_, nodeId) => visit(nodeId));
        return result;
    }

    // ========================================================================
    // Spatial Queries
    // ========================================================================

    getBounds(): Bounds | null {
        const nodes = this.getAllNodes();
        if (nodes.length === 0) {
            return null;
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        nodes.forEach((node) => {
            const bounds = getNodeBounds(node);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    getNodesInBounds(bounds: Bounds): FlowNode[] {
        return this.getAllNodes().filter((node) => {
            const nodeBounds = getNodeBounds(node);
            return (
                nodeBounds.x < bounds.x + bounds.width &&
                nodeBounds.x + nodeBounds.width > bounds.x &&
                nodeBounds.y < bounds.y + bounds.height &&
                nodeBounds.y + nodeBounds.height > bounds.y
            );
        });
    }

    getNodeAtPosition(position: Position): FlowNode | undefined {
        // Search from top to bottom (higher zIndex first)
        const sortedNodes = this.getAllNodes().sort(
            (a, b) => b.metadata.zIndex - a.metadata.zIndex
        );

        return sortedNodes.find((node) => {
            const bounds = getNodeBounds(node);
            return (
                position.x >= bounds.x &&
                position.x <= bounds.x + bounds.width &&
                position.y >= bounds.y &&
                position.y <= bounds.y + bounds.height
            );
        });
    }

    // ========================================================================
    // Serialization
    // ========================================================================

    toJSON(): { nodes: FlowNode[]; edges: FlowEdge[] } {
        return {
            nodes: this.getAllNodes(),
            edges: this.getAllEdges(),
        };
    }

    static fromJSON(data: { nodes: FlowNode[]; edges: FlowEdge[] }): Graph {
        return new Graph(data.nodes, data.edges);
    }

    clone(): Graph {
        const data = this.toJSON();
        return new Graph(
            data.nodes.map((n) => ({ ...n })),
            data.edges.map((e) => ({ ...e }))
        );
    }

    clear(): void {
        this.nodes.clear();
        this.edges.clear();
        this.adjacencyList.clear();
        this.nodeEdges.clear();
    }
}

// Re-export node and edge utilities
export * from './Node';
export * from './Edge';
