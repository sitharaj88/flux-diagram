/**
 * Ruler Controller - Renders rulers with tick marks and measurements
 */

import type { CanvasController } from './CanvasController';
import type { Position } from '../../types';

interface RulerConfig {
    minorTickSpacing: number;
    majorTickInterval: number;
    labelInterval: number;
}

const RULER_SIZE = 24;

export class RulerController {
    private hCanvas: HTMLCanvasElement | null = null;
    private vCanvas: HTMLCanvasElement | null = null;
    private hCtx: CanvasRenderingContext2D | null = null;
    private vCtx: CanvasRenderingContext2D | null = null;
    private hCursor: HTMLElement | null = null;
    private vCursor: HTMLElement | null = null;
    private canvas: CanvasController;

    private cursorPosition: Position | null = null;
    private isInitialized = false;

    constructor(canvas: CanvasController) {
        this.canvas = canvas;
        this.initializeElements();
    }

    private initializeElements(): void {
        this.hCanvas = document.getElementById('ruler-h-canvas') as HTMLCanvasElement;
        this.vCanvas = document.getElementById('ruler-v-canvas') as HTMLCanvasElement;

        if (this.hCanvas && this.vCanvas) {
            this.hCtx = this.hCanvas.getContext('2d');
            this.vCtx = this.vCanvas.getContext('2d');
            this.hCursor = document.getElementById('ruler-h-cursor');
            this.vCursor = document.getElementById('ruler-v-cursor');

            this.setupResizeObserver();
            this.isInitialized = true;
            this.updateCanvasSizes();
            this.render();
        }
    }

    private setupResizeObserver(): void {
        const hRuler = document.getElementById('ruler-horizontal');
        const vRuler = document.getElementById('ruler-vertical');

        if (hRuler && vRuler) {
            const resizeObserver = new ResizeObserver(() => {
                this.updateCanvasSizes();
                this.render();
            });
            resizeObserver.observe(hRuler);
            resizeObserver.observe(vRuler);
        }
    }

    private updateCanvasSizes(): void {
        if (!this.hCanvas || !this.vCanvas) { return; }

        const hRuler = document.getElementById('ruler-horizontal');
        const vRuler = document.getElementById('ruler-vertical');

        if (!hRuler || !vRuler) { return; }

        const dpr = window.devicePixelRatio || 1;

        // Horizontal ruler
        this.hCanvas.width = hRuler.clientWidth * dpr;
        this.hCanvas.height = RULER_SIZE * dpr;
        this.hCanvas.style.width = `${hRuler.clientWidth}px`;
        this.hCanvas.style.height = `${RULER_SIZE}px`;
        if (this.hCtx) {
            this.hCtx.setTransform(1, 0, 0, 1, 0, 0);
            this.hCtx.scale(dpr, dpr);
        }

        // Vertical ruler
        this.vCanvas.width = RULER_SIZE * dpr;
        this.vCanvas.height = vRuler.clientHeight * dpr;
        this.vCanvas.style.width = `${RULER_SIZE}px`;
        this.vCanvas.style.height = `${vRuler.clientHeight}px`;
        if (this.vCtx) {
            this.vCtx.setTransform(1, 0, 0, 1, 0, 0);
            this.vCtx.scale(dpr, dpr);
        }
    }

    private getTickConfig(scale: number): RulerConfig {
        // Adaptive tick spacing based on zoom level
        const baseSpacings = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
        const targetPixelSpacing = 10;

        let minorTickSpacing = 10;
        for (const spacing of baseSpacings) {
            if (spacing * scale >= targetPixelSpacing) {
                minorTickSpacing = spacing;
                break;
            }
        }

        return {
            minorTickSpacing,
            majorTickInterval: 5,
            labelInterval: 10
        };
    }

    render(): void {
        if (!this.isInitialized) { return; }

        const viewport = this.canvas.getViewport();
        const config = this.getTickConfig(viewport.scale);

        this.renderHorizontalRuler(viewport, config);
        this.renderVerticalRuler(viewport, config);
        this.updateCursorIndicator();
    }

