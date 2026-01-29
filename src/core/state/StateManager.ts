/**
 * Centralized State Manager with Undo/Redo support
 * Implements Command Pattern for reversible operations
 */

import type {
    FlowNode,
    FlowEdge,
    FluxdiagramDocument,
    FluxdiagramMetadata,
    FluxdiagramSettings,
    Selection,
    Transform,
    UUID,
    Position,
    Size,
    NodeData,
    NodeStyle,
    EdgeStyle,
} from '../../types';
import { Graph, createNode, createEdge, type CreateNodeOptions, type CreateEdgeOptions } from '../models';
import { EventBus } from '../events';
import { generateId } from '../../utils/id';

// Type aliases for backward compatibility
type FlowchartDocument = FluxdiagramDocument;
type FlowchartMetadata = FluxdiagramMetadata;
type FlowchartSettings = FluxdiagramSettings;

// ============================================================================
// Command Types for Undo/Redo
// ============================================================================

interface BaseCommand {
    id: string;
    timestamp: number;
    description: string;
}

interface AddNodeCommand extends BaseCommand {
    type: 'ADD_NODE';
    node: FlowNode;
}

interface DeleteNodeCommand extends BaseCommand {
    type: 'DELETE_NODE';
    node: FlowNode;
    edges: FlowEdge[]; // Connected edges that were also deleted
}

interface MoveNodeCommand extends BaseCommand {
    type: 'MOVE_NODE';
    nodeId: UUID;
    oldPosition: Position;
    newPosition: Position;
}

interface ResizeNodeCommand extends BaseCommand {
    type: 'RESIZE_NODE';
    nodeId: UUID;
    oldSize: Size;
    newSize: Size;
}

interface UpdateNodeDataCommand extends BaseCommand {
    type: 'UPDATE_NODE_DATA';
    nodeId: UUID;
    oldData: NodeData;
    newData: NodeData;
}

interface UpdateNodeStyleCommand extends BaseCommand {
    type: 'UPDATE_NODE_STYLE';
    nodeId: UUID;
    oldStyle: NodeStyle;
    newStyle: NodeStyle;
}

interface AddEdgeCommand extends BaseCommand {
    type: 'ADD_EDGE';
    edge: FlowEdge;
}

interface DeleteEdgeCommand extends BaseCommand {
    type: 'DELETE_EDGE';
    edge: FlowEdge;
}

interface UpdateEdgeStyleCommand extends BaseCommand {
    type: 'UPDATE_EDGE_STYLE';
    edgeId: UUID;
    oldStyle: EdgeStyle;
    newStyle: EdgeStyle;
}

interface BatchCommand extends BaseCommand {
    type: 'BATCH';
    commands: Command[];
}

type Command =
    | AddNodeCommand
    | DeleteNodeCommand
    | MoveNodeCommand
    | ResizeNodeCommand
    | UpdateNodeDataCommand
    | UpdateNodeStyleCommand
    | AddEdgeCommand
    | DeleteEdgeCommand
    | UpdateEdgeStyleCommand
    | BatchCommand;

// ============================================================================
// State Manager
// ============================================================================

export interface StateManagerOptions {
    undoLimit?: number;
    eventBus?: EventBus;
}

export class StateManager {
    private graph: Graph;
    private metadata: FlowchartMetadata;
    private settings: FlowchartSettings;
    private viewport: Transform;
    private selection: Selection;

    private undoStack: Command[];
    private redoStack: Command[];
    private undoLimit: number;

    private eventBus: EventBus;
    private isDirty: boolean;
    private batchCommands: Command[] | null;

    constructor(options: StateManagerOptions = {}) {
        this.graph = new Graph();
        this.metadata = this.createDefaultMetadata();
        this.settings = this.createDefaultSettings();
        this.viewport = { x: 0, y: 0, scale: 1 };
        this.selection = { type: 'node', ids: [] };

        this.undoStack = [];
        this.redoStack = [];
        this.undoLimit = options.undoLimit ?? 50;

        this.eventBus = options.eventBus ?? new EventBus();
        this.isDirty = false;
        this.batchCommands = null;
    }

