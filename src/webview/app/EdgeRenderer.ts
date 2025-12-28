/**
 * Edge Renderer - Renders edges/connections between nodes
 */

import type { FlowEdge, FlowNode, Position } from '../../types';

export class EdgeRenderer {
    private container: SVGGElement;

    constructor(container: SVGGElement) {
        this.container = container;
    }

    render(edges: FlowEdge[], nodes: FlowNode[], selectedIds: Set<string>): void {
        this.container.innerHTML = '';
        edges.forEach((edge) => {
            const sourceNode = nodes.find((n) => n.id === edge.source.nodeId);
            const targetNode = nodes.find((n) => n.id === edge.target.nodeId);
            if (sourceNode && targetNode) {
                this.renderEdge(edge, sourceNode, targetNode, selectedIds.has(edge.id));
            }
        });
    }

    private renderEdge(edge: FlowEdge, sourceNode: FlowNode, targetNode: FlowNode, isSelected: boolean): void {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('data-edge-id', edge.id);
        group.setAttribute('class', `edge ${isSelected ? 'selected' : ''}`);

        const sourcePort = sourceNode.ports.find((p) => p.id === edge.source.portId);
        const targetPort = targetNode.ports.find((p) => p.id === edge.target.portId);

        const start = this.getPortPosition(sourceNode, sourcePort);
        const end = this.getPortPosition(targetNode, targetPort);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', this.createPath(edge.type, start, end));
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', isSelected ? 'var(--color-selection)' : edge.style.strokeColor);
        path.setAttribute('stroke-width', String(edge.style.strokeWidth));
        path.setAttribute('marker-end', isSelected ? 'url(#arrow-selected)' : 'url(#arrow)');

        if (edge.style.strokeDasharray) {
            path.setAttribute('stroke-dasharray', edge.style.strokeDasharray);
        }

        if (edge.style.animated) {
            path.classList.add('animated-edge');
        }

        // Invisible hitbox for easier selection
        const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitbox.setAttribute('d', this.createPath(edge.type, start, end));
        hitbox.setAttribute('fill', 'none');
        hitbox.setAttribute('stroke', 'transparent');
        hitbox.setAttribute('stroke-width', '20');
        hitbox.setAttribute('class', 'edge-hitbox');

        group.appendChild(hitbox);
        group.appendChild(path);

        // Render label if present
        if (edge.label?.text) {
            const labelEl = this.createLabel(edge, start, end);
            group.appendChild(labelEl);
        }

        this.container.appendChild(group);
    }

    private getPortPosition(node: FlowNode, port?: { position: string; offset: number }): Position & { dir: Position } {
        if (!port) {
            return {
                x: node.position.x + node.size.width / 2,
                y: node.position.y + node.size.height / 2,
                dir: { x: 0, y: 0 }
            };
        }

        const { position, size } = node;
        switch (port.position) {
            case 'top':
                return { x: position.x + size.width * port.offset, y: position.y, dir: { x: 0, y: -1 } };
            case 'bottom':
                return { x: position.x + size.width * port.offset, y: position.y + size.height, dir: { x: 0, y: 1 } };
            case 'left':
                return { x: position.x, y: position.y + size.height * port.offset, dir: { x: -1, y: 0 } };
            case 'right':
                return { x: position.x + size.width, y: position.y + size.height * port.offset, dir: { x: 1, y: 0 } };
            default:
                return { x: position.x + size.width / 2, y: position.y + size.height / 2, dir: { x: 0, y: 0 } };
        }
    }

    private createPath(type: string, start: Position & { dir: Position }, end: Position & { dir: Position }): string {
        switch (type) {
            case 'straight':
                return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;

            case 'orthogonal': {
                // Smart orthogonal routing
                const path = [`M ${start.x} ${start.y}`];

                // Move out from start port
                const p1 = {
                    x: start.x + start.dir.x * 20,
                    y: start.y + start.dir.y * 20
                };
                path.push(`L ${p1.x} ${p1.y}`);

                // Target entry point
                const pEnd = {
                    x: end.x + end.dir.x * 20,
                    y: end.y + end.dir.y * 20
                };

                // Midpoint logic
                const midX = (p1.x + pEnd.x) / 2;
                const midY = (p1.y + pEnd.y) / 2;

                // Determine if we need vertical or horizontal split based on port directions
                if (start.dir.y !== 0 && end.dir.y !== 0) {
                    // Both vertical (e.g. Top to Bottom) -> S shape horizontal
                    path.push(`L ${p1.x} ${midY}`);
                    path.push(`L ${pEnd.x} ${midY}`);
                } else if (start.dir.x !== 0 && end.dir.x !== 0) {
                    // Both horizontal -> S shape vertical
                    path.push(`L ${midX} ${p1.y}`);
                    path.push(`L ${midX} ${pEnd.y}`);
                } else {
                    // Orthogonal 90 degree turn
                    // Try to minimize turns
                    if (start.dir.y !== 0) { // Start is vertical
                        path.push(`L ${p1.x} ${pEnd.y}`);
                    } else { // Start is horizontal
                        path.push(`L ${pEnd.x} ${p1.y}`);
                    }
                }

                // Connect to end approach
                path.push(`L ${pEnd.x} ${pEnd.y}`);
                path.push(`L ${end.x} ${end.y}`);

                return path.join(' ');
            }

            default: // bezier
                const dist = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
                const controlDist = Math.min(dist * 0.5, 150);

                // Control points based on port direction
                const cp1 = {
                    x: start.x + (start.dir.x !== 0 ? start.dir.x * controlDist : 0),
                    y: start.y + (start.dir.y !== 0 ? start.dir.y * controlDist : (end.y - start.y) / 2)
                };

                // If start dir is 0 (center), use heuristic
                if (start.dir.x === 0 && start.dir.y === 0) {
                    cp1.x = start.x + (end.x - start.x) / 2;
                    cp1.y = start.y;
                }

                const cp2 = {
                    x: end.x + (end.dir.x !== 0 ? end.dir.x * controlDist : 0),
                    y: end.y + (end.dir.y !== 0 ? end.dir.y * controlDist : (start.y - end.y) / 2)
                };

                // If end dir is 0
                if (end.dir.x === 0 && end.dir.y === 0) {
                    cp2.x = end.x - (end.x - start.x) / 2;
                    cp2.y = end.y;
                }

                return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
        }
    }

    private createLabel(edge: FlowEdge, start: Position, end: Position): SVGGElement {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const pos = edge.label!.position;
        const x = start.x + (end.x - start.x) * pos + (edge.label!.offset.x || 0);
        const y = start.y + (end.y - start.y) * pos + (edge.label!.offset.y || 0);

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');

        text.setAttribute('x', String(x));
        text.setAttribute('y', String(y));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('fill', edge.label!.style.textColor);
        text.setAttribute('font-size', String(edge.label!.style.fontSize));
        text.textContent = edge.label!.text;

        const padding = edge.label!.style.padding;
        const textWidth = edge.label!.text.length * 7;
        bg.setAttribute('x', String(x - textWidth / 2 - padding));
        bg.setAttribute('y', String(y - 8 - padding));
        bg.setAttribute('width', String(textWidth + padding * 2));
        bg.setAttribute('height', String(16 + padding * 2));
        bg.setAttribute('fill', edge.label!.style.backgroundColor);
        bg.setAttribute('rx', String(edge.label!.style.borderRadius));

        g.appendChild(bg);
        g.appendChild(text);
        return g;
    }
}
