/**
 * Utility functions for creating and manipulating nodes
 */

import type {
    FlowNode,
    NodeType,
    NodeStyle,
    NodeData,
    NodeMetadata,
    Port,
    Position,
    Size,
    UUID,
} from '../../types';
import { generateId } from '../../utils/id';

// Default port configurations for each node type
const DEFAULT_PORTS: Record<NodeType, Array<{ position: Port['position']; offset: number }>> = {
    rectangle: [
        { position: 'top', offset: 0.5 },
        { position: 'right', offset: 0.5 },
        { position: 'bottom', offset: 0.5 },
        { position: 'left', offset: 0.5 },
    ],
    diamond: [
        { position: 'top', offset: 0.5 },
        { position: 'right', offset: 0.5 },
        { position: 'bottom', offset: 0.5 },
        { position: 'left', offset: 0.5 },
    ],
    oval: [
        { position: 'top', offset: 0.5 },
        { position: 'right', offset: 0.5 },
        { position: 'bottom', offset: 0.5 },
        { position: 'left', offset: 0.5 },
    ],
    parallelogram: [
        { position: 'top', offset: 0.5 },
        { position: 'right', offset: 0.5 },
        { position: 'bottom', offset: 0.5 },
        { position: 'left', offset: 0.5 },
    ],
    cylinder: [
        { position: 'top', offset: 0.5 },
        { position: 'bottom', offset: 0.5 },
        { position: 'left', offset: 0.5 },
        { position: 'right', offset: 0.5 },
    ],
    document: [
        { position: 'top', offset: 0.5 },
        { position: 'bottom', offset: 0.5 },
        { position: 'left', offset: 0.5 },
        { position: 'right', offset: 0.5 },
    ],
    hexagon: [
        { position: 'top', offset: 0.5 },
        { position: 'right', offset: 0.5 },
        { position: 'bottom', offset: 0.5 },
        { position: 'left', offset: 0.5 },
    ],
    triangle: [
        { position: 'top', offset: 0.5 },
        { position: 'bottom', offset: 0.25 },
        { position: 'bottom', offset: 0.75 },
    ],
    'manual-input': [
        { position: 'top', offset: 0.5 },
        { position: 'right', offset: 0.5 },
        { position: 'bottom', offset: 0.5 },
        { position: 'left', offset: 0.5 },
    ],
    delay: [
        { position: 'top', offset: 0.5 },
        { position: 'right', offset: 0.5 },
        { position: 'bottom', offset: 0.5 },
        { position: 'left', offset: 0.5 },
    ],
    display: [
        { position: 'top', offset: 0.5 },
        { position: 'right', offset: 0.5 },
        { position: 'bottom', offset: 0.5 },
        { position: 'left', offset: 0.5 },
    ],
    connector: [
        { position: 'top', offset: 0.5 },
        { position: 'right', offset: 0.5 },
        { position: 'bottom', offset: 0.5 },
        { position: 'left', offset: 0.5 },
    ],
    'off-page-connector': [
        { position: 'top', offset: 0.5 },
        { position: 'right', offset: 0.5 },
        { position: 'bottom', offset: 0.5 },
        { position: 'left', offset: 0.5 },
    ],
    note: [
        { position: 'top', offset: 0.5 },
        { position: 'right', offset: 0.5 },
        { position: 'bottom', offset: 0.5 },
        { position: 'left', offset: 0.5 },
    ],
    group: [],
};

// Default sizes for each node type
const DEFAULT_SIZES: Record<NodeType, Size> = {
    rectangle: { width: 160, height: 80 },
    diamond: { width: 120, height: 120 },
    oval: { width: 140, height: 70 },
    parallelogram: { width: 160, height: 80 },
    cylinder: { width: 100, height: 120 },
    document: { width: 140, height: 100 },
    hexagon: { width: 140, height: 80 },
    triangle: { width: 120, height: 100 },
    'manual-input': { width: 140, height: 70 },
    delay: { width: 120, height: 80 },
    display: { width: 140, height: 80 },
    connector: { width: 40, height: 40 },
    'off-page-connector': { width: 60, height: 60 },
    note: { width: 120, height: 80 },
    group: { width: 300, height: 200 },
};

export function getDefaultNodeStyle(): NodeStyle {
    return {
        backgroundColor: '#ffffff',
        borderColor: '#6366f1',
        borderWidth: 2,
        borderRadius: 8,
        textColor: '#1e1e2e',
        fontSize: 14,
        fontFamily: 'Roboto, sans-serif',
        fontWeight: 'normal',
        textAlign: 'center',
        opacity: 1,
        shadow: true,
    };
}

