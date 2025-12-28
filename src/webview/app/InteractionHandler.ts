/**
 * Interaction Handler - Handles mouse/touch interactions on canvas
 * Fixed: Connection flickering issue
 */

import type { CanvasController } from './CanvasController';
import type { NodeRenderer } from './NodeRenderer';
import type { EdgeRenderer } from './EdgeRenderer';
import type { FlowchartApp } from './FlowchartApp';
import type { Position } from '../../types';

export class InteractionHandler {
    private canvas: CanvasController;
    private nodeRenderer: NodeRenderer;
    private edgeRenderer: EdgeRenderer;
    private app: FlowchartApp;

    // Drag state
    private isDragging = false;
    private dragNodeId: string | null = null;
    private dragOffset: Position = { x: 0, y: 0 };
    private dragStartPos: Position | null = null;

    // Connection state
    private isConnecting = false;
    private connectionStart: { nodeId: string; portId: string } | null = null;
    private connectionLine: SVGLineElement | null = null;

    // Hover state - track separately to avoid flickering
    private hoveredNodeId: string | null = null;

    constructor(
        canvas: CanvasController,
        nodeRenderer: NodeRenderer,
        edgeRenderer: EdgeRenderer,
        app: FlowchartApp
    ) {
        this.canvas = canvas;
        this.nodeRenderer = nodeRenderer;
        this.edgeRenderer = edgeRenderer;
        this.app = app;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        const container = document.getElementById('canvas-container')!;

        // Use capture phase for more reliable event handling
        container.addEventListener('mousedown', (e) => this.handleMouseDown(e), true);
        container.addEventListener('mousemove', (e) => this.handleMouseMove(e), true);
        container.addEventListener('mouseup', (e) => this.handleMouseUp(e), true);
        container.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        container.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

        // Prevent context menu during connection
        container.addEventListener('contextmenu', (e) => {
            if (this.isConnecting) {
                e.preventDefault();
            }
        });
    }

    private handleMouseDown(e: MouseEvent): void {
        if (e.button !== 0) { return; }

        const target = e.target as SVGElement;
        const worldPos = this.getWorldPosition(e);

        // Check if clicking on a port (or its children) - start connection
        const portGroup = target.closest('.port') as SVGElement;
        if (portGroup) {
            e.preventDefault();
            e.stopPropagation();

            const nodeGroup = portGroup.closest('[data-node-id]') as SVGElement;
            if (nodeGroup) {
                this.isConnecting = true;
                this.connectionStart = {
                    nodeId: nodeGroup.dataset.nodeId!,
                    portId: portGroup.dataset.portId!,
                };

                // Show all ports during connection
                this.showAllPorts();

                // Create connection preview line
                this.createConnectionLine(worldPos);

                // Add connecting class to body for cursor
                document.body.classList.add('connecting');
            }
            return;
        }

        // Check if clicking on a node - start drag
        const nodeGroup = target.closest('[data-node-id]') as SVGElement;
        if (nodeGroup) {
            const nodeId = nodeGroup.dataset.nodeId!;
            const doc = this.app.getDocument();
            const node = doc?.nodes.find((n) => n.id === nodeId);

            if (node) {
                this.isDragging = true;
                this.dragNodeId = nodeId;
                this.dragStartPos = { ...node.position };
                this.dragOffset = {
                    x: worldPos.x - node.position.x,
                    y: worldPos.y - node.position.y,
                };

                // Select node
                this.app.selectNode(nodeId, e.shiftKey);

                // Add dragging class
                document.body.classList.add('dragging');
            }
            return;
        }

        // Check if clicking on an edge
        const edgeGroup = target.closest('[data-edge-id]') as SVGElement;
        if (edgeGroup) {
            this.app.selectEdge(edgeGroup.dataset.edgeId!, e.shiftKey);
            return;
        }

        // Click on empty canvas - clear selection
        this.app.clearSelection();
    }

    private handleMouseMove(e: MouseEvent): void {
        const worldPos = this.getWorldPosition(e);
        const target = e.target as SVGElement;

        // Handle node dragging
        if (this.isDragging && this.dragNodeId) {
            e.preventDefault();

            // Apply snap to grid if enabled
            const settings = this.app.getSettings() ?? { snapToGrid: true, gridSize: 20 };
            let newX = worldPos.x - this.dragOffset.x;
            let newY = worldPos.y - this.dragOffset.y;

            if (settings.snapToGrid) {
                const gridSize = settings.gridSize || 20;
                newX = Math.round(newX / gridSize) * gridSize;
                newY = Math.round(newY / gridSize) * gridSize;
            }

            this.app.moveNode(this.dragNodeId, { x: newX, y: newY });
            return;
        }

        // Handle connection line preview
        if (this.isConnecting && this.connectionLine) {
            e.preventDefault();
            this.updateConnectionLine(worldPos);

            // Highlight target port
            const portGroup = target.closest('.port');
            if (portGroup) {
                portGroup.classList.add('port-hover');
            }
            return;
        }

        // Update port visibility on hover (only when not connecting/dragging)
        this.updatePortVisibility(target);
    }