    // ==========================================================================
    // Document Management
    // ==========================================================================

    private createDefaultMetadata(): FlowchartMetadata {
        const now = Date.now();
        return {
            id: generateId(),
            name: 'Untitled Flowchart',
            description: '',
            version: '1.0.0',
            createdAt: now,
            updatedAt: now,
        };
    }

    private createDefaultSettings(): FlowchartSettings {
        return {
            gridSize: 20,
            showGrid: true,
            snapToGrid: true,
            showMinimap: true,
            theme: 'auto',
        };
    }

    loadDocument(document: FlowchartDocument): void {
        this.graph = new Graph(document.nodes, document.edges);
        this.metadata = { ...document.metadata };
        this.settings = { ...document.settings };
        this.viewport = { ...document.viewport };
        this.selection = { type: 'node', ids: [] };
        this.undoStack = [];
        this.redoStack = [];
        this.isDirty = false;

        this.eventBus.emit('document:loaded', { document });
    }

    saveDocument(): FlowchartDocument {
        const document: FlowchartDocument = {
            metadata: {
                ...this.metadata,
                updatedAt: Date.now(),
            },
            nodes: this.graph.getAllNodes(),
            edges: this.graph.getAllEdges(),
            layers: [{ id: 'default', name: 'Default Layer', visible: true, locked: false }],
            viewport: { ...this.viewport },
            settings: { ...this.settings },
        };

        this.isDirty = false;
        this.eventBus.emit('document:saved', { document });
        return document;
    }

    toJSON(): FlowchartDocument {
        return this.saveDocument();
    }

    // ==========================================================================
    // Node Operations
    // ==========================================================================

    addNode(options: CreateNodeOptions): FlowNode {
        const node = createNode(options);
        this.graph.addNode(node);

        this.pushCommand({
            type: 'ADD_NODE',
            node,
            description: `Add ${node.type} node`,
        });

        this.eventBus.emit('node:added', { node });
        return node;
    }

    deleteNode(nodeId: UUID): FlowNode | undefined {
        const node = this.graph.getNode(nodeId);
        if (!node) {
            return undefined;
        }

        // Get connected edges before deletion
        const edges = this.graph.getNodeEdges(nodeId);

        // Remove from graph
        this.graph.removeNode(nodeId);

        this.pushCommand({
            type: 'DELETE_NODE',
            node,
            edges,
            description: `Delete ${node.type} node`,
        });

        // Emit events
        edges.forEach((edge) => this.eventBus.emit('edge:deleted', { edge }));
        this.eventBus.emit('node:deleted', { node });

        // Clear selection if deleted node was selected
        if (this.selection.ids.includes(nodeId)) {
            this.setSelection({ type: 'node', ids: this.selection.ids.filter((id) => id !== nodeId) });
        }

        return node;
    }

    moveNode(nodeId: UUID, newPosition: Position): FlowNode | undefined {
        const node = this.graph.getNode(nodeId);
        if (!node) {
            return undefined;
        }

        const oldPosition = { ...node.position };
        const updatedNode = this.graph.updateNode(nodeId, { position: newPosition });

        if (updatedNode) {
            this.pushCommand({
                type: 'MOVE_NODE',
                nodeId,
                oldPosition,
                newPosition,
                description: 'Move node',
            });

            this.eventBus.emit('node:moved', { node: updatedNode, oldPosition, newPosition });
        }

        return updatedNode;
    }

    resizeNode(nodeId: UUID, newSize: Size): FlowNode | undefined {
        const node = this.graph.getNode(nodeId);
        if (!node) {
            return undefined;
        }

        const oldSize = { ...node.size };
        const updatedNode = this.graph.updateNode(nodeId, { size: newSize });

        if (updatedNode) {
            this.pushCommand({
                type: 'RESIZE_NODE',
                nodeId,
                oldSize,
                newSize,
                description: 'Resize node',
            });

            this.eventBus.emit('node:resized', { node: updatedNode, oldSize, newSize });
        }

        return updatedNode;
    }

