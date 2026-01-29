/**
 * AlignmentGuideService - Calculates node alignment and renders guide lines
 */

import type { FlowNode, Position } from '../../types';

interface NodeEdges {
    left: number;
    centerX: number;
    right: number;
    top: number;
    centerY: number;
    bottom: number;
}

export interface SnapResult {
    position: Position;
    snappedX: boolean;
    snappedY: boolean;
    guideLines: Array<{ axis: 'vertical' | 'horizontal'; position: number }>;
}

export class AlignmentGuideService {
    private overlayGroup: SVGGElement | null = null;
    private guideLines: SVGLineElement[] = [];
    private snapThreshold: number = 8;

    // Cache for other nodes' edge positions (performance optimization)
    private nodeEdgesCache: Map<string, NodeEdges> = new Map();

    constructor() {
        this.overlayGroup = document.getElementById('canvas-overlay') as SVGGElement;
    }

    /**
     * Pre-calculate edge positions for all nodes except the dragged one(s)
     * Call this when drag starts for performance
     */
    buildNodeEdgesCache(nodes: FlowNode[], excludeIds: Set<string>): void {
        this.nodeEdgesCache.clear();

        for (const node of nodes) {
            if (excludeIds.has(node.id)) { continue; }

            this.nodeEdgesCache.set(node.id, {
                left: node.position.x,
                centerX: node.position.x + node.size.width / 2,
                right: node.position.x + node.size.width,
                top: node.position.y,
                centerY: node.position.y + node.size.height / 2,
                bottom: node.position.y + node.size.height,
            });
        }
    }

    /**
     * Clear the cache when drag ends
     */
    clearCache(): void {
        this.nodeEdgesCache.clear();
    }

