/**
 * Minimap - Overview navigation component
 */

import type { CanvasController } from './CanvasController';
import type { FlowNode } from '../../types';

export class Minimap {
    private svg: SVGSVGElement;
    private viewport: SVGRectElement;
    private canvas: CanvasController;

    constructor(svg: SVGSVGElement, viewport: SVGRectElement, canvas: CanvasController) {
        this.svg = svg;
        this.viewport = viewport;
        this.canvas = canvas;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.svg.addEventListener('click', (e) => {
            const rect = this.svg.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            // Navigate to clicked position
            const bounds = this.svg.viewBox.baseVal;
            const worldX = bounds.x + bounds.width * x;
            const worldY = bounds.y + bounds.height * y;
            const containerBounds = this.canvas.getContainerBounds();
            this.canvas.setViewport({
                x: containerBounds.width / 2 - worldX,
                y: containerBounds.height / 2 - worldY,
            });
        });
    }

    update(nodes: FlowNode[]): void {
        // Clear existing nodes
        const existingNodes = this.svg.querySelectorAll('.minimap-node');
        existingNodes.forEach((n) => n.remove());

        if (nodes.length === 0) {
            this.svg.setAttribute('viewBox', '0 0 200 150');
            this.viewport.setAttribute('x', '0');
            this.viewport.setAttribute('y', '0');
            this.viewport.setAttribute('width', '200');
            this.viewport.setAttribute('height', '150');
            return;
        }

        // Calculate bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach((node) => {
            minX = Math.min(minX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxX = Math.max(maxX, node.position.x + node.size.width);
            maxY = Math.max(maxY, node.position.y + node.size.height);
        });

        const padding = 50;
        minX -= padding; minY -= padding; maxX += padding; maxY += padding;
        const width = maxX - minX;
        const height = maxY - minY;

        this.svg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);

        // Render nodes as simple rectangles
        nodes.forEach((node) => {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', String(node.position.x));
            rect.setAttribute('y', String(node.position.y));
            rect.setAttribute('width', String(node.size.width));
            rect.setAttribute('height', String(node.size.height));
            rect.setAttribute('fill', node.style.borderColor);
            rect.setAttribute('class', 'minimap-node');
            this.svg.insertBefore(rect, this.viewport);
        });

        // Update viewport indicator
        const vp = this.canvas.getViewport();
        const containerBounds = this.canvas.getContainerBounds();
        const vpWidth = containerBounds.width / vp.scale;
        const vpHeight = containerBounds.height / vp.scale;
        const vpX = -vp.x / vp.scale;
        const vpY = -vp.y / vp.scale;

        this.viewport.setAttribute('x', String(vpX));
        this.viewport.setAttribute('y', String(vpY));
        this.viewport.setAttribute('width', String(vpWidth));
        this.viewport.setAttribute('height', String(vpHeight));
    }
}