    updateNodeData(nodeId: UUID, data: Partial<NodeData>): FlowNode | undefined {
        const node = this.graph.getNode(nodeId);
        if (!node) {
            return undefined;
        }

        const oldData = { ...node.data };
        const newData = { ...oldData, ...data };
        const updatedNode = this.graph.updateNode(nodeId, { data: newData });

        if (updatedNode) {
            this.pushCommand({
                type: 'UPDATE_NODE_DATA',
                nodeId,
                oldData,
                newData,
                description: 'Update node data',
            });

            this.eventBus.emit('node:updated', { node: updatedNode });
        }

        return updatedNode;
    }

    updateNodeStyle(nodeId: UUID, style: Partial<NodeStyle>): FlowNode | undefined {
        const node = this.graph.getNode(nodeId);
        if (!node) {
            return undefined;
        }

        const oldStyle = { ...node.style };
        const newStyle = { ...oldStyle, ...style };
        const updatedNode = this.graph.updateNode(nodeId, { style: newStyle });

        if (updatedNode) {
            this.pushCommand({
                type: 'UPDATE_NODE_STYLE',
                nodeId,
                oldStyle,
                newStyle,
                description: 'Update node style',
            });

            this.eventBus.emit('node:updated', { node: updatedNode });
        }

        return updatedNode;
    }

    getNode(nodeId: UUID): FlowNode | undefined {
        return this.graph.getNode(nodeId);
    }

    getAllNodes(): FlowNode[] {
        return this.graph.getAllNodes();
    }

    // ==========================================================================
    // Edge Operations
    // ==========================================================================

    addEdge(options: CreateEdgeOptions): FlowEdge | undefined {
        const edge = createEdge(options);
        const success = this.graph.addEdge(edge);

        if (!success) {
            return undefined;
        }

        this.pushCommand({
            type: 'ADD_EDGE',
            edge,
            description: 'Add edge',
        });

        // Mark ports as connected
        const sourceNode = this.graph.getNode(edge.source.nodeId);
        const targetNode = this.graph.getNode(edge.target.nodeId);
        if (sourceNode) {
            this.graph.updateNode(sourceNode.id, {
                ports: sourceNode.ports.map((p) =>
                    p.id === edge.source.portId ? { ...p, connected: true } : p
                ),
            });
        }
        if (targetNode) {
            this.graph.updateNode(targetNode.id, {
                ports: targetNode.ports.map((p) =>
                    p.id === edge.target.portId ? { ...p, connected: true } : p
                ),
            });
        }

        this.eventBus.emit('edge:added', { edge });
        return edge;
    }

    deleteEdge(edgeId: UUID): FlowEdge | undefined {
        const edge = this.graph.removeEdge(edgeId);
        if (!edge) {
            return undefined;
        }

        this.pushCommand({
            type: 'DELETE_EDGE',
            edge,
            description: 'Delete edge',
        });

        this.eventBus.emit('edge:deleted', { edge });

        // Clear selection if deleted edge was selected
        if (this.selection.type === 'edge' && this.selection.ids.includes(edgeId)) {
            this.setSelection({ type: 'edge', ids: this.selection.ids.filter((id) => id !== edgeId) });
        }

        return edge;
    }

    updateEdgeStyle(edgeId: UUID, style: Partial<EdgeStyle>): FlowEdge | undefined {
        const edge = this.graph.getEdge(edgeId);
        if (!edge) {
            return undefined;
        }

        const oldStyle = { ...edge.style };
        const newStyle = { ...oldStyle, ...style };
        const updatedEdge = this.graph.updateEdge(edgeId, { style: newStyle });

        if (updatedEdge) {
            this.pushCommand({
                type: 'UPDATE_EDGE_STYLE',
                edgeId,
                oldStyle,
                newStyle,
                description: 'Update edge style',
            });

            this.eventBus.emit('edge:updated', { edge: updatedEdge });
        }

        return updatedEdge;
    }

