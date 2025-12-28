/**
 * Main Flowchart Application Class
 * Orchestrates all components and handles state management
 */

import { CanvasController } from './CanvasController';
import { NodeRenderer } from './NodeRenderer';
import { EdgeRenderer } from './EdgeRenderer';
import { InteractionHandler } from './InteractionHandler';
import { Minimap } from './Minimap';
import type { FlowchartDocument, FlowNode, FlowEdge, NodeType, Position, Transform } from '../../types';

interface VSCodeAPI {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}

export class FlowchartApp {
    private vscode: VSCodeAPI;
    private document: FlowchartDocument | null = null;

    private canvas: CanvasController;
    private nodeRenderer: NodeRenderer;
    private edgeRenderer: EdgeRenderer;
    private interaction: InteractionHandler;
    private minimap: Minimap;

    private selectedNodeIds: Set<string> = new Set();
    private selectedEdgeIds: Set<string> = new Set();
    private clipboard: { nodes: FlowNode[]; edges: FlowEdge[] } | null = null;

    private undoStack: FlowchartDocument[] = [];
    private redoStack: FlowchartDocument[] = [];
    private isDirty = false;

    constructor(vscode: VSCodeAPI) {
        this.vscode = vscode;

        // Initialize components
        this.canvas = new CanvasController(
            document.getElementById('canvas-container') as HTMLElement,
            document.getElementById('canvas-main') as SVGSVGElement,
            document.getElementById('canvas-grid') as SVGSVGElement
        );

        this.nodeRenderer = new NodeRenderer(
            document.getElementById('canvas-nodes') as SVGGElement
        );

        this.edgeRenderer = new EdgeRenderer(
            document.getElementById('canvas-edges') as SVGGElement
        );

        this.interaction = new InteractionHandler(
            this.canvas,
            this.nodeRenderer,
            this.edgeRenderer,
            this
        );

        this.minimap = new Minimap(
            document.getElementById('minimap-canvas') as SVGSVGElement,
            document.getElementById('minimap-viewport') as SVGRectElement,
            this.canvas
        );

        // Setup UI event listeners
        this.setupToolbar();
        this.setupSidebar();
        this.setupPalette();
        this.setupContextMenu();
        this.setupKeyboard();
    }

    // ==========================================================================
    // Message Handling
    // ==========================================================================

    handleMessage(message: { type: string; payload: unknown }): void {
        switch (message.type) {
            case 'load':
                this.loadDocument(message.payload as FlowchartDocument | null);
                break;
            case 'theme':
                this.updateTheme(message.payload as { kind: number });
                break;
            case 'export':
                this.handleExport(message.payload as { format: string });
                break;
            case 'layout':
                this.handleAutoLayout(message.payload as { type: string });
                break;
            case 'zoom':
                this.handleZoom(message.payload as { direction: string });
                break;
            case 'error':
                this.showToast((message.payload as { message: string }).message, 'error');
                break;
        }
    }

    // ==========================================================================
    // Document Management
    // ==========================================================================

    private loadDocument(doc: FlowchartDocument | null): void {
        if (!doc) {
            // Create empty document
            this.document = {
                metadata: {
                    id: this.generateId(),
                    name: 'Untitled',
                    version: '1.0.0',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                },
                nodes: [],
                edges: [],
                viewport: { x: 0, y: 0, scale: 1 },
                settings: {
                    gridSize: 20,
                    showGrid: true,
                    snapToGrid: true,
                    showMinimap: true,
                    theme: 'auto',
                },
            };
        } else {
            this.document = doc;
        }

        // Update UI
        this.updateDocumentTitle();
        this.render();
        this.canvas.setViewport(this.document.viewport);
        this.minimap.update(this.document.nodes);

        // Clear history
        this.undoStack = [];
        this.redoStack = [];
        this.updateUndoRedoButtons();
    }

    private saveDocument(): void {
        if (!this.document) return;

        this.document.metadata.updatedAt = Date.now();
        this.document.viewport = this.canvas.getViewport();

        this.vscode.postMessage({
            type: 'save',
            payload: this.document,
        });

        this.isDirty = false;
        this.showToast('Saved', 'success');
    }

    private pushHistory(): void {
        if (!this.document) return;

        // Deep clone current state
        const snapshot = JSON.parse(JSON.stringify(this.document)) as FlowchartDocument;
        this.undoStack.push(snapshot);

        // Limit history
        if (this.undoStack.length > 50) {
            this.undoStack.shift();
        }

        // Clear redo stack on new action
        this.redoStack = [];
        this.updateUndoRedoButtons();

        this.isDirty = true;
    }

    undo(): void {
        if (this.undoStack.length === 0 || !this.document) return;

        // Save current state to redo
        const current = JSON.parse(JSON.stringify(this.document)) as FlowchartDocument;
        this.redoStack.push(current);

        // Restore previous state
        const previous = this.undoStack.pop();
        if (previous) {
            this.document = previous;
            this.render();
            this.minimap.update(this.document.nodes);
        }

        this.updateUndoRedoButtons();
    }

    redo(): void {
        if (this.redoStack.length === 0 || !this.document) return;

        // Save current state to undo
        const current = JSON.parse(JSON.stringify(this.document)) as FlowchartDocument;
        this.undoStack.push(current);

        // Restore next state
        const next = this.redoStack.pop();
        if (next) {
            this.document = next;
            this.render();
            this.minimap.update(this.document.nodes);
        }

        this.updateUndoRedoButtons();
    }

    private updateUndoRedoButtons(): void {
        const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
        const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement;

        undoBtn.disabled = this.undoStack.length === 0;
        redoBtn.disabled = this.redoStack.length === 0;
    }

    private updateDocumentTitle(): void {
        const titleEl = document.getElementById('document-title');
        if (titleEl && this.document) {
            titleEl.textContent = this.document.metadata.name;
        }
    }

    // ==========================================================================
    // Node Operations
    // ==========================================================================

    addNode(type: NodeType, position: Position): FlowNode {
        this.pushHistory();

        const node = this.createNode(type, position);
        this.document!.nodes.push(node);

        this.render();
        this.minimap.update(this.document!.nodes);
        this.selectNode(node.id);

        return node;
    }

