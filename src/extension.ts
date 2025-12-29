/**
 * Flowchart Builder Extension Entry Point
 */

import * as vscode from 'vscode';
import { FlowchartEditorProvider } from './FlowchartEditorProvider';
import { registerSidebarProviders } from './sidebar';

export function activate(context: vscode.ExtensionContext): void {
    // Register the custom editor provider
    const provider = new FlowchartEditorProvider(context);

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            FlowchartEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            }
        )
    );

    // Register sidebar tree views
    const sidebarProviders = registerSidebarProviders(context);

    // Track opened flowchart files for Recent panel
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor?.document.fileName.endsWith('.flowchart')) {
                sidebarProviders.recent.addRecent(editor.document.uri);
            }
        })
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.newFlowchart', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            const defaultUri = workspaceFolders?.[0]?.uri ?? vscode.Uri.file(process.cwd());

            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.joinPath(defaultUri, 'untitled.flowchart'),
                filters: {
                    'Flowchart': ['flowchart'],
                },
                title: 'Create New Flowchart',
            });

            if (uri) {
                // Create empty flowchart file
                const emptyDocument = {
                    metadata: {
                        id: generateId(),
                        name: uri.path.split('/').pop()?.replace('.flowchart', '') ?? 'Untitled',
                        description: '',
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

                await vscode.workspace.fs.writeFile(
                    uri,
                    Buffer.from(JSON.stringify(emptyDocument, null, 2))
                );
                await vscode.commands.executeCommand('vscode.openWith', uri, FlowchartEditorProvider.viewType);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.exportPNG', () => {
            const panel = provider.getActivePanel();
            if (panel) {
                void panel.webview.postMessage({ type: 'export', payload: { format: 'png' } });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.exportSVG', () => {
            const panel = provider.getActivePanel();
            if (panel) {
                void panel.webview.postMessage({ type: 'export', payload: { format: 'svg' } });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.exportJSON', () => {
            const panel = provider.getActivePanel();
            if (panel) {
                void panel.webview.postMessage({ type: 'export', payload: { format: 'json' } });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.autoLayout', () => {
            const panel = provider.getActivePanel();
            if (panel) {
                void panel.webview.postMessage({ type: 'layout', payload: { type: 'hierarchical' } });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.zoomIn', () => {
            const panel = provider.getActivePanel();
            if (panel) {
                void panel.webview.postMessage({ type: 'zoom', payload: { direction: 'in' } });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.zoomOut', () => {
            const panel = provider.getActivePanel();
            if (panel) {
                void panel.webview.postMessage({ type: 'zoom', payload: { direction: 'out' } });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.fitToView', () => {
            const panel = provider.getActivePanel();
            if (panel) {
                void panel.webview.postMessage({ type: 'zoom', payload: { direction: 'fit' } });
            }
        })
    );

    // Register template commands
    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.createFromTemplate', async (templateId: string) => {
            const template = getTemplate(templateId);
            if (!template) {
                void vscode.window.showErrorMessage(`Template "${templateId}" not found`);
                return;
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            const defaultUri = workspaceFolders?.[0]?.uri ?? vscode.Uri.file(process.cwd());

            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.joinPath(defaultUri, `${templateId}.flowchart`),
                filters: { 'Flowchart': ['flowchart'] },
                title: `Create ${template.name}`,
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(template.document, null, 2)));
                await vscode.commands.executeCommand('vscode.openWith', uri, FlowchartEditorProvider.viewType);
            }
        })
    );

    // Template shortcut commands
    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.templateProcess', () => {
            void vscode.commands.executeCommand('flowchartBuilder.createFromTemplate', 'process');
        }),
        vscode.commands.registerCommand('flowchartBuilder.templateDecision', () => {
            void vscode.commands.executeCommand('flowchartBuilder.createFromTemplate', 'decision');
        }),
        vscode.commands.registerCommand('flowchartBuilder.templateSwimlane', () => {
            void vscode.commands.executeCommand('flowchartBuilder.createFromTemplate', 'swimlane');
        })
    );
}

export function deactivate(): void {
    // Extension deactivation cleanup (if needed)
}

// Simple ID generator for the extension
function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Template definitions
interface Template {
    name: string;
    document: object;
}