    private renderHorizontalRuler(
        viewport: { x: number; y: number; scale: number },
        config: RulerConfig
    ): void {
        if (!this.hCtx || !this.hCanvas) { return; }

        const ctx = this.hCtx;
        const width = this.hCanvas.width / (window.devicePixelRatio || 1);

        ctx.clearRect(0, 0, width, RULER_SIZE);

        // Calculate visible world range
        const startWorld = Math.floor(-viewport.x / viewport.scale / config.minorTickSpacing) * config.minorTickSpacing;
        const endWorld = Math.ceil((width - viewport.x) / viewport.scale / config.minorTickSpacing) * config.minorTickSpacing;

        // Get computed styles
        const computedStyle = getComputedStyle(document.documentElement);
        const textColor = computedStyle.getPropertyValue('--color-text-muted').trim() || '#888';
        const borderColor = computedStyle.getPropertyValue('--color-border').trim() || '#ccc';

        ctx.fillStyle = textColor;
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;

        let tickIndex = Math.floor(startWorld / config.minorTickSpacing);

        for (let worldX = startWorld; worldX <= endWorld; worldX += config.minorTickSpacing) {
            const screenX = worldX * viewport.scale + viewport.x;

            if (screenX < 0 || screenX > width) {
                tickIndex++;
                continue;
            }

            const isMajor = tickIndex % config.majorTickInterval === 0;
            const hasLabel = tickIndex % config.labelInterval === 0;

            const tickHeight = isMajor ? 10 : 5;

            ctx.beginPath();
            ctx.moveTo(screenX, RULER_SIZE);
            ctx.lineTo(screenX, RULER_SIZE - tickHeight);
            ctx.stroke();

            if (hasLabel && isMajor) {
                ctx.fillText(String(Math.round(worldX)), screenX, RULER_SIZE - 12);
            }

            tickIndex++;
        }
    }

    private renderVerticalRuler(
        viewport: { x: number; y: number; scale: number },
        config: RulerConfig
    ): void {
        if (!this.vCtx || !this.vCanvas) { return; }

        const ctx = this.vCtx;
        const height = this.vCanvas.height / (window.devicePixelRatio || 1);

        ctx.clearRect(0, 0, RULER_SIZE, height);

        const startWorld = Math.floor(-viewport.y / viewport.scale / config.minorTickSpacing) * config.minorTickSpacing;
        const endWorld = Math.ceil((height - viewport.y) / viewport.scale / config.minorTickSpacing) * config.minorTickSpacing;

        // Get computed styles
        const computedStyle = getComputedStyle(document.documentElement);
        const textColor = computedStyle.getPropertyValue('--color-text-muted').trim() || '#888';
        const borderColor = computedStyle.getPropertyValue('--color-border').trim() || '#ccc';

        ctx.fillStyle = textColor;
        ctx.font = '10px Inter, sans-serif';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;

        let tickIndex = Math.floor(startWorld / config.minorTickSpacing);

        for (let worldY = startWorld; worldY <= endWorld; worldY += config.minorTickSpacing) {
            const screenY = worldY * viewport.scale + viewport.y;

            if (screenY < 0 || screenY > height) {
                tickIndex++;
                continue;
            }

            const isMajor = tickIndex % config.majorTickInterval === 0;
            const hasLabel = tickIndex % config.labelInterval === 0;

            const tickWidth = isMajor ? 10 : 5;

            ctx.beginPath();
            ctx.moveTo(RULER_SIZE, screenY);
            ctx.lineTo(RULER_SIZE - tickWidth, screenY);
            ctx.stroke();

            if (hasLabel && isMajor) {
                ctx.save();
                ctx.translate(RULER_SIZE - 14, screenY);
                ctx.rotate(-Math.PI / 2);
                ctx.textAlign = 'center';
                ctx.fillText(String(Math.round(worldY)), 0, 4);
                ctx.restore();
            }

            tickIndex++;
        }
    }

    setCursorPosition(worldPos: Position | null): void {
        this.cursorPosition = worldPos;
        this.updateCursorIndicator();
    }

    private updateCursorIndicator(): void {
        if (!this.hCursor || !this.vCursor) { return; }

        if (!this.cursorPosition) {
            this.hCursor.style.display = 'none';
            this.vCursor.style.display = 'none';
            return;
        }

        const viewport = this.canvas.getViewport();
        const screenX = this.cursorPosition.x * viewport.scale + viewport.x;
        const screenY = this.cursorPosition.y * viewport.scale + viewport.y;

        this.hCursor.style.display = 'block';
        this.hCursor.style.left = `${screenX}px`;

        this.vCursor.style.display = 'block';
        this.vCursor.style.top = `${screenY}px`;
    }
}