    getEdge(edgeId: UUID): FlowEdge | undefined {
        return this.graph.getEdge(edgeId);
    }

    getAllEdges(): FlowEdge[] {
        return this.graph.getAllEdges();
    }

    // ==========================================================================
    // Selection
    // ==========================================================================

    setSelection(selection: Selection): void {
        const oldSelection = this.selection;
        this.selection = selection;
        this.eventBus.emit('selection:changed', { oldSelection, newSelection: selection });
    }

    clearSelection(): void {
        this.setSelection({ type: 'node', ids: [] });
    }

    getSelection(): Selection {
        return { ...this.selection };
    }

    getSelectedNodes(): FlowNode[] {
        if (this.selection.type !== 'node') {
            return [];
        }
        return this.selection.ids
            .map((id) => this.graph.getNode(id))
            .filter((node): node is FlowNode => node !== undefined);
    }

    getSelectedEdges(): FlowEdge[] {
        if (this.selection.type !== 'edge') {
            return [];
        }
        return this.selection.ids
            .map((id) => this.graph.getEdge(id))
            .filter((edge): edge is FlowEdge => edge !== undefined);
    }

    // ==========================================================================
    // Viewport
    // ==========================================================================

    setViewport(viewport: Partial<Transform>): void {
        const oldViewport = { ...this.viewport };
        this.viewport = { ...this.viewport, ...viewport };
        this.eventBus.emit('viewport:changed', { oldViewport, newViewport: this.viewport });
    }

    getViewport(): Transform {
        return { ...this.viewport };
    }

    // ==========================================================================
    // Settings
    // ==========================================================================

    updateSettings(settings: Partial<FlowchartSettings>): void {
        this.settings = { ...this.settings, ...settings };
    }

    getSettings(): FlowchartSettings {
        return { ...this.settings };
    }

    // ==========================================================================
    // Metadata
    // ==========================================================================

    updateMetadata(metadata: Partial<FlowchartMetadata>): void {
        this.metadata = { ...this.metadata, ...metadata, updatedAt: Date.now() };
    }

    getMetadata(): FlowchartMetadata {
        return { ...this.metadata };
    }

    // ==========================================================================
    // Undo/Redo
    // ==========================================================================

    beginBatch(): void {
        if (this.batchCommands === null) {
            this.batchCommands = [];
        }
    }

    endBatch(description = 'Batch operation'): void {
        if (this.batchCommands === null) {
            return;
        }

        const commands = this.batchCommands;
        this.batchCommands = null;

        if (commands.length === 0) {
            return;
        }

        if (commands.length === 1) {
            const cmd = commands[0];
            if (cmd) {
                this.undoStack.push(cmd);
            }
        } else {
            const batchCommand: BatchCommand = {
                id: generateId(),
                type: 'BATCH',
                timestamp: Date.now(),
                description,
                commands,
            };
            this.undoStack.push(batchCommand);
        }

        this.trimUndoStack();
        this.redoStack = [];
        this.isDirty = true;
        this.eventBus.emit('history:changed', { canUndo: this.canUndo(), canRedo: this.canRedo() });
    }

    private pushCommand(command: { type: string; description: string;[key: string]: unknown }): void {
        const fullCommand = {
            ...command,
            id: generateId(),
            timestamp: Date.now(),
        } as Command;

        if (this.batchCommands !== null) {
            this.batchCommands.push(fullCommand);
        } else {
            this.undoStack.push(fullCommand);
            this.trimUndoStack();
            this.redoStack = [];
            this.isDirty = true;
            this.eventBus.emit('history:changed', { canUndo: this.canUndo(), canRedo: this.canRedo() });
        }
    }

    private trimUndoStack(): void {
        while (this.undoStack.length > this.undoLimit) {
            this.undoStack.shift();
        }
    }

    undo(): boolean {
        const command = this.undoStack.pop();
        if (!command) {
            return false;
        }

        this.executeUndo(command);
        this.redoStack.push(command);
        this.isDirty = true;
        this.eventBus.emit('history:changed', { canUndo: this.canUndo(), canRedo: this.canRedo() });
        return true;
    }