    private handleMouseUp(e: MouseEvent): void {
        const target = e.target as SVGElement;

        // Complete node drag
        if (this.isDragging && this.dragNodeId) {
            this.app.moveNodeComplete();
            document.body.classList.remove('dragging');
        }

        // Complete connection
        if (this.isConnecting && this.connectionStart) {
            // Check if released on a port
            const portGroup = target.closest('.port') as SVGElement;
            if (portGroup) {
                const nodeGroup = portGroup.closest('[data-node-id]') as SVGElement;

                if (nodeGroup && nodeGroup.dataset.nodeId !== this.connectionStart.nodeId) {
                    // Create the edge
                    this.app.addEdge(
                        this.connectionStart.nodeId,
                        this.connectionStart.portId,
                        nodeGroup.dataset.nodeId!,
                        portGroup.dataset.portId!
                    );
                }
            }

            // Clean up connection preview
            this.removeConnectionLine();
            this.hideAllPorts();
            document.body.classList.remove('connecting');
        }

        // Reset all states
        this.isDragging = false;
        this.dragNodeId = null;
        this.dragStartPos = null;
        this.isConnecting = false;
        this.connectionStart = null;
    }

    private handleMouseLeave(_e: MouseEvent): void {
        // Cancel connection if mouse leaves canvas
        if (this.isConnecting) {
            this.removeConnectionLine();
            this.hideAllPorts();
            document.body.classList.remove('connecting');
            this.isConnecting = false;
            this.connectionStart = null;
        }
    }

    private handleDoubleClick(e: MouseEvent): void {
        const target = e.target as SVGElement;
        const nodeGroup = target.closest('[data-node-id]') as SVGElement;

        if (nodeGroup) {
            const nodeId = nodeGroup.dataset.nodeId!;
            const doc = this.app.getDocument();
            const node = doc?.nodes.find((n) => n.id === nodeId);

            if (node) {
                const newLabel = prompt('Enter label:', node.data.label);
                if (newLabel !== null) {
                    this.app.updateNodeData(nodeId, { label: newLabel });
                }
            }
        }
    }

    private getWorldPosition(e: MouseEvent): Position {
        const rect = this.canvas.getContainerBounds();
        return this.canvas.screenToWorld({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    }

    private updatePortVisibility(target: SVGElement): void {
        const nodeGroup = target.closest('[data-node-id]') as SVGElement;
        const nodeId = nodeGroup?.dataset.nodeId || null;

        // Only update if hovered node changed
        if (nodeId === this.hoveredNodeId) { return; }

        // Hide ports on previously hovered node
        if (this.hoveredNodeId) {
            const prevNode = document.querySelector(`[data-node-id="${this.hoveredNodeId}"]`);
            if (prevNode) {
                prevNode.querySelectorAll('.port').forEach((port) => {
                    (port as SVGElement).style.opacity = '0';
                });
            }
        }

        // Show ports on currently hovered node
        if (nodeGroup) {
            nodeGroup.querySelectorAll('.port').forEach((port) => {
                (port as SVGElement).style.opacity = '1';
            });
        }

        this.hoveredNodeId = nodeId;
    }

    private showAllPorts(): void {
        document.querySelectorAll('.port').forEach((port) => {
            (port as SVGElement).style.opacity = '1';
        });
    }

    private hideAllPorts(): void {
        document.querySelectorAll('.port').forEach((port) => {
            (port as SVGElement).style.opacity = '0';
        });
        this.hoveredNodeId = null;
    }

    private createConnectionLine(startPos: Position): void {
        const overlay = document.getElementById('canvas-overlay');
        if (!overlay) { return; }

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'connection-preview-line');
        line.setAttribute('x1', String(startPos.x));
        line.setAttribute('y1', String(startPos.y));
        line.setAttribute('x2', String(startPos.x));
        line.setAttribute('y2', String(startPos.y));
        line.setAttribute('stroke', 'var(--color-primary)');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', '6 4');
        line.setAttribute('stroke-linecap', 'round');

        // We need to add it to the main SVG, not the overlay
        const overlayGroup = document.getElementById('canvas-overlay');
        if (overlayGroup) {
            overlayGroup.appendChild(line);
        }

        this.connectionLine = line;
    }

    private updateConnectionLine(endPos: Position): void {
        if (!this.connectionLine) { return; }

        this.connectionLine.setAttribute('x2', String(endPos.x));
        this.connectionLine.setAttribute('y2', String(endPos.y));
    }

    private removeConnectionLine(): void {
        if (this.connectionLine) {
            this.connectionLine.remove();
            this.connectionLine = null;
        }

        // Remove hover class from all ports
        document.querySelectorAll('.port-hover').forEach((port) => {
            port.classList.remove('port-hover');
        });
    }
}
