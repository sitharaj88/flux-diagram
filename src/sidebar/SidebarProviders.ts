/**
 * Sidebar Tree View Providers for VS Code Activity Bar
 */

import * as vscode from 'vscode';
import * as path from 'path';

// Tree item for flowchart files
class FlowchartItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly uri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(label, collapsibleState);
        this.tooltip = uri.fsPath;
        this.description = path.dirname(uri.fsPath).split(path.sep).pop();
        this.iconPath = new vscode.ThemeIcon('graph');
        this.command = {
            command: 'vscode.open',
            title: 'Open Flowchart',
            arguments: [uri],
        };
        this.contextValue = 'flowchartFile';
    }
}

// Flowcharts Tree Data Provider
export class FlowchartsProvider implements vscode.TreeDataProvider<FlowchartItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FlowchartItem | undefined | null | void> =
        new vscode.EventEmitter<FlowchartItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FlowchartItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FlowchartItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: FlowchartItem): Promise<FlowchartItem[]> {
        if (element) {
            return [];
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }

        const flowchartFiles: FlowchartItem[] = [];

        for (const folder of workspaceFolders) {
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, '**/*.flowchart'),
                '**/node_modules/**',
                100
            );

            for (const file of files) {
                const label = path.basename(file.fsPath, '.flowchart');
                flowchartFiles.push(new FlowchartItem(label, file));
            }
        }

        return flowchartFiles;
    }
}

// Template item
class TemplateItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly templateId: string,
        public readonly description: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = description;
        this.iconPath = new vscode.ThemeIcon('file-code');
        this.command = {
            command: 'flowchartBuilder.createFromTemplate',
            title: 'Create from Template',
            arguments: [templateId],
        };
        this.contextValue = 'template';
    }
}

// Templates Tree Data Provider
export class TemplatesProvider implements vscode.TreeDataProvider<TemplateItem> {
    private templates: Array<{ id: string; name: string; description: string }> = [
        { id: 'process', name: 'Process Flow', description: 'Standard process flowchart with start, steps, and end' },
        { id: 'decision', name: 'Decision Tree', description: 'Flowchart with decision points and branches' },
        { id: 'swimlane', name: 'Swimlane', description: 'Process flow divided by roles or departments' },
        { id: 'org', name: 'Organization Chart', description: 'Hierarchical organization structure' },
        { id: 'uml-activity', name: 'UML Activity', description: 'UML-style activity diagram' },
        { id: 'data-flow', name: 'Data Flow', description: 'Data flow diagram with sources and processes' },
    ];

    getTreeItem(element: TemplateItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TemplateItem): TemplateItem[] {
        if (element) {
            return [];
        }

        return this.templates.map(
            (t) => new TemplateItem(t.name, t.id, t.description)
        );
    }
}

// Recent item
class RecentItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly uri: vscode.Uri,
        public readonly accessedAt: Date
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = uri.fsPath;
        this.description = this.formatTime(accessedAt);
        this.iconPath = new vscode.ThemeIcon('history');
        this.command = {
            command: 'vscode.open',
            title: 'Open Flowchart',
            arguments: [uri],
        };
        this.contextValue = 'recentFile';
    }

    private formatTime(date: Date): string {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) { return 'Just now'; }
        if (minutes < 60) { return `${minutes}m ago`; }
        if (hours < 24) { return `${hours}h ago`; }
        return `${days}d ago`;
    }
}

// Recent Files Tree Data Provider
export class RecentProvider implements vscode.TreeDataProvider<RecentItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RecentItem | undefined | null | void> =
        new vscode.EventEmitter<RecentItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<RecentItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private recentFiles: Array<{ uri: vscode.Uri; accessedAt: Date }> = [];

    addRecent(uri: vscode.Uri): void {
        // Remove if already exists
        this.recentFiles = this.recentFiles.filter(
            (f) => f.uri.fsPath !== uri.fsPath
        );
        // Add to front
        this.recentFiles.unshift({ uri, accessedAt: new Date() });
        // Keep only last 10
        this.recentFiles = this.recentFiles.slice(0, 10);
        this._onDidChangeTreeData.fire();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: RecentItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: RecentItem): RecentItem[] {
        if (element) {
            return [];
        }

        return this.recentFiles.map((f) => {
            const label = path.basename(f.uri.fsPath, '.flowchart');
            return new RecentItem(label, f.uri, f.accessedAt);
        });
    }
}

// Register all sidebar providers
export function registerSidebarProviders(context: vscode.ExtensionContext): {
    flowcharts: FlowchartsProvider;
    templates: TemplatesProvider;
    recent: RecentProvider;
} {
    const flowchartsProvider = new FlowchartsProvider();
    const templatesProvider = new TemplatesProvider();
    const recentProvider = new RecentProvider();

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('flowchartBuilder.flowcharts', flowchartsProvider),
        vscode.window.registerTreeDataProvider('flowchartBuilder.templates', templatesProvider),
        vscode.window.registerTreeDataProvider('flowchartBuilder.recent', recentProvider)
    );

    // Refresh flowcharts when files change
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.flowchart');
    watcher.onDidCreate(() => flowchartsProvider.refresh());
    watcher.onDidDelete(() => flowchartsProvider.refresh());
    context.subscriptions.push(watcher);

    // Register refresh command
    context.subscriptions.push(
        vscode.commands.registerCommand('flowchartBuilder.refreshFlowcharts', () => {
            flowchartsProvider.refresh();
        })
    );

    return { flowcharts: flowchartsProvider, templates: templatesProvider, recent: recentProvider };
}