    private createNode(type: NodeType, position: Position): FlowNode {
        const sizes: Record<NodeType, { width: number; height: number }> = {
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

        const size = sizes[type] ?? { width: 160, height: 80 };
        const now = Date.now();

        return {
            id: this.generateId(),
            type,
            position: {
                x: position.x - size.width / 2,
                y: position.y - size.height / 2,
            },
            size,
            data: {
                label: this.getDefaultLabel(type),
            },
            style: {
                backgroundColor: '#ffffff',
                borderColor: '#6366f1',
                borderWidth: 2,
                borderRadius: 8,
                textColor: '#1e1e2e',
                fontSize: 14,
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 'normal',
                textAlign: 'center',
                opacity: 1,
                shadow: true,
            },
            ports: this.createPorts(type),
            metadata: {
                createdAt: now,
                updatedAt: now,
                locked: false,
                visible: true,
                zIndex: this.document!.nodes.length,
            },
        };
    }

    private createPorts(type: NodeType): FlowNode['ports'] {
        const portConfigs = [
            { position: 'top' as const, offset: 0.5 },
            { position: 'right' as const, offset: 0.5 },
            { position: 'bottom' as const, offset: 0.5 },
            { position: 'left' as const, offset: 0.5 },
        ];

        return portConfigs.map((config) => ({
            id: this.generateId(),
            position: config.position,
            offset: config.offset,
            connected: false,
        }));
    }

    private getDefaultLabel(type: NodeType): string {
        const labels: Record<NodeType, string> = {
            rectangle: 'Process',
            diamond: 'Decision',
            oval: 'Start/End',
            parallelogram: 'Input/Output',
            cylinder: 'Database',
            document: 'Document',
            hexagon: 'Preparation',
            triangle: 'Triangle',
            'manual-input': 'Input',
            delay: 'Delay',
            display: 'Display',
            connector: 'A',
            'off-page-connector': 'Out',
            note: 'Note',
            group: 'Group',
        };
        return labels[type] ?? 'Node';
    }

    moveNode(nodeId: string, position: Position): void {
        const node = this.document!.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        // Snap to grid if enabled
        if (this.document!.settings.snapToGrid) {
            const gridSize = this.document!.settings.gridSize;
            position.x = Math.round(position.x / gridSize) * gridSize;
            position.y = Math.round(position.y / gridSize) * gridSize;
        }

        node.position = position;
        node.metadata.updatedAt = Date.now();

        this.render();
        this.minimap.update(this.document!.nodes);
    }

    moveNodeComplete(): void {
        this.pushHistory();
    }

    resizeNode(nodeId: string, size: { width: number; height: number }): void {
        const node = this.document!.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        node.size = size;
        node.metadata.updatedAt = Date.now();

        this.render();
    }

    updateNodeData(nodeId: string, data: Partial<FlowNode['data']>): void {
        this.pushHistory();

        const node = this.document!.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        node.data = { ...node.data, ...data };
        node.metadata.updatedAt = Date.now();

        this.render();
    }

    updateNodeStyle(nodeId: string, style: Partial<FlowNode['style']>): void {
        this.pushHistory();

        const node = this.document!.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        node.style = { ...node.style, ...style };
        node.metadata.updatedAt = Date.now();

        this.render();
    }

    deleteNode(nodeId: string): void {
        this.pushHistory();

        // Remove connected edges
        this.document!.edges = this.document!.edges.filter(
            (e) => e.source.nodeId !== nodeId && e.target.nodeId !== nodeId
        );

        // Remove node
        this.document!.nodes = this.document!.nodes.filter((n) => n.id !== nodeId);

        this.selectedNodeIds.delete(nodeId);
        this.render();
        this.minimap.update(this.document!.nodes);
        this.updatePropertiesPanel();
    }

    // ==========================================================================
    // Edge Operations
    // ==========================================================================

    addEdge(sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string): FlowEdge | null {
        // Prevent self-loops
        if (sourceNodeId === targetNodeId) return null;

        // Check if edge already exists
        const exists = this.document!.edges.some(
            (e) =>
                e.source.nodeId === sourceNodeId &&
                e.source.portId === sourcePortId &&
                e.target.nodeId === targetNodeId &&
                e.target.portId === targetPortId
        );
        if (exists) return null;

        this.pushHistory();

        const edge: FlowEdge = {
            id: this.generateId(),
            type: 'bezier',
            source: { nodeId: sourceNodeId, portId: sourcePortId },
            target: { nodeId: targetNodeId, portId: targetPortId },
            waypoints: [],
            style: {
                strokeColor: '#6366f1',
                strokeWidth: 2,
                animated: false,
                opacity: 1,
            },
            sourceArrow: 'none',
            targetArrow: 'arrow',
            metadata: {
                createdAt: Date.now(),
                updatedAt: Date.now(),
                zIndex: this.document!.edges.length,
            },
        };

        this.document!.edges.push(edge);
        this.render();

        return edge;
    }

    deleteEdge(edgeId: string): void {
        this.pushHistory();

        this.document!.edges = this.document!.edges.filter((e) => e.id !== edgeId);
        this.selectedEdgeIds.delete(edgeId);

        this.render();
        this.updatePropertiesPanel();
    }

    // ==========================================================================
    // Selection
    // ==========================================================================

    selectNode(nodeId: string, addToSelection = false): void {
        if (!addToSelection) {
            this.selectedNodeIds.clear();
            this.selectedEdgeIds.clear();
        }

        this.selectedNodeIds.add(nodeId);
        this.render();
        this.updatePropertiesPanel();
    }

    selectEdge(edgeId: string, addToSelection = false): void {
        if (!addToSelection) {
            this.selectedNodeIds.clear();
            this.selectedEdgeIds.clear();
        }

        this.selectedEdgeIds.add(edgeId);
        this.render();
        this.updatePropertiesPanel();
    }

    clearSelection(): void {
        this.selectedNodeIds.clear();
        this.selectedEdgeIds.clear();
        this.render();
        this.updatePropertiesPanel();
    }

    getSelectedNodeIds(): Set<string> {
        return this.selectedNodeIds;
    }

    getSelectedEdgeIds(): Set<string> {
        return this.selectedEdgeIds;
    }

    deleteSelected(): void {
        if (this.selectedNodeIds.size === 0 && this.selectedEdgeIds.size === 0) return;

        this.pushHistory();

        // Delete selected edges
        this.document!.edges = this.document!.edges.filter(
            (e) => !this.selectedEdgeIds.has(e.id)
        );

        // Delete edges connected to selected nodes
        this.document!.edges = this.document!.edges.filter(
            (e) => !this.selectedNodeIds.has(e.source.nodeId) && !this.selectedNodeIds.has(e.target.nodeId)
        );

        // Delete selected nodes
        this.document!.nodes = this.document!.nodes.filter(
            (n) => !this.selectedNodeIds.has(n.id)
        );

        this.selectedNodeIds.clear();
        this.selectedEdgeIds.clear();

        this.render();
        this.minimap.update(this.document!.nodes);
        this.updatePropertiesPanel();
    }

    // ==========================================================================
    // Copy/Paste
    // ==========================================================================

    copy(): void {
        if (this.selectedNodeIds.size === 0) return;

        const nodes = this.document!.nodes.filter((n) => this.selectedNodeIds.has(n.id));
        const nodeIds = new Set(nodes.map((n) => n.id));

        // Also copy edges between selected nodes
        const edges = this.document!.edges.filter(
            (e) => nodeIds.has(e.source.nodeId) && nodeIds.has(e.target.nodeId)
        );

        this.clipboard = {
            nodes: JSON.parse(JSON.stringify(nodes)),
            edges: JSON.parse(JSON.stringify(edges)),
        };

        this.showToast('Copied to clipboard', 'info');
    }

    paste(): void {
        if (!this.clipboard) return;

        this.pushHistory();

        // Generate new IDs
        const idMap = new Map<string, string>();
        this.clipboard.nodes.forEach((n) => {
            idMap.set(n.id, this.generateId());
        });

        // Clone nodes with new IDs and offset position
        const newNodes = this.clipboard.nodes.map((n) => ({
            ...n,
            id: idMap.get(n.id)!,
            position: { x: n.position.x + 20, y: n.position.y + 20 },
            ports: n.ports.map((p) => ({ ...p, id: this.generateId() })),
        }));

        // Clone edges with new IDs
        const newEdges = this.clipboard.edges.map((e) => ({
            ...e,
            id: this.generateId(),
            source: { ...e.source, nodeId: idMap.get(e.source.nodeId)! },
            target: { ...e.target, nodeId: idMap.get(e.target.nodeId)! },
        }));

        this.document!.nodes.push(...newNodes);
        this.document!.edges.push(...newEdges);

        // Select pasted nodes
        this.selectedNodeIds.clear();
        newNodes.forEach((n) => this.selectedNodeIds.add(n.id));

        this.render();
        this.minimap.update(this.document!.nodes);
    }

    duplicate(): void {
        this.copy();
        this.paste();
    }

    // ==========================================================================
    // Rendering
    // ==========================================================================

    private render(): void {
        if (!this.document) return;

        // Filter visible nodes based on layers
        const visibleLayers = new Set(
            (this.document.layers || []).filter(l => l.visible).map(l => l.id)
        );
        const hasLayers = (this.document.layers || []).length > 0;

        const visibleNodes = this.document.nodes.filter(n =>
            !hasLayers || !n.layerId || visibleLayers.has(n.layerId)
        );

        // Sort by zIndex
        visibleNodes.sort((a, b) => (a.metadata.zIndex || 0) - (b.metadata.zIndex || 0));

        this.nodeRenderer.render(visibleNodes, this.selectedNodeIds);
        this.edgeRenderer.render(this.document.edges, visibleNodes, this.selectedEdgeIds);

        this.renderLayersPanel();
    }

    private renderLayersPanel(): void {
        const container = document.getElementById('layers-panel');
        if (!container) return;

        // Ensure layers exist and default layer is present
        if (!this.document!.layers) {
            this.document!.layers = [];
        }
        if (this.document!.layers.length === 0) {
            this.document!.layers.push(
                { id: 'default', name: 'Default Layer', visible: true, locked: false }
            );
            // Assign existing nodes to default layer
            this.document!.nodes.forEach(n => { if (!n.layerId) n.layerId = 'default'; });
        }

        const layersList = this.document!.layers.map(layer => `
            <div class="layer-item ${layer.visible ? '' : 'start-hidden'} ${layer.locked ? 'locked' : ''} ${this.activeLayerId === layer.id ? 'active' : ''}" data-layer-id="${layer.id}">
                <div class="layer-actions">
                    <span class="layer-visibility icon-btn" title="Toggle Visibility">${layer.visible ? '👁️' : '🚫'}</span>
                    <span class="layer-lock icon-btn" title="Toggle Lock">${layer.locked ? '🔒' : '🔓'}</span>
                </div>
                <span class="layer-name" contenteditable="true">${this.escapeHtml(layer.name)}</span>
                <span class="layer-delete icon-btn" title="Delete Layer">🗑️</span>
            </div>
        `).join('');

        const header = container.querySelector('.palette-header');
        let content = container.querySelector('.layers-content');
        if (!content) {
            content = document.createElement('div');
            content.className = 'layers-content';
            container.appendChild(content);

            // Add "Add Layer" button if not present
            if (!header?.querySelector('#add-layer-btn')) {
                const addBtn = document.createElement('button');
                addBtn.id = 'add-layer-btn';
                addBtn.className = 'icon-btn';
                addBtn.textContent = '+';
                addBtn.title = 'Add Layer';
                addBtn.addEventListener('click', () => this.addLayer());
                header?.appendChild(addBtn);
            }
        }

        content.innerHTML = layersList;

        // Attach listeners
        content.querySelectorAll('.layer-visibility').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = (e.target as HTMLElement).closest('.layer-item')!.getAttribute('data-layer-id')!;
                const layer = this.document!.layers.find(l => l.id === id);
                if (layer) {
                    layer.visible = !layer.visible;
                    this.render();
                }
            });
        });

        content.querySelectorAll('.layer-lock').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = (e.target as HTMLElement).closest('.layer-item')!.getAttribute('data-layer-id')!;
                const layer = this.document!.layers.find(l => l.id === id);
                if (layer) {
                    layer.locked = !layer.locked;
                    this.render();
                }
            });
        });

        content.querySelectorAll('.layer-delete').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = (e.target as HTMLElement).closest('.layer-item')!.getAttribute('data-layer-id')!;
                this.deleteLayer(id);
            });
        });

        content.querySelectorAll('.layer-item').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = el.getAttribute('data-layer-id')!;
                this.activeLayerId = id;
                this.renderLayersPanel();
            });
        });

        content.querySelectorAll('.layer-name').forEach(el => {
            el.addEventListener('blur', (e) => {
                const id = (e.target as HTMLElement).closest('.layer-item')!.getAttribute('data-layer-id')!;
                const layer = this.document!.layers.find(l => l.id === id);
                if (layer) {
                    layer.name = (e.target as HTMLElement).innerText;
                }
            });
        });
    }

    private activeLayerId: string = 'default';

    private addLayer(): void {
        const id = this.generateId();
        this.document!.layers.push({
            id,
            name: `Layer ${this.document!.layers.length + 1}`,
            visible: true,
            locked: false
        });
        this.activeLayerId = id;
        this.render();
    }

    private deleteLayer(id: string): void {
        if (this.document!.layers.length <= 1) {
            this.showToast('Cannot delete the last layer', 'error');
            return;
        }

        this.document!.layers = this.document!.layers.filter(l => l.id !== id);
        this.document!.nodes.forEach(n => {
            if (n.layerId === id) {
                n.layerId = this.document!.layers[0].id; // Move to first layer
            }
        });

        if (this.activeLayerId === id) {
            this.activeLayerId = this.document!.layers[0].id;
        }
        this.render();
    }

    // ==========================================================================
    // UI Setup
    // ==========================================================================

    private setupSidebar(): void {
        // Menu Actions
        document.getElementById('menu-new')?.addEventListener('click', () => {
            this.vscode.postMessage({ type: 'command', payload: { command: 'newFlowchart' } });
        });

        document.getElementById('menu-save')?.addEventListener('click', () => {
            this.saveDocument();
        });

        document.getElementById('menu-export')?.addEventListener('click', () => {
            this.showExportMenu();
        });

        document.getElementById('menu-layout')?.addEventListener('click', () => {
            this.handleAutoLayout({ type: 'hierarchical' });
        });

        document.getElementById('menu-align')?.addEventListener('click', () => {
            if (this.selectedNodeIds.size > 1) {
                this.showAlignmentMenu();
            } else {
                this.showToast('Select multiple nodes to align', 'info');
            }
        });

        document.getElementById('menu-help')?.addEventListener('click', () => {
            this.showHelp();
        });

        document.getElementById('menu-settings')?.addEventListener('click', () => {
            this.showSettings();
        });// Panel Toggles
        const togglePanel = (panelId: string) => {
            const panels = ['node-palette', 'templates-panel', 'layers-panel'];
            panels.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    if (id === panelId) {
                        el.style.display = el.style.display === 'none' ? 'flex' : 'none';
                        el.classList.toggle('visible', el.style.display === 'flex');
                    } else {
                        el.style.display = 'none';
                        el.classList.remove('visible');
                    }
                }
            });
        };

        document.getElementById('menu-shapes')?.addEventListener('click', () => togglePanel('node-palette'));
        document.getElementById('menu-templates')?.addEventListener('click', () => togglePanel('templates-panel'));
        document.getElementById('menu-layers')?.addEventListener('click', () => togglePanel('layers-panel'));

        // Close buttons for new panels
        document.getElementById('palette-collapse')?.addEventListener('click', () => {
            document.getElementById('node-palette')!.style.display = 'none';
        });

        // TODO: Add close listeners for other panels if they exist in HTML
        this.setupTemplates();
    }

    private showAlignmentMenu(): void {
        // Show a temporary toolbar for alignment
        const existing = document.getElementById('alignment-toolbar');
        if (existing) {
            existing.remove();
            return;
        }

        const toolbar = document.createElement('div');
        toolbar.id = 'alignment-toolbar';
        toolbar.className = 'floating-toolbar';
        toolbar.innerHTML = `
            <button title="Align Left" data-align="left">Left</button>
            <button title="Align Center" data-align="center">Center</button>
            <button title="Align Right" data-align="right">Right</button>
            <div class="separator"></div>
            <button title="Align Top" data-align="top">Top</button>
            <button title="Align Middle" data-align="middle">Middle</button>
            <button title="Align Bottom" data-align="bottom">Bottom</button>
        `;

        // Position near the selection or center
        toolbar.style.position = 'absolute';
        toolbar.style.top = '60px';
        toolbar.style.left = '50%';
        toolbar.style.transform = 'translateX(-50%)';
        toolbar.style.zIndex = '1000';
        toolbar.style.background = 'var(--color-surface)';
        toolbar.style.padding = '8px';
        toolbar.style.borderRadius = '8px';
        toolbar.style.boxShadow = 'var(--shadow-lg)';
        toolbar.style.display = 'flex';
        toolbar.style.gap = '8px';

        document.body.appendChild(toolbar);

        toolbar.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const type = target.dataset.align;
            if (type) {
                this.alignSelectedNodes(type as any);
                toolbar.remove();
            }
        });

        // Close when clicking outside
        const closeHandler = (e: MouseEvent) => {
            if (!toolbar.contains(e.target as Node) && (e.target as HTMLElement).id !== 'menu-align') {
                toolbar.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    private showSettings(): void {
        const content = `
            <div class="settings-group">
                <h3>Appearance</h3>
                <div class="setting-item">
                    <div>
                        <div class="setting-label">Theme</div>
                        <div class="setting-desc">Editor color scheme</div>
                    </div>
                    <select id="setting-theme" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--color-border);">
                        <option value="auto" ${this.document?.settings.theme === 'auto' ? 'selected' : ''}>Auto</option>
                        <option value="light" ${this.document?.settings.theme === 'light' ? 'selected' : ''}>Light</option>
                        <option value="dark" ${this.document?.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                    </select>
                </div>
                <div class="setting-item">
                    <div>
                        <div class="setting-label">Show Minimap</div>
                        <div class="setting-desc">Display navigation map</div>
                    </div>
                    <input type="checkbox" id="setting-minimap" ${this.document?.settings.showMinimap ? 'checked' : ''}>
                </div>
            </div>
            <div class="settings-group">
                <h3>Grid & Layout</h3>
                <div class="setting-item">
                    <div>
                        <div class="setting-label">Show Grid</div>
                        <div class="setting-desc">Display background grid</div>
                    </div>
                    <input type="checkbox" id="setting-grid" ${this.document?.settings.showGrid ? 'checked' : ''}>
                </div>
                <div class="setting-item">
                    <div>
                        <div class="setting-label">Snap to Grid</div>
                        <div class="setting-desc">Align objects to grid points</div>
                    </div>
                    <input type="checkbox" id="setting-snap" ${this.document?.settings.snapToGrid ? 'checked' : ''}>
                </div>
                <div class="setting-item">
                    <div>
                        <div class="setting-label">Grid Size</div>
                        <div class="setting-desc">Spacing between grid lines (px)</div>
                    </div>
                    <input type="number" id="setting-grid-size" min="10" max="100" step="5" value="${this.document?.settings.gridSize || 20}" style="width: 60px; padding: 4px;">
                </div>
            </div>
        `;

        this.showModal('Settings', content);

        // Attach listeners
        document.getElementById('setting-theme')?.addEventListener('change', (e) => {
            const theme = (e.target as HTMLSelectElement).value;
            this.document!.settings.theme = theme as any;
            this.applyTheme(theme);
            this.vscode.postMessage({ type: 'theme', payload: { theme } });
        });

        document.getElementById('setting-minimap')?.addEventListener('change', (e) => {
            this.document!.settings.showMinimap = (e.target as HTMLInputElement).checked;
            const minimapEl = document.getElementById('minimap');
            if (minimapEl) minimapEl.style.display = this.document!.settings.showMinimap ? 'block' : 'none';
        });

        document.getElementById('setting-grid')?.addEventListener('change', (e) => {
            this.document!.settings.showGrid = (e.target as HTMLInputElement).checked;
            const gridEl = document.getElementById('canvas-grid');
            if (gridEl) gridEl.style.display = this.document!.settings.showGrid ? 'block' : 'none';
        });

        document.getElementById('setting-snap')?.addEventListener('change', (e) => {
            this.document!.settings.snapToGrid = (e.target as HTMLInputElement).checked;
        });

        document.getElementById('setting-grid-size')?.addEventListener('change', (e) => {
            const size = parseInt((e.target as HTMLInputElement).value, 10);
            this.document!.settings.gridSize = size;
            const pattern = document.getElementById('grid-pattern');
            if (pattern) {
                pattern.setAttribute('width', String(size));
                pattern.setAttribute('height', String(size));
                const path = pattern.querySelector('path');
                if (path) path.setAttribute('d', `M ${size} 0 L 0 0 0 ${size}`);
            }
        });
    }

    private showHelp(): void {
        const content = `
            <div class="settings-group">
                <h3>Mouse Controls</h3>
                <div class="setting-item">
                    <div class="setting-label">Pan Canvas</div>
                    <div class="key-row"><span>Hold </span><kbd>Space</kbd><span> + Drag</span></div>
                </div>
                <div class="setting-item">
                    <div class="setting-label">Zoom</div>
                    <div class="key-row"><span>Hold </span><kbd>Alt</kbd><span> + Scroll</span></div>
                </div>
                <div class="setting-item">
                    <div class="setting-label">Connect Nodes</div>
                    <div class="key-row">Drag from Port to Port</div>
                </div>
            </div>
            <div class="settings-group">
                <h3>Keyboard Shortcuts</h3>
                <div class="shortcuts-grid">
                    <div class="shortcut-item">
                        <span>Save</span>
                        <kbd>Ctrl+S</kbd>
                    </div>
                    <div class="shortcut-item">
                        <span>Undo</span>
                        <kbd>Ctrl+Z</kbd>
                    </div>
                    <div class="shortcut-item">
                        <span>Redo</span>
                        <kbd>Ctrl+Y</kbd>
                    </div>
                    <div class="shortcut-item">
                        <span>Copy</span>
                        <kbd>Ctrl+C</kbd>
                    </div>
                    <div class="shortcut-item">
                        <span>Paste</span>
                        <kbd>Ctrl+V</kbd>
                    </div>
                    <div class="shortcut-item">
                        <span>Delete</span>
                        <kbd>Del</kbd>
                    </div>
                    <div class="shortcut-item">
                        <span>Select All</span>
                        <kbd>Ctrl+A</kbd>
                    </div>
                    <div class="shortcut-item">
                        <span>Auto Layout</span>
                        <kbd>Shift+Alt+L</kbd>
                    </div>
                </div>
            </div>
        `;
        this.showModal('Help & Shortcuts', content);
    }

    private showModal(title: string, content: string): void {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-content">
                    ${content}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const close = () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 200);
        };

        overlay.querySelector('.modal-close')?.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
    }

    private alignSelectedNodes(type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void {
        const nodes = this.document!.nodes.filter(n => this.selectedNodeIds.has(n.id));
        if (nodes.length < 2) return;
        this.pushHistory();

        if (type === 'left') {
            const minX = Math.min(...nodes.map(n => n.position.x));
            nodes.forEach(n => n.position.x = minX);
        } else if (type === 'center') {
            const avgX = nodes.reduce((s, n) => s + n.position.x + n.size.width / 2, 0) / nodes.length;
            nodes.forEach(n => n.position.x = avgX - n.size.width / 2);
        } else if (type === 'right') {
            const maxX = Math.max(...nodes.map(n => n.position.x + n.size.width));
            nodes.forEach(n => n.position.x = maxX - n.size.width);
        } else if (type === 'top') {
            const minY = Math.min(...nodes.map(n => n.position.y));
            nodes.forEach(n => n.position.y = minY);
        } else if (type === 'middle') {
            const avgY = nodes.reduce((s, n) => s + n.position.y + n.size.height / 2, 0) / nodes.length;
            nodes.forEach(n => n.position.y = avgY - n.size.height / 2);
        } else if (type === 'bottom') {
            const maxY = Math.max(...nodes.map(n => n.position.y + n.size.height));
            nodes.forEach(n => n.position.y = maxY - n.size.height);
        }

        nodes.forEach(n => n.metadata.updatedAt = Date.now());
        this.render();
        this.showToast(`Aligned ${type}`, 'success');
    }

    private setupToolbar(): void {
        // Undo/Redo
        document.getElementById('btn-undo')?.addEventListener('click', () => this.undo());
        document.getElementById('btn-redo')?.addEventListener('click', () => this.redo());

        // Zoom
        document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.canvas.zoomIn());
        document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.canvas.zoomOut());
        document.getElementById('btn-fit')?.addEventListener('click', () => this.fitToView());

        // Layout
        document.getElementById('btn-layout')?.addEventListener('click', () => {
            this.handleAutoLayout({ type: 'hierarchical' });
        });

        // Export
        document.getElementById('btn-export')?.addEventListener('click', () => {
            this.showExportMenu();
        });

        // Subscribe to zoom changes
        this.canvas.onZoomChange((scale) => {
            const zoomEl = document.getElementById('zoom-level');
            if (zoomEl) {
                zoomEl.textContent = `${Math.round(scale * 100)}%`;
            }
        });
    }

    private setupPalette(): void {
        const paletteItems = document.querySelectorAll('.palette-item');

        paletteItems.forEach((item) => {
            const type = (item as HTMLElement).dataset.type as NodeType;

            item.addEventListener('dragstart', (e) => {
                (e as DragEvent).dataTransfer?.setData('node-type', type);
            });

            item.addEventListener('click', () => {
                // Add node at center of viewport
                const center = this.canvas.getViewportCenter();
                this.addNode(type, center);
            });
        });

        // Handle drop on canvas
        const container = document.getElementById('canvas-container');
        container?.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        container?.addEventListener('drop', (e) => {
            e.preventDefault();
            const type = (e as DragEvent).dataTransfer?.getData('node-type') as NodeType;
            if (type) {
                const worldPos = this.canvas.screenToWorld({ x: e.clientX, y: e.clientY });
                this.addNode(type, worldPos);
            }
        });

        // Search functionality
        const searchInput = document.getElementById('shape-search') as HTMLInputElement;
        searchInput?.addEventListener('input', (e) => {
            const query = (e.target as HTMLInputElement).value.toLowerCase();
            paletteItems.forEach((item) => {
                const label = (item as HTMLElement).querySelector('span')?.textContent?.toLowerCase() ?? '';
                (item as HTMLElement).style.display = label.includes(query) ? '' : 'none';
            });
        });
    }

    private setupContextMenu(): void {
        const menu = document.getElementById('context-menu') as HTMLElement;

        // Show context menu on right-click
        document.getElementById('canvas-container')?.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            menu.style.left = `${e.clientX}px`;
            menu.style.top = `${e.clientY}px`;
            menu.style.display = 'block';
        });

        // Hide on click elsewhere
        document.addEventListener('click', () => {
            menu.style.display = 'none';
        });

        // Menu actions
        menu.querySelectorAll('.menu-item').forEach((item) => {
            item.addEventListener('click', () => {
                const action = (item as HTMLElement).dataset.action;
                switch (action) {
                    case 'copy': this.copy(); break;
                    case 'paste': this.paste(); break;
                    case 'duplicate': this.duplicate(); break;
                    case 'delete': this.deleteSelected(); break;
                    case 'bring-front': this.bringToFront(); break;
                    case 'send-back': this.sendToBack(); break;
                }
                menu.style.display = 'none';
            });
        });
    }

    private setupKeyboard(): void {
        document.addEventListener('keydown', (e) => {
            // Don't handle if in input
            if ((e.target as HTMLElement).tagName === 'INPUT') return;

            const isMod = e.ctrlKey || e.metaKey;

            if (isMod && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            } else if (isMod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                this.redo();
            } else if (isMod && e.key === 's') {
                e.preventDefault();
                this.saveDocument();
            } else if (isMod && e.key === 'c') {
                e.preventDefault();
                this.copy();
            } else if (isMod && e.key === 'v') {
                e.preventDefault();
                this.paste();
            } else if (isMod && e.key === 'd') {
                e.preventDefault();
                this.duplicate();
            } else if (isMod && e.key === 'a') {
                e.preventDefault();
                this.selectAll();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                this.deleteSelected();
            } else if (e.key === 'Escape') {
                this.clearSelection();
            } else if (isMod && e.key === '=') {
                e.preventDefault();
                this.canvas.zoomIn();
            } else if (isMod && e.key === '-') {
                e.preventDefault();
                this.canvas.zoomOut();
            } else if (isMod && e.key === '0') {
                e.preventDefault();
                this.fitToView();
            }
        });
    }

    // ==========================================================================
    // Properties Panel
    // ==========================================================================

    private updatePropertiesPanel(): void {
        const content = document.getElementById('panel-content') as HTMLElement;

        if (this.selectedNodeIds.size === 1) {
            const nodeId = Array.from(this.selectedNodeIds)[0]!;
            const node = this.document!.nodes.find((n) => n.id === nodeId);
            if (node) {
                content.innerHTML = this.renderNodeProperties(node);
                this.attachPropertyListeners(node);
            }
        } else if (this.selectedEdgeIds.size === 1) {
            const edgeId = Array.from(this.selectedEdgeIds)[0]!;
            const edge = this.document!.edges.find((e) => e.id === edgeId);
            if (edge) {
                content.innerHTML = this.renderEdgeProperties(edge);
                this.attachEdgePropertyListeners(edge);
            }
        } else if (this.selectedNodeIds.size > 1) {
            content.innerHTML = `
        <div class="property-group">
          <div class="property-header">${this.selectedNodeIds.size} nodes selected</div>
        </div>
      `;
        } else {
            content.innerHTML = `
        <div class="empty-state">
          Select a node or edge to edit its properties
        </div>
      `;
        }
    }

    private renderNodeProperties(node: FlowNode): string {
        return `
      <div class="property-group">
        <div class="property-header">Content</div>
        <div class="property-row">
          <label for="prop-label">Label</label>
          <input type="text" id="prop-label" value="${this.escapeHtml(node.data.label)}" />
        </div>
        <div class="property-row">
          <label for="prop-description">Description</label>
          <textarea id="prop-description">${this.escapeHtml(node.data.description ?? '')}</textarea>
        </div>
      </div>
      
      <div class="property-group">
        <div class="property-header">Style</div>
        <div class="property-row">
          <label for="prop-bgcolor">Background</label>
          <input type="color" id="prop-bgcolor" value="${node.style.backgroundColor}" />
        </div>
        <div class="property-row">
          <label for="prop-bordercolor">Border Color</label>
          <input type="color" id="prop-bordercolor" value="${node.style.borderColor}" />
        </div>
        <div class="property-row">
          <label for="prop-textcolor">Text Color</label>
          <input type="color" id="prop-textcolor" value="${node.style.textColor}" />
        </div>
        <div class="property-row">
          <label for="prop-fontsize">Font Size</label>
          <input type="number" id="prop-fontsize" value="${node.style.fontSize}" min="8" max="72" />
        </div>
      </div>
      
      <div class="property-group">
        <div class="property-header">Position & Size</div>
        <div class="property-row inline">
          <div>
            <label for="prop-x">X</label>
            <input type="number" id="prop-x" value="${Math.round(node.position.x)}" />
          </div>
          <div>
            <label for="prop-y">Y</label>
            <input type="number" id="prop-y" value="${Math.round(node.position.y)}" />
          </div>
        </div>
        <div class="property-row inline">
          <div>
            <label for="prop-width">Width</label>
            <input type="number" id="prop-width" value="${Math.round(node.size.width)}" min="40" />
          </div>
          <div>
            <label for="prop-height">Height</label>
            <input type="number" id="prop-height" value="${Math.round(node.size.height)}" min="40" />
          </div>
        </div>
      </div>
    `;
    }

    private renderEdgeProperties(edge: FlowEdge): string {
        return `
      <div class="property-group">
        <div class="property-header">Edge Style</div>
        <div class="property-row">
          <label for="prop-edge-type">Line Type</label>
          <select id="prop-edge-type">
            <option value="bezier" ${edge.type === 'bezier' ? 'selected' : ''}>Bezier</option>
            <option value="straight" ${edge.type === 'straight' ? 'selected' : ''}>Straight</option>
            <option value="orthogonal" ${edge.type === 'orthogonal' ? 'selected' : ''}>Orthogonal</option>
            <option value="step" ${edge.type === 'step' ? 'selected' : ''}>Step</option>
          </select>
        </div>
        <div class="property-row">
          <label for="prop-edge-color">Color</label>
          <input type="color" id="prop-edge-color" value="${edge.style.strokeColor}" />
        </div>
        <div class="property-row">
          <label for="prop-edge-width">Width</label>
          <input type="number" id="prop-edge-width" value="${edge.style.strokeWidth}" min="1" max="10" />
        </div>
        <div class="property-row">
          <label for="prop-edge-animated">Animated</label>
          <input type="checkbox" id="prop-edge-animated" ${edge.style.animated ? 'checked' : ''} />
        </div>
      </div>
      
      <div class="property-group">
        <div class="property-header">Label</div>
        <div class="property-row">
          <label for="prop-edge-label">Text</label>
          <input type="text" id="prop-edge-label" value="${this.escapeHtml(edge.label?.text ?? '')}" />
        </div>
      </div>
    `;
    }

    private attachPropertyListeners(node: FlowNode): void {
        // Label
        document.getElementById('prop-label')?.addEventListener('input', (e) => {
            this.updateNodeData(node.id, { label: (e.target as HTMLInputElement).value });
        });

        // Description
        document.getElementById('prop-description')?.addEventListener('input', (e) => {
            this.updateNodeData(node.id, { description: (e.target as HTMLTextAreaElement).value });
        });

        // Style
        document.getElementById('prop-bgcolor')?.addEventListener('input', (e) => {
            this.updateNodeStyle(node.id, { backgroundColor: (e.target as HTMLInputElement).value });
        });
        document.getElementById('prop-bordercolor')?.addEventListener('input', (e) => {
            this.updateNodeStyle(node.id, { borderColor: (e.target as HTMLInputElement).value });
        });
        document.getElementById('prop-textcolor')?.addEventListener('input', (e) => {
            this.updateNodeStyle(node.id, { textColor: (e.target as HTMLInputElement).value });
        });
        document.getElementById('prop-fontsize')?.addEventListener('input', (e) => {
            this.updateNodeStyle(node.id, { fontSize: parseInt((e.target as HTMLInputElement).value, 10) });
        });

        // Position
        document.getElementById('prop-x')?.addEventListener('change', (e) => {
            this.pushHistory();
            this.moveNode(node.id, { x: parseInt((e.target as HTMLInputElement).value, 10), y: node.position.y });
        });
        document.getElementById('prop-y')?.addEventListener('change', (e) => {
            this.pushHistory();
            this.moveNode(node.id, { x: node.position.x, y: parseInt((e.target as HTMLInputElement).value, 10) });
        });

        // Size
        document.getElementById('prop-width')?.addEventListener('change', (e) => {
            this.pushHistory();
            this.resizeNode(node.id, { width: parseInt((e.target as HTMLInputElement).value, 10), height: node.size.height });
        });
        document.getElementById('prop-height')?.addEventListener('change', (e) => {
            this.pushHistory();
            this.resizeNode(node.id, { width: node.size.width, height: parseInt((e.target as HTMLInputElement).value, 10) });
        });
    }

    private attachEdgePropertyListeners(edge: FlowEdge): void {
        document.getElementById('prop-edge-type')?.addEventListener('change', (e) => {
            this.pushHistory();
            const edgeObj = this.document!.edges.find((ed) => ed.id === edge.id);
            if (edgeObj) {
                edgeObj.type = (e.target as HTMLSelectElement).value as FlowEdge['type'];
                this.render();
            }
        });

        document.getElementById('prop-edge-color')?.addEventListener('input', (e) => {
            this.pushHistory();
            const edgeObj = this.document!.edges.find((ed) => ed.id === edge.id);
            if (edgeObj) {
                edgeObj.style.strokeColor = (e.target as HTMLInputElement).value;
                this.render();
            }
        });

        document.getElementById('prop-edge-width')?.addEventListener('input', (e) => {
            this.pushHistory();
            const edgeObj = this.document!.edges.find((ed) => ed.id === edge.id);
            if (edgeObj) {
                edgeObj.style.strokeWidth = parseInt((e.target as HTMLInputElement).value, 10);
                this.render();
            }
        });

        document.getElementById('prop-edge-animated')?.addEventListener('change', (e) => {
            this.pushHistory();
            const edgeObj = this.document!.edges.find((ed) => ed.id === edge.id);
            if (edgeObj) {
                edgeObj.style.animated = (e.target as HTMLInputElement).checked;
                this.render();
            }
        });

        document.getElementById('prop-edge-label')?.addEventListener('input', (e) => {
            this.pushHistory();
            const edgeObj = this.document!.edges.find((ed) => ed.id === edge.id);
            if (edgeObj) {
                const text = (e.target as HTMLInputElement).value;
                if (text) {
                    edgeObj.label = {
                        text,
                        position: 0.5,
                        offset: { x: 0, y: 0 },
                        style: {
                            backgroundColor: '#ffffff',
                            textColor: '#1e1e2e',
                            fontSize: 12,
                            padding: 4,
                            borderRadius: 4,
                        },
                    };
                } else {
                    edgeObj.label = undefined;
                }
                this.render();
            }
        });
    }

    // ==========================================================================
    // Utilities
    // ==========================================================================

    private generateId(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private showToast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-fade');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    private updateTheme(payload: { kind: number }): void {
        const html = document.documentElement;
        // 1 = Light, 2 = Dark, 3 = HighContrast
        if (payload.kind === 2) {
            html.classList.remove('light');
            html.classList.add('dark');
        } else {
            html.classList.remove('dark');
            html.classList.add('light');
        }
    }

    private handleExport(payload: { format: string }): void {
        const format = payload.format;

        if (format === 'json') {
            const data = JSON.stringify(this.document, null, 2);
            this.vscode.postMessage({
                type: 'export',
                payload: { format: 'json', data },
            });
        } else {
            // For image exports, we'd need to render to canvas/SVG
            // This is a simplified version
            const svgElement = document.getElementById('canvas-main') as SVGSVGElement;
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgElement);

            if (format === 'svg') {
                this.vscode.postMessage({
                    type: 'export',
                    payload: { format: 'svg', data: svgString },
                });
            } else {
                // PNG export would require canvas rendering
                this.showToast('PNG export coming soon', 'info');
            }
        }
    }

    private showExportMenu(): void {
        const content = `
            <div class="export-options" style="display: flex; flex-direction: column; gap: 12px; padding: 4px;">
                <button id="export-json" class="btn primary full-width">JSON (Project File)</button>
                <div style="height: 1px; background: var(--color-border); margin: 4px 0;"></div>
                <button id="export-png" class="btn secondary full-width">PNG (Image)</button>
                <button id="export-svg" class="btn secondary full-width">SVG (Vector)</button>
            </div>
            <style>
                .full-width { width: 100%; justify-content: center; }
            </style>
        `;

        this.showModal('Export Flowchart', content);

        document.getElementById('export-json')?.addEventListener('click', () => {
            if (!this.document) return;
            const data = JSON.stringify(this.document, null, 2);
            this.vscode.postMessage({ type: 'export', payload: { data, format: 'json' } });
            (document.querySelector('.modal-overlay') as HTMLElement)?.remove();
        });

        document.getElementById('export-png')?.addEventListener('click', () => this.exportToPng());
        document.getElementById('export-svg')?.addEventListener('click', () => this.exportToSvg());
    }

    private getAllStyles(): string {
        let styles = '';
        const sheets = document.styleSheets;
        for (let i = 0; i < sheets.length; i++) {
            try {
                const rules = sheets[i].cssRules;
                for (let j = 0; j < rules.length; j++) {
                    styles += rules[j].cssText;
                }
            } catch (e) { }
        }
        return styles;
    }

    private exportToSvg(): void {
        const originalSvg = document.getElementById('canvas-main') as unknown as SVGSVGElement;
        const svgClone = originalSvg.cloneNode(true) as SVGSVGElement;

        // Embed styles
        const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleEl.textContent = this.getAllStyles();
        svgClone.insertBefore(styleEl, svgClone.firstChild);

        // Serialize
        const serializer = new XMLSerializer();
        const data = serializer.serializeToString(svgClone);

        this.vscode.postMessage({ type: 'export', payload: { format: 'svg', data } });
        (document.querySelector('.modal-overlay') as HTMLElement)?.remove();
    }

    private exportToPng(): void {
        const svg = document.getElementById('canvas-main') as unknown as SVGSVGElement;
        const serializer = new XMLSerializer();

        // Clone for style embedding
        const svgClone = svg.cloneNode(true) as SVGSVGElement;
        const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleEl.textContent = this.getAllStyles();
        svgClone.insertBefore(styleEl, svgClone.firstChild);

        const svgData = serializer.serializeToString(svgClone);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        // Set dimensions (use bounding box of content or viewport)
        // Using getBoundingClientRect of wrapper
        const wrapper = document.getElementById('canvas-container');
        const rect = wrapper?.getBoundingClientRect();
        canvas.width = rect?.width || 800;
        canvas.height = rect?.height || 600;

        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            if (ctx) {
                // Fill background based on theme
                const isDark = document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';
                ctx.fillStyle = isDark ? '#0c0e14' : '#f8fafc';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                const pngData = canvas.toDataURL('image/png');
                this.vscode.postMessage({ type: 'export', payload: { format: 'png', data: pngData } });
                URL.revokeObjectURL(url);
                (document.querySelector('.modal-overlay') as HTMLElement)?.remove();
            }
        };
        img.src = url;
    }

    private handleZoom(payload: { direction: string }): void {
        switch (payload.direction) {
            case 'in':
                this.canvas.zoomIn();
                break;
            case 'out':
                this.canvas.zoomOut();
                break;
            case 'fit':
                this.fitToView();
                break;
        }
    }

    private fitToView(): void {
        if (!this.document || this.document.nodes.length === 0) {
            this.canvas.setViewport({ x: 0, y: 0, scale: 1 });
            return;
        }

        // Calculate bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        this.document.nodes.forEach((node) => {
            minX = Math.min(minX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxX = Math.max(maxX, node.position.x + node.size.width);
            maxY = Math.max(maxY, node.position.y + node.size.height);
        });

        const padding = 50;
        const bounds = {
            x: minX - padding,
            y: minY - padding,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2,
        };

        this.canvas.fitToBounds(bounds);
    }

    // ===================================
    // Templates & Theme
    // ===================================

    private setupTemplates(): void {
        const items = document.querySelectorAll('.template-item');
        items.forEach(item => {
            const templateId = (item as HTMLElement).dataset.template;

            // Click Handler
            item.addEventListener('click', () => {
                this.addTemplate(templateId, this.canvas.getViewportCenter());
            });

            // Drag Handler
            item.addEventListener('dragstart', (e) => {
                (e as DragEvent).dataTransfer?.setData('template', templateId || '');
            });
        });

        // Drop Handler for templates
        const container = document.getElementById('canvas-container');
        container?.addEventListener('drop', (e) => {
            const templateId = (e as DragEvent).dataTransfer?.getData('template');
            if (templateId) {
                e.preventDefault();
                const pos = this.canvas.screenToWorld({ x: e.clientX, y: e.clientY });
                this.addTemplate(templateId, pos);
            }
        });
    }

    private addTemplate(templateId: string | undefined | null, position: Position): void {
        if (!templateId) return;
        const cx = position.x;
        const cy = position.y;

        const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        const getPorts = (): Port[] => [
            { id: 'top', position: 'top', offset: 0.5, connected: false },
            { id: 'right', position: 'right', offset: 0.5, connected: false },
            { id: 'bottom', position: 'bottom', offset: 0.5, connected: false },
            { id: 'left', position: 'left', offset: 0.5, connected: false }
        ];

        const now = Date.now();
        const defaultEdgeStyle = (): EdgeStyle => ({
            strokeColor: '#6366f1',
            strokeWidth: 2,
            animated: false,
            opacity: 1
        });

        const createEdge = (srcNode: string, srcPort: string, tgtNode: string, tgtPort: string, edgeType: EdgeType = 'bezier'): FlowEdge => ({
            id: uuid(),
            type: edgeType,
            source: { nodeId: srcNode, portId: srcPort },
            target: { nodeId: tgtNode, portId: tgtPort },
            waypoints: [],
            style: defaultEdgeStyle(),
            sourceArrow: 'none',
            targetArrow: 'arrow',
        });

        const nodes: FlowNode[] = [];
        const edges: FlowEdge[] = [];
        const defaults = {
            textColor: '#ffffff',
            startBg: '#10b981', startBorder: '#059669',
            procBg: '#ffffff', procBorder: '#6366f1', procText: '#1e1e2e',
            endBg: '#ef4444', endBorder: '#dc2626',
            decBg: '#fef3c7', decBorder: '#f59e0b', decText: '#92400e'
        };

        if (templateId === 'process') {
            const idStart = uuid();
            const idStep = uuid();
            const idEnd = uuid();

            nodes.push(
                { id: idStart, type: 'oval', position: { x: cx - 70, y: cy - 150 }, size: { width: 140, height: 60 }, data: { label: 'Start' }, style: { backgroundColor: defaults.startBg, borderColor: defaults.startBorder, textColor: defaults.textColor }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                { id: idStep, type: 'rectangle', position: { x: cx - 80, y: cy - 40 }, size: { width: 160, height: 80 }, data: { label: 'Process' }, style: { backgroundColor: defaults.procBg, borderColor: defaults.procBorder, textColor: defaults.procText }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                { id: idEnd, type: 'oval', position: { x: cx - 70, y: cy + 90 }, size: { width: 140, height: 60 }, data: { label: 'End' }, style: { backgroundColor: defaults.endBg, borderColor: defaults.endBorder, textColor: defaults.textColor }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } }
            );

            edges.push(
                createEdge(idStart, 'bottom', idStep, 'top'),
                createEdge(idStep, 'bottom', idEnd, 'top')
            );
        } else if (templateId === 'decision') {
            const idStart = uuid();
            const idDec = uuid();
            const idYes = uuid();
            const idNo = uuid();
            const idEnd = uuid();

            nodes.push(
                { id: idStart, type: 'oval', position: { x: cx - 70, y: cy - 220 }, size: { width: 140, height: 60 }, data: { label: 'Start' }, style: { backgroundColor: defaults.startBg, borderColor: defaults.startBorder, textColor: defaults.textColor }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                { id: idDec, type: 'diamond', position: { x: cx - 80, y: cy - 100 }, size: { width: 160, height: 100 }, data: { label: 'Check?' }, style: { backgroundColor: defaults.decBg, borderColor: defaults.decBorder, textColor: defaults.decText }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                { id: idYes, type: 'rectangle', position: { x: cx - 300, y: cy + 60 }, size: { width: 160, height: 80 }, data: { label: 'Yes' }, style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', textColor: '#166534' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                { id: idNo, type: 'rectangle', position: { x: cx + 140, y: cy + 60 }, size: { width: 160, height: 80 }, data: { label: 'No' }, style: { backgroundColor: '#fee2e2', borderColor: '#ef4444', textColor: '#991b1b' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                { id: idEnd, type: 'oval', position: { x: cx - 70, y: cy + 220 }, size: { width: 140, height: 60 }, data: { label: 'End' }, style: { backgroundColor: defaults.endBg, borderColor: defaults.endBorder, textColor: defaults.textColor }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } }
            );

            edges.push(
                createEdge(idStart, 'bottom', idDec, 'top'),
                createEdge(idDec, 'left', idYes, 'top', 'orthogonal'),
                createEdge(idDec, 'right', idNo, 'top', 'orthogonal'),
                createEdge(idYes, 'bottom', idEnd, 'left'),
                createEdge(idNo, 'bottom', idEnd, 'right')
            );
        } else if (templateId === 'swimlane') {
            const idLane1 = uuid();
            const idLane2 = uuid();
            const idTask1 = uuid();
            const idTask2 = uuid();

            nodes.push(
                { id: idLane1, type: 'rectangle', position: { x: cx - 200, y: cy - 100 }, size: { width: 180, height: 200 }, data: { label: 'Lane 1' }, style: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', textColor: '#334155' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                { id: idLane2, type: 'rectangle', position: { x: cx + 20, y: cy - 100 }, size: { width: 180, height: 200 }, data: { label: 'Lane 2' }, style: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', textColor: '#334155' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                { id: idTask1, type: 'rectangle', position: { x: cx - 175, y: cy - 30 }, size: { width: 130, height: 60 }, data: { label: 'Task A' }, style: { backgroundColor: defaults.procBg, borderColor: defaults.procBorder, textColor: defaults.procText }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 1 } },
                { id: idTask2, type: 'rectangle', position: { x: cx + 45, y: cy - 30 }, size: { width: 130, height: 60 }, data: { label: 'Task B' }, style: { backgroundColor: defaults.procBg, borderColor: defaults.procBorder, textColor: defaults.procText }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 1 } }
            );

            edges.push(
                createEdge(idTask1, 'right', idTask2, 'left')
            );
        } else if (templateId === 'org') {
            const idCeo = uuid();
            const idMgr1 = uuid();
            const idMgr2 = uuid();

            nodes.push(
                { id: idCeo, type: 'rectangle', position: { x: cx - 60, y: cy - 100 }, size: { width: 120, height: 50 }, data: { label: 'CEO' }, style: { backgroundColor: defaults.startBg, borderColor: defaults.startBorder, textColor: '#ffffff' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                { id: idMgr1, type: 'rectangle', position: { x: cx - 150, y: cy + 20 }, size: { width: 120, height: 50 }, data: { label: 'Manager A' }, style: { backgroundColor: defaults.procBg, borderColor: defaults.procBorder, textColor: defaults.procText }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                { id: idMgr2, type: 'rectangle', position: { x: cx + 30, y: cy + 20 }, size: { width: 120, height: 50 }, data: { label: 'Manager B' }, style: { backgroundColor: defaults.procBg, borderColor: defaults.procBorder, textColor: defaults.procText }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } }
            );

            edges.push(
                createEdge(idCeo, 'bottom', idMgr1, 'top', 'orthogonal'),
                createEdge(idCeo, 'bottom', idMgr2, 'top', 'orthogonal')
            );
        }

        if (this.document && nodes.length > 0) {
            // Ensure meaningful layer exists
            if (!this.document.layers || this.document.layers.length === 0) {
                this.document.layers = [{ id: 'default', name: 'Default Layer', visible: true, locked: false }];
            }
            // Assign active layer
            const layerId = (this as any).activeLayerId || this.document.layers[0].id;
            nodes.forEach(n => { n.layerId = layerId; });

            this.document.nodes.push(...nodes);
            this.document.edges.push(...edges);
            this.render();
            // Trigger auto layout for the newly added nodes? Or just place them.
            // Positioning is already relative to center.
            this.vscode.setState(this.document);
        }
    }


    private applyTheme(theme: string): void {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');

        if (theme === 'auto') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.add(isDark ? 'dark' : 'light');
        } else {
            root.classList.add(theme);
        }
    }


    private handleAutoLayout(payload: { type: string }): void {
        if (!this.document || this.document.nodes.length === 0) return;

        this.pushHistory();

        // Simple hierarchical layout
        const nodes = this.document.nodes;
        const edges = this.document.edges;

        // Find root nodes (no incoming edges)
        const hasIncoming = new Set(edges.map((e) => e.target.nodeId));
        const roots = nodes.filter((n) => !hasIncoming.has(n.id));

        if (roots.length === 0 && nodes.length > 0) {
            // Fallback: use first node as root
            roots.push(nodes[0]!);
        }

        // BFS layout
        const visited = new Set<string>();
        const levels: Map<number, FlowNode[]> = new Map();

        const queue: Array<{ node: FlowNode; level: number }> = [];
        roots.forEach((r) => queue.push({ node: r, level: 0 }));

        while (queue.length > 0) {
            const { node, level } = queue.shift()!;
            if (visited.has(node.id)) continue;
            visited.add(node.id);

            if (!levels.has(level)) levels.set(level, []);
            levels.get(level)!.push(node);

            // Find children
            const children = edges
                .filter((e) => e.source.nodeId === node.id)
                .map((e) => nodes.find((n) => n.id === e.target.nodeId))
                .filter((n): n is FlowNode => n !== undefined && !visited.has(n.id));

            children.forEach((child) => queue.push({ node: child, level: level + 1 }));
        }

        // Position nodes
        const levelSpacing = 150;
        const nodeSpacing = 200;

        levels.forEach((levelNodes, level) => {
            const totalWidth = (levelNodes.length - 1) * nodeSpacing;
            const startX = -totalWidth / 2;

            levelNodes.forEach((node, index) => {
                node.position = {
                    x: startX + index * nodeSpacing - node.size.width / 2,
                    y: level * levelSpacing,
                };
            });
        });

        // Shift to positive coordinates
        let minX = Infinity;
        let minY = Infinity;
        this.document.nodes.forEach(n => {
            minX = Math.min(minX, n.position.x);
            minY = Math.min(minY, n.position.y);
        });

        const padding = 50;
        if (minX !== Infinity) {
            this.document.nodes.forEach(n => {
                n.position.x = n.position.x - minX + padding;
                n.position.y = n.position.y - minY + padding;
            });
        }

        this.render();
        this.minimap.update(this.document.nodes);
        this.fitToView();

        this.showToast('Layout applied', 'success');
    }

    private selectAll(): void {
        this.selectedNodeIds.clear();
        this.document!.nodes.forEach((n) => this.selectedNodeIds.add(n.id));
        this.render();
        this.updatePropertiesPanel();
    }

    private bringToFront(): void {
        if (this.selectedNodeIds.size === 0) return;

        this.pushHistory();

        const maxZ = Math.max(...this.document!.nodes.map((n) => n.metadata.zIndex));
        this.selectedNodeIds.forEach((id) => {
            const node = this.document!.nodes.find((n) => n.id === id);
            if (node) {
                node.metadata.zIndex = maxZ + 1;
            }
        });

        this.render();
    }

    private sendToBack(): void {
        if (this.selectedNodeIds.size === 0) return;

        this.pushHistory();

        const minZ = Math.min(...this.document!.nodes.map((n) => n.metadata.zIndex));
        this.selectedNodeIds.forEach((id) => {
            const node = this.document!.nodes.find((n) => n.id === id);
            if (node) {
                node.metadata.zIndex = minZ - 1;
            }
        });

        this.render();
    }

    // ==========================================================================
    // Public Accessors for InteractionHandler
    // ==========================================================================

    getDocument(): FlowchartDocument | null {
        return this.document;
    }

    getCanvas(): CanvasController {
        return this.canvas;
    }
}