export function getDefaultNodeData(label?: string): NodeData {
    return {
        label: label ?? 'New Node',
        description: '',
    };
}

export function getDefaultNodeMetadata(): NodeMetadata {
    const now = Date.now();
    return {
        createdAt: now,
        updatedAt: now,
        locked: false,
        visible: true,
        zIndex: 0,
    };
}

export function createPorts(type: NodeType): Port[] {
    const portConfigs = DEFAULT_PORTS[type] ?? [];
    return portConfigs.map((config) => ({
        id: generateId(),
        position: config.position,
        offset: config.offset,
        connected: false,
    }));
}

export interface CreateNodeOptions {
    id?: UUID;
    type?: NodeType;
    position?: Position;
    size?: Size;
    data?: Partial<NodeData>;
    style?: Partial<NodeStyle>;
    parentId?: UUID;
}

export function createNode(options: CreateNodeOptions = {}): FlowNode {
    const type = options.type ?? 'rectangle';
    const defaultSize = DEFAULT_SIZES[type] ?? { width: 160, height: 80 };

    return {
        id: options.id ?? generateId(),
        type,
        position: options.position ?? { x: 0, y: 0 },
        size: options.size ?? { ...defaultSize },
        data: {
            ...getDefaultNodeData(),
            ...options.data,
        },
        style: {
            ...getDefaultNodeStyle(),
            ...options.style,
        },
        ports: createPorts(type),
        metadata: getDefaultNodeMetadata(),
        parentId: options.parentId,
    };
}

export function cloneNode(node: FlowNode, newPosition?: Position): FlowNode {
    const now = Date.now();
    return {
        ...node,
        id: generateId(),
        position: newPosition ?? {
            x: node.position.x + 20,
            y: node.position.y + 20,
        },
        ports: node.ports.map((port) => ({
            ...port,
            id: generateId(),
            connected: false,
        })),
        metadata: {
            ...node.metadata,
            createdAt: now,
            updatedAt: now,
        },
    };
}

export function updateNode(node: FlowNode, updates: Partial<FlowNode>): FlowNode {
    return {
        ...node,
        ...updates,
        metadata: {
            ...node.metadata,
            ...updates.metadata,
            updatedAt: Date.now(),
        },
    };
}

export function moveNode(node: FlowNode, position: Position): FlowNode {
    return updateNode(node, { position });
}

export function resizeNode(node: FlowNode, size: Size): FlowNode {
    return updateNode(node, { size });
}

export function updateNodeData(node: FlowNode, data: Partial<NodeData>): FlowNode {
    return updateNode(node, {
        data: { ...node.data, ...data },
    });
}

export function updateNodeStyle(node: FlowNode, style: Partial<NodeStyle>): FlowNode {
    return updateNode(node, {
        style: { ...node.style, ...style },
    });
}

export function getNodeBounds(node: FlowNode) {
    return {
        x: node.position.x,
        y: node.position.y,
        width: node.size.width,
        height: node.size.height,
    };
}

export function getNodeCenter(node: FlowNode): Position {
    return {
        x: node.position.x + node.size.width / 2,
        y: node.position.y + node.size.height / 2,
    };
}

export function getPortPosition(node: FlowNode, portId: UUID): Position | null {
    const port = node.ports.find((p) => p.id === portId);
    if (!port) {
        return null;
    }

    const { position, size } = node;
    const { position: portPos, offset } = port;

    switch (portPos) {
        case 'top':
            return { x: position.x + size.width * offset, y: position.y };
        case 'bottom':
            return { x: position.x + size.width * offset, y: position.y + size.height };
        case 'left':
            return { x: position.x, y: position.y + size.height * offset };
        case 'right':
            return { x: position.x + size.width, y: position.y + size.height * offset };
        default:
            return null;
    }
}

export function isPointInNode(point: Position, node: FlowNode): boolean {
    const bounds = getNodeBounds(node);
    return (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
    );
}

export function doNodesOverlap(node1: FlowNode, node2: FlowNode): boolean {
    const b1 = getNodeBounds(node1);
    const b2 = getNodeBounds(node2);

    return !(
        b1.x + b1.width < b2.x ||
        b2.x + b2.width < b1.x ||
        b1.y + b1.height < b2.y ||
        b2.y + b2.height < b1.y
    );
}