    /**
     * Calculate snap position and alignment guides for a dragging node
     */
    calculateSnapPosition(
        draggedNode: FlowNode,
        proposedPosition: Position,
        threshold: number = this.snapThreshold
    ): SnapResult {
        const guideLines: Array<{ axis: 'vertical' | 'horizontal'; position: number }> = [];
        let snappedX = false;
        let snappedY = false;
        let finalX = proposedPosition.x;
        let finalY = proposedPosition.y;

        // Calculate dragged node's edges at proposed position
        const draggedEdges: NodeEdges = {
            left: proposedPosition.x,
            centerX: proposedPosition.x + draggedNode.size.width / 2,
            right: proposedPosition.x + draggedNode.size.width,
            top: proposedPosition.y,
            centerY: proposedPosition.y + draggedNode.size.height / 2,
            bottom: proposedPosition.y + draggedNode.size.height,
        };

        // Track closest snap distances
        let closestXDist = threshold + 1;
        let closestYDist = threshold + 1;

        // Check against all cached nodes
        for (const [, targetEdges] of this.nodeEdgesCache) {
            // Check vertical alignments (affects X position)
            // Left-to-left
            let dist = Math.abs(draggedEdges.left - targetEdges.left);
            if (dist <= threshold && dist < closestXDist) {
                closestXDist = dist;
                finalX = targetEdges.left;
                snappedX = true;
                guideLines.push({ axis: 'vertical', position: targetEdges.left });
            }

            // Left-to-right
            dist = Math.abs(draggedEdges.left - targetEdges.right);
            if (dist <= threshold && dist < closestXDist) {
                closestXDist = dist;
                finalX = targetEdges.right;
                snappedX = true;
                guideLines.push({ axis: 'vertical', position: targetEdges.right });
            }

            // Center-to-center (X)
            dist = Math.abs(draggedEdges.centerX - targetEdges.centerX);
            if (dist <= threshold && dist < closestXDist) {
                closestXDist = dist;
                finalX = targetEdges.centerX - draggedNode.size.width / 2;
                snappedX = true;
                guideLines.push({ axis: 'vertical', position: targetEdges.centerX });
            }

            // Right-to-right
            dist = Math.abs(draggedEdges.right - targetEdges.right);
            if (dist <= threshold && dist < closestXDist) {
                closestXDist = dist;
                finalX = targetEdges.right - draggedNode.size.width;
                snappedX = true;
                guideLines.push({ axis: 'vertical', position: targetEdges.right });
            }

            // Right-to-left
            dist = Math.abs(draggedEdges.right - targetEdges.left);
            if (dist <= threshold && dist < closestXDist) {
                closestXDist = dist;
                finalX = targetEdges.left - draggedNode.size.width;
                snappedX = true;
                guideLines.push({ axis: 'vertical', position: targetEdges.left });
            }

            // Check horizontal alignments (affects Y position)
            // Top-to-top
            dist = Math.abs(draggedEdges.top - targetEdges.top);
            if (dist <= threshold && dist < closestYDist) {
                closestYDist = dist;
                finalY = targetEdges.top;
                snappedY = true;
                guideLines.push({ axis: 'horizontal', position: targetEdges.top });
            }

            // Top-to-bottom
            dist = Math.abs(draggedEdges.top - targetEdges.bottom);
            if (dist <= threshold && dist < closestYDist) {
                closestYDist = dist;
                finalY = targetEdges.bottom;
                snappedY = true;
                guideLines.push({ axis: 'horizontal', position: targetEdges.bottom });
            }

            // Center-to-center (Y)
            dist = Math.abs(draggedEdges.centerY - targetEdges.centerY);
            if (dist <= threshold && dist < closestYDist) {
                closestYDist = dist;
                finalY = targetEdges.centerY - draggedNode.size.height / 2;
                snappedY = true;
                guideLines.push({ axis: 'horizontal', position: targetEdges.centerY });
            }

            // Bottom-to-bottom
            dist = Math.abs(draggedEdges.bottom - targetEdges.bottom);
            if (dist <= threshold && dist < closestYDist) {
                closestYDist = dist;
                finalY = targetEdges.bottom - draggedNode.size.height;
                snappedY = true;
                guideLines.push({ axis: 'horizontal', position: targetEdges.bottom });
            }

            // Bottom-to-top
            dist = Math.abs(draggedEdges.bottom - targetEdges.top);
            if (dist <= threshold && dist < closestYDist) {
                closestYDist = dist;
                finalY = targetEdges.top - draggedNode.size.height;
                snappedY = true;
                guideLines.push({ axis: 'horizontal', position: targetEdges.top });
            }
        }

        // Filter to keep only the closest guide lines
        const filteredGuides: Array<{ axis: 'vertical' | 'horizontal'; position: number }> = [];
        if (snappedX) {
            const verticalGuide = guideLines.find(g => g.axis === 'vertical');
            if (verticalGuide) { filteredGuides.push(verticalGuide); }
        }
        if (snappedY) {
            const horizontalGuide = guideLines.find(g => g.axis === 'horizontal');
            if (horizontalGuide) { filteredGuides.push(horizontalGuide); }
        }

        return {
            position: { x: finalX, y: finalY },
            snappedX,
            snappedY,
            guideLines: filteredGuides,
        };
    }

    /**
     * Render alignment guide lines on the overlay
     */
    renderGuides(guideLines: Array<{ axis: 'vertical' | 'horizontal'; position: number }>): void {
        this.clearGuides();

        if (!this.overlayGroup) {
            this.overlayGroup = document.getElementById('canvas-overlay') as SVGGElement;
        }
        if (!this.overlayGroup) { return; }

        for (const guide of guideLines) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('class', 'alignment-guide');

            if (guide.axis === 'vertical') {
                // Vertical line (for X alignment)
                line.setAttribute('x1', String(guide.position));
                line.setAttribute('y1', '-10000');
                line.setAttribute('x2', String(guide.position));
                line.setAttribute('y2', '10000');
            } else {
                // Horizontal line (for Y alignment)
                line.setAttribute('x1', '-10000');
                line.setAttribute('y1', String(guide.position));
                line.setAttribute('x2', '10000');
                line.setAttribute('y2', String(guide.position));
            }

            // Apply styling via attributes
            line.setAttribute('stroke', 'var(--color-primary, #6366f1)');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('stroke-dasharray', '4 4');
            line.setAttribute('pointer-events', 'none');

            this.overlayGroup.appendChild(line);
            this.guideLines.push(line);
        }
    }

    /**
     * Clear all rendered guide lines
     */
    clearGuides(): void {
        for (const line of this.guideLines) {
            line.remove();
        }
        this.guideLines = [];
    }

    /**
     * Set snap threshold
     */
    setSnapThreshold(threshold: number): void {
        this.snapThreshold = threshold;
    }
}
