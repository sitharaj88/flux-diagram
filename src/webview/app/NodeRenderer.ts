/**
 * Node Renderer - Renders nodes to SVG
 */

import type { FlowNode, NodeType } from '../../types';

export class NodeRenderer {
    private container: SVGGElement;

    constructor(container: SVGGElement) {
        this.container = container;
    }

    render(nodes: FlowNode[], selectedIds: Set<string>): void {
        this.container.innerHTML = '';
        nodes.forEach((node) => this.renderNode(node, selectedIds.has(node.id)));
    }

    private renderNode(node: FlowNode, isSelected: boolean): void {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('data-node-id', node.id);
        group.setAttribute('class', `node ${isSelected ? 'selected' : ''}`);
        group.setAttribute('transform', `translate(${node.position.x}, ${node.position.y})`);

        // Render shape based on type
        const shape = this.createShape(node);
        group.appendChild(shape);

        // Render label
        const label = this.createLabel(node);
        group.appendChild(label);

        // Render ports
        node.ports.forEach((port) => {
            const portEl = this.createPort(node, port);
            group.appendChild(portEl);
        });

        // Selection outline
        if (isSelected) {
            const outline = this.createSelectionOutline(node);
            group.insertBefore(outline, group.firstChild);
        }

        this.container.appendChild(group);
    }

    private createShape(node: FlowNode): SVGElement {
        const { width, height } = node.size;
        const { backgroundColor, borderColor, borderWidth, borderRadius, opacity, shadow } = node.style;

        let shape: SVGElement;

        switch (node.type) {
            case 'diamond':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                const hw = width / 2, hh = height / 2;
                shape.setAttribute('points', `${hw},0 ${width},${hh} ${hw},${height} 0,${hh}`);
                break;
            case 'oval':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
                shape.setAttribute('cx', String(width / 2));
                shape.setAttribute('cy', String(height / 2));
                shape.setAttribute('rx', String(width / 2));
                shape.setAttribute('ry', String(height / 2));
                break;
            case 'parallelogram':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                const skew = width * 0.2;
                shape.setAttribute('points', `${skew},0 ${width},0 ${width - skew},${height} 0,${height}`);
                break;
            case 'cylinder':
                shape = this.createCylinder(width, height);
                break;
            case 'hexagon':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                const inset = width * 0.15;
                shape.setAttribute('points', `${inset},0 ${width - inset},0 ${width},${height / 2} ${width - inset},${height} ${inset},${height} 0,${height / 2}`);
                break;
            case 'manual-input':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shape.setAttribute('points', `0,${height * 0.3} ${width},0 ${width},${height} 0,${height}`);
                break;
            case 'delay':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const r = height / 2;
                shape.setAttribute('d', `M 0 0 L ${width - r} 0 A ${r} ${r} 0 0 1 ${width - r} ${height} L 0 ${height} Z`);
                break;
            case 'display':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const dInset = width * 0.2;
                shape.setAttribute('d', `M ${dInset} 0 L ${width - dInset} 0 A ${height / 2} ${height / 2} 0 0 1 ${width - dInset} ${height} L ${dInset} ${height} L 0 ${height / 2} Z`);
                break;
            case 'connector':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                shape.setAttribute('cx', String(width / 2));
                shape.setAttribute('cy', String(height / 2));
                shape.setAttribute('r', String(Math.min(width, height) / 2));
                break;
            case 'off-page-connector':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shape.setAttribute('points', `0,0 ${width},0 ${width},${height * 0.7} ${width / 2},${height} 0,${height * 0.7}`);
                break;
            case 'note':
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const fold = 20;
                shape.setAttribute('d', `M 0 0 L ${width - fold} 0 L ${width} ${fold} L ${width} ${height} L 0 ${height} Z M ${width - fold} 0 L ${width - fold} ${fold} L ${width} ${fold}`);
                break;
            default: // rectangle
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                shape.setAttribute('x', '0');
                shape.setAttribute('y', '0');
                shape.setAttribute('width', String(width));
                shape.setAttribute('height', String(height));
                shape.setAttribute('rx', String(borderRadius));
        }

        shape.setAttribute('fill', backgroundColor);
        shape.setAttribute('stroke', borderColor);
        shape.setAttribute('stroke-width', String(borderWidth));
        shape.setAttribute('opacity', String(opacity));

        if (shadow) {
            shape.setAttribute('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');
        }

        return shape;
    }

    private createCylinder(width: number, height: number): SVGGElement {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const ellipseHeight = height * 0.15;

        const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        body.setAttribute('d', `M 0 ${ellipseHeight} L 0 ${height - ellipseHeight} A ${width / 2} ${ellipseHeight} 0 0 0 ${width} ${height - ellipseHeight} L ${width} ${ellipseHeight}`);
        g.appendChild(body);

        const top = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        top.setAttribute('cx', String(width / 2));
        top.setAttribute('cy', String(ellipseHeight));
        top.setAttribute('rx', String(width / 2));
        top.setAttribute('ry', String(ellipseHeight));
        g.appendChild(top);

        return g;
    }

    private createLabel(node: FlowNode): SVGTextElement {
        const { width, height } = node.size;
        const { textColor, fontSize, fontFamily, fontWeight, textAlign } = node.style;

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(width / 2));
        text.setAttribute('y', String(height / 2));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('fill', textColor);
        text.setAttribute('font-size', String(fontSize));
        text.setAttribute('font-family', fontFamily);
        text.setAttribute('font-weight', fontWeight);
        text.setAttribute('pointer-events', 'none');
        text.textContent = node.data.label;

        return text;
    }

    private createPort(node: FlowNode, port: { id: string; position: string; offset: number }): SVGGElement {
        const { width, height } = node.size;
        let x = 0, y = 0;

        switch (port.position) {
            case 'top': x = width * port.offset; y = 0; break;
            case 'bottom': x = width * port.offset; y = height; break;
            case 'left': x = 0; y = height * port.offset; break;
            case 'right': x = width; y = height * port.offset; break;
        }

        // Create a group for the port
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'port');
        group.setAttribute('data-port-id', port.id);
        group.setAttribute('transform', `translate(${x}, ${y})`);
        group.setAttribute('opacity', '0');

        // Invisible hitbox - larger area for stable mouse interaction
        const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hitbox.setAttribute('r', '16');
        hitbox.setAttribute('fill', 'transparent');
        hitbox.setAttribute('class', 'port-hitbox');
        group.appendChild(hitbox);

        // Visible port circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', '6');
        circle.setAttribute('fill', 'var(--color-primary)');
        circle.setAttribute('stroke', 'white');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('class', 'port-visual');
        circle.setAttribute('pointer-events', 'none');
        group.appendChild(circle);

        return group;
    }

    private createSelectionOutline(node: FlowNode): SVGRectElement {
        const padding = 4;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(-padding));
        rect.setAttribute('y', String(-padding));
        rect.setAttribute('width', String(node.size.width + padding * 2));
        rect.setAttribute('height', String(node.size.height + padding * 2));
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', 'var(--color-selection)');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('stroke-dasharray', '4 2');
        rect.setAttribute('rx', '4');
        return rect;
    }
}
