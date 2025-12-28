/**
 * Export Service - Handles exporting flowcharts to various formats
 */

import type { FlowchartDocument, FlowNode, FlowEdge, ExportFormat } from '../types';

export interface ExportResult {
    format: ExportFormat;
    data: string;
    mimeType: string;
    filename: string;
}

export class ExportService {
    /**
     * Export to JSON format
     */
    static toJSON(document: FlowchartDocument): ExportResult {
        const data = JSON.stringify(document, null, 2);
        return {
            format: 'json',
            data,
            mimeType: 'application/json',
            filename: `${document.metadata.name}.json`,
        };
    }

    /**
     * Export to SVG format
     */
    static toSVG(
        document: FlowchartDocument,
        options: { padding?: number; backgroundColor?: string } = {}
    ): ExportResult {
        const padding = options.padding ?? 50;
        const backgroundColor = options.backgroundColor ?? '#ffffff';

        // Calculate bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        document.nodes.forEach((node) => {
            minX = Math.min(minX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxX = Math.max(maxX, node.position.x + node.size.width);
            maxY = Math.max(maxY, node.position.y + node.size.height);
        });

        if (document.nodes.length === 0) {
            minX = 0; minY = 0; maxX = 400; maxY = 300;
        }

        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;
        const offsetX = -minX + padding;
        const offsetY = -minY + padding;

        let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${backgroundColor}"/>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <path d="M0,0 L0,6 L9,3 z" fill="#6366f1"/>
    </marker>
  </defs>
  <g transform="translate(${offsetX}, ${offsetY})">
`;

        // Render edges
        document.edges.forEach((edge) => {
            const sourceNode = document.nodes.find((n) => n.id === edge.source.nodeId);
            const targetNode = document.nodes.find((n) => n.id === edge.target.nodeId);
            if (sourceNode && targetNode) {
                const start = this.getPortPosition(sourceNode, edge.source.portId);
                const end = this.getPortPosition(targetNode, edge.target.portId);
                const path = this.createPath(edge.type, start, end);
                svg += `    <path d="${path}" fill="none" stroke="${edge.style.strokeColor}" stroke-width="${edge.style.strokeWidth}" marker-end="url(#arrow)"/>\n`;
            }
        });

        // Render nodes
        document.nodes.forEach((node) => {
            svg += this.renderNodeToSVG(node);
        });

        svg += `  </g>
</svg>`;

        return {
            format: 'svg',
            data: svg,
            mimeType: 'image/svg+xml',
            filename: `${document.metadata.name}.svg`,
        };
    }

    private static getPortPosition(node: FlowNode, portId: string): { x: number; y: number } {
        const port = node.ports.find((p) => p.id === portId);
        if (!port) {
            return { x: node.position.x + node.size.width / 2, y: node.position.y + node.size.height / 2 };
        }

        switch (port.position) {
            case 'top':
                return { x: node.position.x + node.size.width * port.offset, y: node.position.y };
            case 'bottom':
                return { x: node.position.x + node.size.width * port.offset, y: node.position.y + node.size.height };
            case 'left':
                return { x: node.position.x, y: node.position.y + node.size.height * port.offset };
            case 'right':
                return { x: node.position.x + node.size.width, y: node.position.y + node.size.height * port.offset };
            default:
                return { x: node.position.x + node.size.width / 2, y: node.position.y + node.size.height / 2 };
        }
    }

    private static createPath(type: string, start: { x: number; y: number }, end: { x: number; y: number }): string {
        switch (type) {
            case 'straight':
                return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
            case 'step':
                const midX = (start.x + end.x) / 2;
                return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
            default: // bezier
                const cx1 = start.x + (end.x - start.x) / 2;
                const cy1 = start.y;
                const cx2 = start.x + (end.x - start.x) / 2;
                const cy2 = end.y;
                return `M ${start.x} ${start.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${end.x} ${end.y}`;
        }
    }

    private static renderNodeToSVG(node: FlowNode): string {
        const { position, size, style, data, type } = node;
        let svg = '';

        // Background shape
        switch (type) {
            case 'diamond':
                const hw = size.width / 2, hh = size.height / 2;
                svg += `    <polygon points="${position.x + hw},${position.y} ${position.x + size.width},${position.y + hh} ${position.x + hw},${position.y + size.height} ${position.x},${position.y + hh}" `;
                break;
            case 'oval':
                svg += `    <ellipse cx="${position.x + size.width / 2}" cy="${position.y + size.height / 2}" rx="${size.width / 2}" ry="${size.height / 2}" `;
                break;
            case 'parallelogram':
                const skew = size.width * 0.2;
                svg += `    <polygon points="${position.x + skew},${position.y} ${position.x + size.width},${position.y} ${position.x + size.width - skew},${position.y + size.height} ${position.x},${position.y + size.height}" `;
                break;
            default:
                svg += `    <rect x="${position.x}" y="${position.y}" width="${size.width}" height="${size.height}" rx="${style.borderRadius}" `;
        }

        svg += `fill="${style.backgroundColor}" stroke="${style.borderColor}" stroke-width="${style.borderWidth}"/>\n`;

        // Label
        svg += `    <text x="${position.x + size.width / 2}" y="${position.y + size.height / 2}" text-anchor="middle" dominant-baseline="middle" fill="${style.textColor}" font-size="${style.fontSize}" font-family="${style.fontFamily}">${this.escapeXml(data.label)}</text>\n`;

        return svg;
    }

    private static escapeXml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Export to PNG (returns base64 data URL)
     * Note: This requires browser canvas support
     */
    static async toPNG(
        document: FlowchartDocument,
        options: { scale?: number; backgroundColor?: string } = {}
    ): Promise<ExportResult> {
        const scale = options.scale ?? 2;
        const backgroundColor = options.backgroundColor ?? '#ffffff';

        // First generate SVG
        const svgResult = this.toSVG(document, { backgroundColor });

        // Convert SVG to PNG using canvas (browser only)
        const canvas = document.createElement('canvas') as unknown as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Canvas context not available');
        }

        // Parse SVG dimensions
        const widthMatch = svgResult.data.match(/width="(\d+)"/);
        const heightMatch = svgResult.data.match(/height="(\d+)"/);
        const width = widthMatch ? parseInt(widthMatch[1]!, 10) : 800;
        const height = heightMatch ? parseInt(heightMatch[1]!, 10) : 600;

        canvas.width = width * scale;
        canvas.height = height * scale;
        ctx.scale(scale, scale);

        // Draw SVG to canvas
        const img = new Image();
        const svgBlob = new Blob([svgResult.data], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);

        return new Promise((resolve, reject) => {
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);

                const dataUrl = canvas.toDataURL('image/png');
                resolve({
                    format: 'png',
                    data: dataUrl,
                    mimeType: 'image/png',
                    filename: `${document.metadata.name}.png`,
                });
            };
            img.onerror = reject;
            img.src = url;
        });
    }
}
