/**
 * Utility functions for creating and manipulating edges
 */

import type { FlowEdge, EdgeType, EdgeStyle, EdgeLabel, UUID, ArrowType } from '../../types';
import { generateId } from '../../utils/id';

export function getDefaultEdgeStyle(): EdgeStyle {
    return {
        strokeColor: '#6366f1',
        strokeWidth: 2,
        strokeDasharray: undefined,
        animated: false,
        opacity: 1,
    };
}

export interface CreateEdgeOptions {
    id?: UUID;
    type?: EdgeType;
    sourceNodeId: UUID;
    sourcePortId: UUID;
    targetNodeId: UUID;
    targetPortId: UUID;
    style?: Partial<EdgeStyle>;
    label?: EdgeLabel;
    sourceArrow?: ArrowType;
    targetArrow?: ArrowType;
}

export function createEdge(options: CreateEdgeOptions): FlowEdge {
    const now = Date.now();

    return {
        id: options.id ?? generateId(),
        type: options.type ?? 'bezier',
        source: {
            nodeId: options.sourceNodeId,
            portId: options.sourcePortId,
        },
        target: {
            nodeId: options.targetNodeId,
            portId: options.targetPortId,
        },
        waypoints: [],
        style: {
            ...getDefaultEdgeStyle(),
            ...options.style,
        },
        label: options.label,
        sourceArrow: options.sourceArrow ?? 'none',
        targetArrow: options.targetArrow ?? 'arrow',
        metadata: {
            createdAt: now,
            updatedAt: now,
            zIndex: 0,
        },
    };
}

export function cloneEdge(edge: FlowEdge): FlowEdge {
    const now = Date.now();
    return {
        ...edge,
        id: generateId(),
        waypoints: edge.waypoints.map((wp) => ({ ...wp })),
        metadata: {
            ...edge.metadata,
            createdAt: now,
            updatedAt: now,
        },
    };
}

export function updateEdge(edge: FlowEdge, updates: Partial<FlowEdge>): FlowEdge {
    return {
        ...edge,
        ...updates,
        metadata: {
            ...edge.metadata,
            ...updates.metadata,
            updatedAt: Date.now(),
        },
    };
}

export function updateEdgeStyle(edge: FlowEdge, style: Partial<EdgeStyle>): FlowEdge {
    return updateEdge(edge, {
        style: { ...edge.style, ...style },
    });
}

export function updateEdgeLabel(edge: FlowEdge, label: EdgeLabel | undefined): FlowEdge {
    return updateEdge(edge, { label });
}

export function setEdgeType(edge: FlowEdge, type: EdgeType): FlowEdge {
    return updateEdge(edge, { type, waypoints: [] });
}

export function addWaypoint(
    edge: FlowEdge,
    waypoint: { x: number; y: number },
    index?: number
): FlowEdge {
    const waypoints = [...edge.waypoints];
    if (index !== undefined && index >= 0 && index <= waypoints.length) {
        waypoints.splice(index, 0, waypoint);
    } else {
        waypoints.push(waypoint);
    }
    return updateEdge(edge, { waypoints });
}

export function removeWaypoint(edge: FlowEdge, index: number): FlowEdge {
    const waypoints = edge.waypoints.filter((_, i) => i !== index);
    return updateEdge(edge, { waypoints });
}

export function clearWaypoints(edge: FlowEdge): FlowEdge {
    return updateEdge(edge, { waypoints: [] });
}

export function isEdgeConnectedToNode(edge: FlowEdge, nodeId: UUID): boolean {
    return edge.source.nodeId === nodeId || edge.target.nodeId === nodeId;
}

export function getConnectedNodeIds(edge: FlowEdge): [UUID, UUID] {
    return [edge.source.nodeId, edge.target.nodeId];
}

export function reverseEdge(edge: FlowEdge): FlowEdge {
    return updateEdge(edge, {
        source: edge.target,
        target: edge.source,
        sourceArrow: edge.targetArrow,
        targetArrow: edge.sourceArrow,
        waypoints: [...edge.waypoints].reverse(),
    });
}

export function createEdgeLabel(
    text: string,
    options?: Partial<Omit<EdgeLabel, 'text'>>
): EdgeLabel {
    return {
        text,
        position: options?.position ?? 0.5,
        offset: options?.offset ?? { x: 0, y: 0 },
        style: {
            backgroundColor: '#ffffff',
            textColor: '#1e1e2e',
            fontSize: 12,
            padding: 4,
            borderRadius: 4,
            ...options?.style,
        },
    };
}
