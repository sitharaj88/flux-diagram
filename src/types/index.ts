/**
 * Core Type Definitions for Fluxdiagram Builder
 * Defines all fundamental types, interfaces, and value objects
 */

// ============================================================================
// Utility Types
// ============================================================================

export type UUID = string;

export interface Position {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Transform {
    x: number;
    y: number;
    scale: number;
}

// ============================================================================
// Node Types
// ============================================================================

export type NodeType =
    | 'rectangle'
    | 'diamond'
    | 'oval'
    | 'parallelogram'
    | 'cylinder'
    | 'document'
    | 'hexagon'
    | 'triangle'
    | 'manual-input'
    | 'delay'
    | 'display'
    | 'connector'
    | 'off-page-connector'
    | 'note'
    | 'group';

export type PortPosition = 'top' | 'right' | 'bottom' | 'left';

export interface Port {
    id: UUID;
    position: PortPosition;
    offset: number; // 0-1, percentage along the edge
    connected: boolean;
}

export interface NodeStyle {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    textColor: string;
    fontSize: number;
    fontFamily: string;
    fontWeight: 'normal' | 'bold';
    textAlign: 'left' | 'center' | 'right';
    opacity: number;
    shadow: boolean;
}

export interface NodeData {
    label: string;
    description?: string;
    icon?: string;
    customData?: Record<string, unknown>;
}

export interface NodeMetadata {
    createdAt: number;
    updatedAt: number;
    locked: boolean;
    visible: boolean;
    zIndex: number;
}

export interface FlowNode {
    id: UUID;
    type: NodeType;
    position: Position;
    size: Size;
    data: NodeData;
    style: NodeStyle;
    ports: Port[];
    metadata: NodeMetadata;
    parentId?: UUID; // For grouped nodes
    layerId?: UUID;
}

// ============================================================================
// Edge Types
// ============================================================================

export type EdgeType = 'bezier' | 'orthogonal' | 'straight' | 'step';

export type ArrowType = 'none' | 'arrow' | 'diamond' | 'circle';

export interface EdgeStyle {
    strokeColor: string;
    strokeWidth: number;
    strokeDasharray?: string;
    animated: boolean;
    opacity: number;
}

export interface EdgeLabel {
    text: string;
    position: number; // 0-1, percentage along the path
    offset: Position;
    style: {
        backgroundColor: string;
        textColor: string;
        fontSize: number;
        padding: number;
        borderRadius: number;
    };
}

export interface EdgeWaypoint {
    x: number;
    y: number;
}

export interface FlowEdge {
    id: UUID;
    type: EdgeType;
    source: {
        nodeId: UUID;
        portId: UUID;
    };
    target: {
        nodeId: UUID;
        portId: UUID;
    };
    waypoints: EdgeWaypoint[];
    style: EdgeStyle;
    label?: EdgeLabel;
    sourceArrow: ArrowType;
    targetArrow: ArrowType;
    metadata: {
        createdAt: number;
        updatedAt: number;
        zIndex: number;
    };
}

// ============================================================================
// Graph Types
// ============================================================================

export interface FluxdiagramMetadata {
    id: UUID;
    name: string;
    description?: string;
    version: string;
    createdAt: number;
    updatedAt: number;
    author?: string;
    tags?: string[];
}

export interface Layer {
    id: UUID;
    name: string;
    visible: boolean;
    locked: boolean;
}

export interface FluxdiagramDocument {
    metadata: FluxdiagramMetadata;
    nodes: FlowNode[];
    edges: FlowEdge[];
    layers: Layer[];
    viewport: Transform;
    settings: FluxdiagramSettings;
}

export interface FluxdiagramSettings {
    gridSize: number;
    showGrid: boolean;
    snapToGrid: boolean;
    showMinimap: boolean;
    theme: 'light' | 'dark' | 'auto';
}

// ============================================================================
// Selection Types
// ============================================================================

export type SelectionType = 'node' | 'edge';

export interface Selection {
    type: SelectionType;
    ids: UUID[];
}

// ============================================================================
// Command Types (for Undo/Redo)
// ============================================================================

export type CommandType =
    | 'ADD_NODE'
    | 'DELETE_NODE'
    | 'MOVE_NODE'
    | 'RESIZE_NODE'
    | 'UPDATE_NODE_DATA'
    | 'UPDATE_NODE_STYLE'
    | 'ADD_EDGE'
    | 'DELETE_EDGE'
    | 'UPDATE_EDGE'
    | 'GROUP_NODES'
    | 'UNGROUP_NODES'
    | 'BATCH';

export interface Command<T = unknown> {
    type: CommandType;
    payload: T;
    timestamp: number;
}

export interface UndoableCommand<T = unknown> extends Command<T> {
    undo: () => void;
    redo: () => void;
}

// ============================================================================
// Event Types
// ============================================================================

export type EventType =
    | 'node:added'
    | 'node:deleted'
    | 'node:updated'
    | 'node:selected'
    | 'node:deselected'
    | 'node:moved'
    | 'node:resized'
    | 'edge:added'
    | 'edge:deleted'
    | 'edge:updated'
    | 'edge:selected'
    | 'edge:deselected'
    | 'viewport:changed'
    | 'selection:changed'
    | 'document:saved'
    | 'document:loaded'
    | 'history:changed';

export interface FlowEvent<T = unknown> {
    type: EventType;
    payload: T;
    timestamp: number;
}

// ============================================================================
// Layout Types
// ============================================================================

export type LayoutType = 'hierarchical' | 'force-directed' | 'radial' | 'grid';

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

export interface LayoutOptions {
    type: LayoutType;
    direction?: LayoutDirection;
    nodeSpacing?: number;
    levelSpacing?: number;
    centerGraph?: boolean;
    animate?: boolean;
}

// ============================================================================
// Export Types
// ============================================================================

export type ExportFormat = 'png' | 'svg' | 'pdf' | 'json';

export interface ExportOptions {
    format: ExportFormat;
    scale?: number;
    backgroundColor?: string;
    padding?: number;
    includeGrid?: boolean;
}

// ============================================================================
// Theme Types
// ============================================================================

export interface Theme {
    name: string;
    colors: {
        background: string;
        surface: string;
        primary: string;
        secondary: string;
        accent: string;
        text: string;
        textMuted: string;
        border: string;
        grid: string;
        selection: string;
        error: string;
        success: string;
        warning: string;
    };
    node: {
        defaultBackground: string;
        defaultBorder: string;
        defaultText: string;
        selectedBorder: string;
        hoverBorder: string;
    };
    edge: {
        defaultStroke: string;
        selectedStroke: string;
        hoverStroke: string;
    };
}

// ============================================================================
// Message Types (Extension <-> Webview Communication)
// ============================================================================

export type MessageType =
    | 'init'
    | 'update'
    | 'command'
    | 'save'
    | 'load'
    | 'export'
    | 'layout'
    | 'zoom'
    | 'selection'
    | 'theme'
    | 'settings'
    | 'error';

export interface WebviewMessage<T = unknown> {
    type: MessageType;
    payload: T;
    requestId?: string;
}
