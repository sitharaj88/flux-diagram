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
        vscode.commands.registerCommand('flowchartBuilder.exportPNG', async () => {
            const panel = provider.getActivePanel();
            if (panel) {
                panel.webview.postMessage({ type: 'export', payload: { format: 'png' } });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.exportSVG', async () => {
            const panel = provider.getActivePanel();
            if (panel) {
                panel.webview.postMessage({ type: 'export', payload: { format: 'svg' } });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.exportJSON', async () => {
            const panel = provider.getActivePanel();
            if (panel) {
                panel.webview.postMessage({ type: 'export', payload: { format: 'json' } });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.autoLayout', async () => {
            const panel = provider.getActivePanel();
            if (panel) {
                panel.webview.postMessage({ type: 'layout', payload: { type: 'hierarchical' } });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.zoomIn', async () => {
            const panel = provider.getActivePanel();
            if (panel) {
                panel.webview.postMessage({ type: 'zoom', payload: { direction: 'in' } });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.zoomOut', async () => {
            const panel = provider.getActivePanel();
            if (panel) {
                panel.webview.postMessage({ type: 'zoom', payload: { direction: 'out' } });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.fitToView', async () => {
            const panel = provider.getActivePanel();
            if (panel) {
                panel.webview.postMessage({ type: 'zoom', payload: { direction: 'fit' } });
            }
        })
    );

    // Register template commands
    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.createFromTemplate', async (templateId: string) => {
            const template = getTemplate(templateId);
            if (!template) {
                vscode.window.showErrorMessage(`Template "${templateId}" not found`);
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
            vscode.commands.executeCommand('flowchartBuilder.createFromTemplate', 'process');
        }),
        vscode.commands.registerCommand('flowchartBuilder.templateDecision', () => {
            vscode.commands.executeCommand('flowchartBuilder.createFromTemplate', 'decision');
        }),
        vscode.commands.registerCommand('flowchartBuilder.templateSwimlane', () => {
            vscode.commands.executeCommand('flowchartBuilder.createFromTemplate', 'swimlane');
        })
    );

    // Log activation
    console.log('Flowchart Builder extension activated');
}

export function deactivate(): void {
    console.log('Flowchart Builder extension deactivated');
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
    // Helper for standard ports
    const getPorts = () => [
        { id: 'top', position: { x: 0.5, y: 0 } },
        { id: 'right', position: { x: 1, y: 0.5 } },
        { id: 'bottom', position: { x: 0.5, y: 1 } },
        { id: 'left', position: { x: 0, y: 0.5 } }
    ];

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
                    { id: generateId(), sourceId: idStart, targetId: idStep1, sourcePortId: 'bottom', targetPortId: 'top', type: 'curved' },
                    { id: generateId(), sourceId: idStep1, targetId: idStep2, sourcePortId: 'bottom', targetPortId: 'top', type: 'curved' },
                    { id: generateId(), sourceId: idStep2, targetId: idEnd, sourcePortId: 'bottom', targetPortId: 'top', type: 'curved' }
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
                    { id: generateId(), sourceId: idStart, targetId: idDec, sourcePortId: 'bottom', targetPortId: 'top', type: 'curved' },
                    { id: generateId(), sourceId: idDec, targetId: idYes, sourcePortId: 'left', targetPortId: 'top', type: 'orthogonal', label: 'Yes' },
                    { id: generateId(), sourceId: idDec, targetId: idNo, sourcePortId: 'right', targetPortId: 'top', type: 'orthogonal', label: 'No' },
                    { id: generateId(), sourceId: idYes, targetId: idEnd, sourcePortId: 'bottom', targetPortId: 'top', type: 'curved' },
                    { id: generateId(), sourceId: idNo, targetId: idEnd, sourcePortId: 'bottom', targetPortId: 'top', type: 'curved' }
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
                    { id: generateId(), sourceId: id1, targetId: id2, sourcePortId: 'right', targetPortId: 'left', type: 'orthogonal' },
                    { id: generateId(), sourceId: id2, targetId: id3, sourcePortId: 'right', targetPortId: 'left', type: 'orthogonal' },
                ],
                viewport: { x: 0, y: 0, scale: 1 },
                settings: { gridSize: 20, showGrid: true, snapToGrid: true, showMinimap: true, theme: 'auto' },
            },
        };
    }

    return undefined;
}