    redo(): boolean {
        const command = this.redoStack.pop();
        if (!command) {
            return false;
        }

        this.executeRedo(command);
        this.undoStack.push(command);
        this.isDirty = true;
        this.eventBus.emit('history:changed', { canUndo: this.canUndo(), canRedo: this.canRedo() });
        return true;
    }

    private executeUndo(command: Command): void {
        switch (command.type) {
            case 'ADD_NODE':
                this.graph.removeNode(command.node.id);
                break;
            case 'DELETE_NODE':
                this.graph.addNode(command.node);
                command.edges.forEach((edge) => this.graph.addEdge(edge));
                break;
            case 'MOVE_NODE':
                this.graph.updateNode(command.nodeId, { position: command.oldPosition });
                break;
            case 'RESIZE_NODE':
                this.graph.updateNode(command.nodeId, { size: command.oldSize });
                break;
            case 'UPDATE_NODE_DATA':
                this.graph.updateNode(command.nodeId, { data: command.oldData });
                break;
            case 'UPDATE_NODE_STYLE':
                this.graph.updateNode(command.nodeId, { style: command.oldStyle });
                break;
            case 'ADD_EDGE':
                this.graph.removeEdge(command.edge.id);
                break;
            case 'DELETE_EDGE':
                this.graph.addEdge(command.edge);
                break;
            case 'UPDATE_EDGE_STYLE':
                this.graph.updateEdge(command.edgeId, { style: command.oldStyle });
                break;
            case 'BATCH':
                // Undo in reverse order
                for (let i = command.commands.length - 1; i >= 0; i--) {
                    const cmd = command.commands[i];
                    if (cmd) {
                        this.executeUndo(cmd);
                    }
                }
                break;
        }
    }

    private executeRedo(command: Command): void {
        switch (command.type) {
            case 'ADD_NODE':
                this.graph.addNode(command.node);
                break;
            case 'DELETE_NODE':
                command.edges.forEach((edge) => this.graph.removeEdge(edge.id));
                this.graph.removeNode(command.node.id);
                break;
            case 'MOVE_NODE':
                this.graph.updateNode(command.nodeId, { position: command.newPosition });
                break;
            case 'RESIZE_NODE':
                this.graph.updateNode(command.nodeId, { size: command.newSize });
                break;
            case 'UPDATE_NODE_DATA':
                this.graph.updateNode(command.nodeId, { data: command.newData });
                break;
            case 'UPDATE_NODE_STYLE':
                this.graph.updateNode(command.nodeId, { style: command.newStyle });
                break;
            case 'ADD_EDGE':
                this.graph.addEdge(command.edge);
                break;
            case 'DELETE_EDGE':
                this.graph.removeEdge(command.edge.id);
                break;
            case 'UPDATE_EDGE_STYLE':
                this.graph.updateEdge(command.edgeId, { style: command.newStyle });
                break;
            case 'BATCH':
                // Redo in original order
                command.commands.forEach((cmd) => this.executeRedo(cmd));
                break;
        }
    }

    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    getUndoDescription(): string | null {
        const command = this.undoStack[this.undoStack.length - 1];
        return command?.description ?? null;
    }

    getRedoDescription(): string | null {
        const command = this.redoStack[this.redoStack.length - 1];
        return command?.description ?? null;
    }

    clearHistory(): void {
        this.undoStack = [];
        this.redoStack = [];
        this.eventBus.emit('history:changed', { canUndo: false, canRedo: false });
    }

    // ==========================================================================
    // Dirty State
    // ==========================================================================

    getIsDirty(): boolean {
        return this.isDirty;
    }

    markClean(): void {
        this.isDirty = false;
    }

    // ==========================================================================
    // Event Bus Access
    // ==========================================================================

    getEventBus(): EventBus {
        return this.eventBus;
    }

    // ==========================================================================
    // Graph Access
    // ==========================================================================

    getGraph(): Graph {
        return this.graph;
    }
}
