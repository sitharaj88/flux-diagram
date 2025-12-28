/**
 * Canvas Controller - Handles viewport transformations, zoom, pan
 */

import type { Transform, Position, Bounds } from '../../types';

type ZoomCallback = (scale: number) => void;

export class CanvasController {
    private container: HTMLElement;
    private svg: SVGSVGElement;
    private gridSvg: SVGSVGElement;

    private viewport: Transform = { x: 0, y: 0, scale: 1 };
    private minScale = 0.1;
    private maxScale = 4;

    private isPanning = false;
    private panStart: Position = { x: 0, y: 0 };

    private zoomCallbacks: ZoomCallback[] = [];

    constructor(container: HTMLElement, svg: SVGSVGElement, gridSvg: SVGSVGElement) {
        this.container = container;
        this.svg = svg;
        this.gridSvg = gridSvg;

        this.setupEventListeners();
        this.updateTransform();
        this.renderGrid();
    }

    private setupEventListeners(): void {
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const rect = this.container.getBoundingClientRect();
            this.zoomAt(e.clientX - rect.left, e.clientY - rect.top, delta);
        });

        this.container.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && e.altKey)) {
                e.preventDefault();
                this.isPanning = true;
                this.panStart = { x: e.clientX, y: e.clientY };
                this.container.style.cursor = 'grabbing';
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                const dx = e.clientX - this.panStart.x;
                const dy = e.clientY - this.panStart.y;
                this.viewport.x += dx;
                this.viewport.y += dy;
                this.panStart = { x: e.clientX, y: e.clientY };
                this.updateTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.container.style.cursor = '';
            }
        });
    }

    private updateTransform(): void {
        const transform = `translate(${this.viewport.x}px, ${this.viewport.y}px) scale(${this.viewport.scale})`;
        this.svg.style.transform = transform;
        this.gridSvg.style.transform = transform;
        this.zoomCallbacks.forEach((cb) => cb(this.viewport.scale));
    }

    private renderGrid(): void {
        const gridSize = 20;
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'grid-pattern');
        pattern.setAttribute('width', String(gridSize));
        pattern.setAttribute('height', String(gridSize));
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${gridSize} 0 L 0 0 0 ${gridSize}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'var(--color-grid)');
        path.setAttribute('stroke-width', '0.5');
        pattern.appendChild(path);
        defs.appendChild(pattern);
        this.gridSvg.appendChild(defs);

        const gridRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        gridRect.setAttribute('x', '-10000');
        gridRect.setAttribute('y', '-10000');
        gridRect.setAttribute('width', '20000');
        gridRect.setAttribute('height', '20000');
        gridRect.setAttribute('fill', 'url(#grid-pattern)');
        this.gridSvg.appendChild(gridRect);
    }

    zoomIn(): void { this.zoom(1.2); }
    zoomOut(): void { this.zoom(0.8); }

    private zoom(delta: number): void {
        const rect = this.container.getBoundingClientRect();
        this.zoomAt(rect.width / 2, rect.height / 2, delta);
    }

    private zoomAt(x: number, y: number, delta: number): void {
        const oldScale = this.viewport.scale;
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, oldScale * delta));
        if (newScale === oldScale) return;

        const scaleFactor = newScale / oldScale;
        this.viewport.x = x - (x - this.viewport.x) * scaleFactor;
        this.viewport.y = y - (y - this.viewport.y) * scaleFactor;
        this.viewport.scale = newScale;
        this.updateTransform();
    }

    setViewport(viewport: Partial<Transform>): void {
        this.viewport = { ...this.viewport, ...viewport };
        this.updateTransform();
    }

    getViewport(): Transform { return { ...this.viewport }; }

    getViewportCenter(): Position {
        const rect = this.container.getBoundingClientRect();
        return this.screenToWorld({ x: rect.width / 2, y: rect.height / 2 });
    }

    fitToBounds(bounds: Bounds): void {
        const rect = this.container.getBoundingClientRect();
        const padding = 50;
        const scaleX = (rect.width - padding * 2) / bounds.width;
        const scaleY = (rect.height - padding * 2) / bounds.height;
        const scale = Math.min(scaleX, scaleY, 1);
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;
        this.viewport = {
            x: rect.width / 2 - centerX * scale,
            y: rect.height / 2 - centerY * scale,
            scale,
        };
        this.updateTransform();
    }

    screenToWorld(screenPos: Position): Position {
        return {
            x: (screenPos.x - this.viewport.x) / this.viewport.scale,
            y: (screenPos.y - this.viewport.y) / this.viewport.scale,
        };
    }

    worldToScreen(worldPos: Position): Position {
        return {
            x: worldPos.x * this.viewport.scale + this.viewport.x,
            y: worldPos.y * this.viewport.scale + this.viewport.y,
        };
    }

    onZoomChange(callback: ZoomCallback): void { this.zoomCallbacks.push(callback); }
    getContainerBounds(): DOMRect { return this.container.getBoundingClientRect(); }
}