function getTemplate(templateId: string): Template | undefined {
    const now = Date.now();

    // Helper for standard ports with correct structure
    const getPorts = () => [
        { id: 'top', position: 'top', offset: 0.5, connected: false },
        { id: 'right', position: 'right', offset: 0.5, connected: false },
        { id: 'bottom', position: 'bottom', offset: 0.5, connected: false },
        { id: 'left', position: 'left', offset: 0.5, connected: false }
    ];

    // Helper for creating properly structured edges
    const createEdge = (srcNode: string, srcPort: string, tgtNode: string, tgtPort: string, type: string = 'bezier') => ({
        id: generateId(),
        type,
        source: { nodeId: srcNode, portId: srcPort },
        target: { nodeId: tgtNode, portId: tgtPort },
        waypoints: [],
        style: { strokeColor: '#6366f1', strokeWidth: 2, animated: false, opacity: 1 },
        sourceArrow: 'none',
        targetArrow: 'arrow',
        metadata: { createdAt: now, updatedAt: now, zIndex: 0 }
    });

    if (templateId === 'process') {
        const idStart = generateId();
        const idStep1 = generateId();
        const idStep2 = generateId();
        const idEnd = generateId();

        return {
            name: 'Process Flow',
            document: {
                metadata: {
                    id: generateId(),
                    name: 'Process Flow',
                    description: 'Standard process flowchart',
                    version: '1.0.0',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                },
                nodes: [
                    { id: idStart, type: 'oval', position: { x: 200, y: 50 }, size: { width: 140, height: 60 }, data: { label: 'Start' }, style: { backgroundColor: '#10b981', borderColor: '#059669', textColor: '#ffffff' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idStep1, type: 'rectangle', position: { x: 180, y: 160 }, size: { width: 180, height: 80 }, data: { label: 'Process Step' }, style: { backgroundColor: '#ffffff', borderColor: '#6366f1', textColor: '#1e1e2e' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idStep2, type: 'rectangle', position: { x: 180, y: 290 }, size: { width: 180, height: 80 }, data: { label: 'Verification' }, style: { backgroundColor: '#ffffff', borderColor: '#6366f1', textColor: '#1e1e2e' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idEnd, type: 'oval', position: { x: 200, y: 420 }, size: { width: 140, height: 60 }, data: { label: 'End' }, style: { backgroundColor: '#ef4444', borderColor: '#dc2626', textColor: '#ffffff' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                ],
                edges: [
                    createEdge(idStart, 'bottom', idStep1, 'top'),
                    createEdge(idStep1, 'bottom', idStep2, 'top'),
                    createEdge(idStep2, 'bottom', idEnd, 'top')
                ],
                viewport: { x: 0, y: 0, scale: 1 },
                settings: { gridSize: 20, showGrid: true, snapToGrid: true, showMinimap: true, theme: 'auto' },
            },
        };
    }

    if (templateId === 'decision') {
        const idStart = generateId();
        const idDec = generateId();
        const idYes = generateId();
        const idNo = generateId();
        const idEnd = generateId();

        return {
            name: 'Decision Tree',
            document: {
                metadata: {
                    id: generateId(),
                    name: 'Decision Tree',
                    description: 'Flowchart with decision points',
                    version: '1.0.0',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                },
                nodes: [
                    { id: idStart, type: 'oval', position: { x: 250, y: 50 }, size: { width: 140, height: 60 }, data: { label: 'Start' }, style: { backgroundColor: '#10b981', borderColor: '#059669', textColor: '#ffffff' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idDec, type: 'diamond', position: { x: 240, y: 160 }, size: { width: 160, height: 120 }, data: { label: 'Check Condition?' }, style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', textColor: '#92400e' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idYes, type: 'rectangle', position: { x: 80, y: 340 }, size: { width: 160, height: 80 }, data: { label: 'Action (Yes)' }, style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', textColor: '#166534' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idNo, type: 'rectangle', position: { x: 400, y: 340 }, size: { width: 160, height: 80 }, data: { label: 'Action (No)' }, style: { backgroundColor: '#fee2e2', borderColor: '#ef4444', textColor: '#991b1b' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idEnd, type: 'oval', position: { x: 250, y: 480 }, size: { width: 140, height: 60 }, data: { label: 'End' }, style: { backgroundColor: '#ef4444', borderColor: '#dc2626', textColor: '#ffffff' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                ],
                edges: [
                    createEdge(idStart, 'bottom', idDec, 'top'),
                    createEdge(idDec, 'left', idYes, 'top', 'orthogonal'),
                    createEdge(idDec, 'right', idNo, 'top', 'orthogonal'),
                    createEdge(idYes, 'bottom', idEnd, 'left'),
                    createEdge(idNo, 'bottom', idEnd, 'right')
                ],
                viewport: { x: 0, y: 0, scale: 1 },
                settings: { gridSize: 20, showGrid: true, snapToGrid: true, showMinimap: true, theme: 'auto' },
            },
        };
    }

    if (templateId === 'swimlane') {
        const id1 = generateId();
        const id2 = generateId();
        const id3 = generateId();
        return {
            name: 'Swimlane',
            document: {
                metadata: {
                    id: generateId(),
                    name: 'Swimlane Diagram',
                    description: 'Process flow with role lanes',
                    version: '1.0.0',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                },
                nodes: [
                    { id: id1, type: 'rectangle', position: { x: 50, y: 100 }, size: { width: 150, height: 80 }, data: { label: 'User Request' }, style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', textColor: '#1e40af' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: id2, type: 'rectangle', position: { x: 250, y: 100 }, size: { width: 150, height: 80 }, data: { label: 'Process' }, style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', textColor: '#92400e' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: id3, type: 'rectangle', position: { x: 450, y: 100 }, size: { width: 150, height: 80 }, data: { label: 'Review' }, style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', textColor: '#166534' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                ],
                edges: [
                    createEdge(id1, 'right', id2, 'left', 'orthogonal'),
                    createEdge(id2, 'right', id3, 'left', 'orthogonal')
                ],
                viewport: { x: 0, y: 0, scale: 1 },
                settings: { gridSize: 20, showGrid: true, snapToGrid: true, showMinimap: true, theme: 'auto' },
            },
        };
    }

    if (templateId === 'org') {
        const idCeo = generateId();
        const idMgr1 = generateId();
        const idMgr2 = generateId();
        const idEmp1 = generateId();
        const idEmp2 = generateId();

        return {
            name: 'Organization Chart',
            document: {
                metadata: {
                    id: generateId(),
                    name: 'Organization Chart',
                    description: 'Hierarchical organization structure',
                    version: '1.0.0',
                    createdAt: now,
                    updatedAt: now,
                },
                nodes: [
                    { id: idCeo, type: 'rectangle', position: { x: 250, y: 50 }, size: { width: 140, height: 60 }, data: { label: 'CEO' }, style: { backgroundColor: '#10b981', borderColor: '#059669', textColor: '#ffffff' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idMgr1, type: 'rectangle', position: { x: 100, y: 160 }, size: { width: 140, height: 60 }, data: { label: 'Manager A' }, style: { backgroundColor: '#6366f1', borderColor: '#4f46e5', textColor: '#ffffff' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idMgr2, type: 'rectangle', position: { x: 400, y: 160 }, size: { width: 140, height: 60 }, data: { label: 'Manager B' }, style: { backgroundColor: '#6366f1', borderColor: '#4f46e5', textColor: '#ffffff' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idEmp1, type: 'rectangle', position: { x: 100, y: 270 }, size: { width: 140, height: 60 }, data: { label: 'Employee 1' }, style: { backgroundColor: '#ffffff', borderColor: '#6366f1', textColor: '#1e1e2e' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idEmp2, type: 'rectangle', position: { x: 400, y: 270 }, size: { width: 140, height: 60 }, data: { label: 'Employee 2' }, style: { backgroundColor: '#ffffff', borderColor: '#6366f1', textColor: '#1e1e2e' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                ],
                edges: [
                    createEdge(idCeo, 'bottom', idMgr1, 'top', 'orthogonal'),
                    createEdge(idCeo, 'bottom', idMgr2, 'top', 'orthogonal'),
                    createEdge(idMgr1, 'bottom', idEmp1, 'top'),
                    createEdge(idMgr2, 'bottom', idEmp2, 'top')
                ],
                viewport: { x: 0, y: 0, scale: 1 },
                settings: { gridSize: 20, showGrid: true, snapToGrid: true, showMinimap: true, theme: 'auto' },
            },
        };
    }

    if (templateId === 'uml-activity') {
        const idStart = generateId();
        const idAction1 = generateId();
        const idFork = generateId();
        const idAction2 = generateId();
        const idAction3 = generateId();
        const idJoin = generateId();
        const idEnd = generateId();

        return {
            name: 'UML Activity',
            document: {
                metadata: {
                    id: generateId(),
                    name: 'UML Activity Diagram',
                    description: 'UML-style activity diagram',
                    version: '1.0.0',
                    createdAt: now,
                    updatedAt: now,
                },
                nodes: [
                    { id: idStart, type: 'oval', position: { x: 270, y: 30 }, size: { width: 60, height: 60 }, data: { label: '●' }, style: { backgroundColor: '#1e1e2e', borderColor: '#1e1e2e', textColor: '#ffffff' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idAction1, type: 'rectangle', position: { x: 220, y: 130 }, size: { width: 160, height: 60 }, data: { label: 'Action 1' }, style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', textColor: '#1e40af' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idFork, type: 'rectangle', position: { x: 200, y: 230 }, size: { width: 200, height: 10 }, data: { label: '' }, style: { backgroundColor: '#1e1e2e', borderColor: '#1e1e2e', textColor: '#ffffff' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idAction2, type: 'rectangle', position: { x: 80, y: 280 }, size: { width: 140, height: 60 }, data: { label: 'Action 2' }, style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', textColor: '#166534' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idAction3, type: 'rectangle', position: { x: 380, y: 280 }, size: { width: 140, height: 60 }, data: { label: 'Action 3' }, style: { backgroundColor: '#fef3c7', borderColor: '#f59e0b', textColor: '#92400e' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idJoin, type: 'rectangle', position: { x: 200, y: 380 }, size: { width: 200, height: 10 }, data: { label: '' }, style: { backgroundColor: '#1e1e2e', borderColor: '#1e1e2e', textColor: '#ffffff' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idEnd, type: 'oval', position: { x: 260, y: 430 }, size: { width: 80, height: 80 }, data: { label: '◉' }, style: { backgroundColor: '#ffffff', borderColor: '#1e1e2e', textColor: '#1e1e2e' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                ],
                edges: [
                    createEdge(idStart, 'bottom', idAction1, 'top'),
                    createEdge(idAction1, 'bottom', idFork, 'top'),
                    createEdge(idFork, 'left', idAction2, 'top'),
                    createEdge(idFork, 'right', idAction3, 'top'),
                    createEdge(idAction2, 'bottom', idJoin, 'left'),
                    createEdge(idAction3, 'bottom', idJoin, 'right'),
                    createEdge(idJoin, 'bottom', idEnd, 'top')
                ],
                viewport: { x: 0, y: 0, scale: 1 },
                settings: { gridSize: 20, showGrid: true, snapToGrid: true, showMinimap: true, theme: 'auto' },
            },
        };
    }

    if (templateId === 'data-flow') {
        const idSource = generateId();
        const idProcess1 = generateId();
        const idDataStore = generateId();
        const idProcess2 = generateId();
        const idSink = generateId();

        return {
            name: 'Data Flow',
            document: {
                metadata: {
                    id: generateId(),
                    name: 'Data Flow Diagram',
                    description: 'Data flow diagram with sources and processes',
                    version: '1.0.0',
                    createdAt: now,
                    updatedAt: now,
                },
                nodes: [
                    { id: idSource, type: 'rectangle', position: { x: 50, y: 150 }, size: { width: 120, height: 80 }, data: { label: 'External Source' }, style: { backgroundColor: '#fee2e2', borderColor: '#ef4444', textColor: '#991b1b' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idProcess1, type: 'oval', position: { x: 230, y: 150 }, size: { width: 100, height: 80 }, data: { label: 'Process 1' }, style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', textColor: '#1e40af' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idDataStore, type: 'cylinder', position: { x: 230, y: 290 }, size: { width: 100, height: 80 }, data: { label: 'Data Store' }, style: { backgroundColor: '#f3e8ff', borderColor: '#a855f7', textColor: '#7e22ce' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idProcess2, type: 'oval', position: { x: 400, y: 150 }, size: { width: 100, height: 80 }, data: { label: 'Process 2' }, style: { backgroundColor: '#dbeafe', borderColor: '#3b82f6', textColor: '#1e40af' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                    { id: idSink, type: 'rectangle', position: { x: 550, y: 150 }, size: { width: 120, height: 80 }, data: { label: 'External Sink' }, style: { backgroundColor: '#dcfce7', borderColor: '#22c55e', textColor: '#166534' }, ports: getPorts(), metadata: { locked: false, visible: true, zIndex: 0 } },
                ],
                edges: [
                    createEdge(idSource, 'right', idProcess1, 'left'),
                    createEdge(idProcess1, 'bottom', idDataStore, 'top'),
                    createEdge(idProcess1, 'right', idProcess2, 'left'),
                    createEdge(idDataStore, 'right', idProcess2, 'bottom'),
                    createEdge(idProcess2, 'right', idSink, 'left')
                ],
                viewport: { x: 0, y: 0, scale: 1 },
                settings: { gridSize: 20, showGrid: true, snapToGrid: true, showMinimap: true, theme: 'auto' },
            },
        };
    }

    return undefined;
}

