/**
 * Custom Editor Provider for Flowchart files
 */

import * as vscode from 'vscode';
import * as path from 'path';

export class FlowchartEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'flowchartBuilder.editor';

  private activePanel: vscode.WebviewPanel | undefined;

  constructor(private readonly context: vscode.ExtensionContext) { }

  public getActivePanel(): vscode.WebviewPanel | undefined {
    return this.activePanel;
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.activePanel = webviewPanel;

    // Setup webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      ],
    };

    // Set initial HTML content
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Document change subscription
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.updateWebview(webviewPanel.webview, document);
      }
    });

    // Theme change subscription
    const themeSubscription = vscode.window.onDidChangeActiveColorTheme(() => {
      webviewPanel.webview.postMessage({
        type: 'theme',
        payload: {
          kind: vscode.window.activeColorTheme.kind,
        },
      });
    });

    // Handle panel visibility
    webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.visible) {
        this.activePanel = webviewPanel;
        this.updateWebview(webviewPanel.webview, document);
      }
    });

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message, document);
    });

    // Clean up on dispose
    webviewPanel.onDidDispose(() => {
      if (this.activePanel === webviewPanel) {
        this.activePanel = undefined;
      }
      changeDocumentSubscription.dispose();
      themeSubscription.dispose();
    });

    // Initial content update
    this.updateWebview(webviewPanel.webview, document);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Get URIs for scripts and styles
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'styles', 'main.css')
    );
    const themesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'styles', 'themes.css')
    );
    const componentsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'styles', 'components.css')
    );

    // Use a nonce for content security
    const nonce = this.getNonce();

    // Determine theme
    const themeKind = vscode.window.activeColorTheme.kind;
    const themeClass = themeKind === vscode.ColorThemeKind.Dark ? 'dark' : 'light';

    return `<!DOCTYPE html>
<html lang="en" class="${themeClass}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource};">
  <title>Flowchart Builder</title>
  <link href="${styleUri}" rel="stylesheet">
  <link href="${themesUri}" rel="stylesheet">
  <link href="${componentsUri}" rel="stylesheet">
</head>
<body>
  <!-- Skip link for accessibility -->
  <a href="#canvas-main" class="skip-link">Skip to canvas</a>
  
  <div id="app" role="application" aria-label="Flowchart Builder">
    <header class="toolbar" id="toolbar" role="toolbar" aria-label="Main toolbar">
      <div class="toolbar-section toolbar-left">
        <button class="toolbar-btn" id="btn-undo" title="Undo (Ctrl+Z)" aria-label="Undo" disabled>
          <span class="icon" aria-hidden="true">↶</span>
          <span class="sr-only">Undo</span>
        </button>
        <button class="toolbar-btn" id="btn-redo" title="Redo (Ctrl+Y)" aria-label="Redo" disabled>
          <span class="icon" aria-hidden="true">↷</span>
          <span class="sr-only">Redo</span>
        </button>
        <div class="toolbar-divider" role="separator"></div>
        <div class="zoom-control" role="group" aria-label="Zoom controls">
          <button class="toolbar-btn" id="btn-zoom-out" title="Zoom Out (Ctrl+-)" aria-label="Zoom out">
            <span class="icon" aria-hidden="true">−</span>
          </button>
          <span class="zoom-level" id="zoom-level" role="status" aria-live="polite">100%</span>
          <button class="toolbar-btn" id="btn-zoom-in" title="Zoom In (Ctrl+=)" aria-label="Zoom in">
            <span class="icon" aria-hidden="true">+</span>
          </button>
          <button class="toolbar-btn" id="btn-fit" title="Fit to View (Ctrl+0)" aria-label="Fit to view">
            <span class="icon" aria-hidden="true">⊡</span>
          </button>
        </div>
        <div class="toolbar-divider" role="separator"></div>
        <button class="toolbar-btn" id="btn-layout" title="Auto Layout (Ctrl+Shift+L)" aria-label="Auto layout">
          <span class="icon" aria-hidden="true">⊞</span>
          <span class="label">Layout</span>
        </button>
      </div>
      <div class="toolbar-section toolbar-center">
        <div class="document-title" id="document-title" role="heading" aria-level="1">
          <span>Untitled</span>
        </div>
      </div>
      <div class="toolbar-section toolbar-right">
        <button class="toolbar-btn primary" id="btn-export" title="Export" aria-label="Export flowchart">
          <span class="icon" aria-hidden="true">↓</span>
          <span class="label">Export</span>
        </button>
      </div>
    </header>

    <main class="workspace">
      <!-- Main Sidebar Menu -->
      <nav class="sidebar-menu" id="sidebar-menu" role="navigation" aria-label="Main menu">
        <div class="menu-section">
          <button class="menu-item" id="menu-new" title="New Flowchart" aria-label="New flowchart">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <span class="menu-label">New</span>
          </button>
          <button class="menu-item" id="menu-save" title="Save (Ctrl+S)" aria-label="Save">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            <span class="menu-label">Save</span>
          </button>
          <button class="menu-item" id="menu-export" title="Export" aria-label="Export">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span class="menu-label">Export</span>
          </button>
        </div>
        <div class="menu-divider" role="separator"></div>
        <div class="menu-section">
          <button class="menu-item active" id="menu-shapes" title="Shapes" aria-label="Shapes panel">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span class="menu-label">Shapes</span>
          </button>
          <button class="menu-item" id="menu-templates" title="Templates" aria-label="Templates">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
            <span class="menu-label">Templates</span>
          </button>
          <button class="menu-item" id="menu-layers" title="Layers" aria-label="Layers panel">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
            <span class="menu-label">Layers</span>
          </button>
        </div>
        <div class="menu-divider" role="separator"></div>
        <div class="menu-section">
          <button class="menu-item" id="menu-layout" title="Auto Layout" aria-label="Auto layout">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="6" height="4" rx="1"/>
              <rect x="15" y="3" width="6" height="4" rx="1"/>
              <rect x="9" y="17" width="6" height="4" rx="1"/>
              <line x1="6" y1="7" x2="6" y2="10"/>
              <line x1="18" y1="7" x2="18" y2="10"/>
              <line x1="6" y1="10" x2="18" y2="10"/>
              <line x1="12" y1="10" x2="12" y2="17"/>
            </svg>
            <span class="menu-label">Layout</span>
          </button>
          <button class="menu-item" id="menu-align" title="Align" aria-label="Align nodes">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="21" y1="10" x2="3" y2="10"/>
              <line x1="21" y1="6" x2="3" y2="6"/>
              <line x1="21" y1="14" x2="3" y2="14"/>
              <line x1="21" y1="18" x2="3" y2="18"/>
            </svg>
            <span class="menu-label">Align</span>
          </button>
        </div>
        <div class="menu-spacer"></div>
        <div class="menu-section">
          <button class="menu-item" id="menu-help" title="Help" aria-label="Help">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span class="menu-label">Help</span>
          </button>
          <button class="menu-item" id="menu-settings" title="Settings" aria-label="Settings">
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span class="menu-label">Settings</span>
          </button>
        </div>
      </nav>

      <!-- Shape Palette Panel -->
      <aside class="sidebar node-palette" id="node-palette">
        <div class="palette-header">
          <span>Shapes</span>
          <button class="panel-collapse" id="palette-collapse" title="Collapse">◀</button>
        </div>
        <div class="palette-search">
          <input type="text" placeholder="Search shapes..." id="shape-search">
        </div>
        <div class="palette-items" id="palette-items">
          <div class="palette-category" data-category="flowchart">
            <div class="category-header">
              <span>Flowchart</span>
            </div>
            <div class="category-items">
              <div class="palette-item" data-type="rectangle" draggable="true">
                <div class="shape-preview shape-rectangle"></div>
                <span>Process</span>
              </div>
              <div class="palette-item" data-type="diamond" draggable="true">
                <div class="shape-preview shape-diamond"></div>
                <span>Decision</span>
              </div>
              <div class="palette-item" data-type="oval" draggable="true">
                <div class="shape-preview shape-oval"></div>
                <span>Start/End</span>
              </div>
              <div class="palette-item" data-type="parallelogram" draggable="true">
                <div class="shape-preview shape-parallelogram"></div>
                <span>Input/Output</span>
              </div>
              <div class="palette-item" data-type="cylinder" draggable="true">
                <div class="shape-preview shape-cylinder"></div>
                <span>Database</span>
              </div>
              <div class="palette-item" data-type="document" draggable="true">
                <div class="shape-preview shape-document"></div>
                <span>Document</span>
              </div>
              <div class="palette-item" data-type="hexagon" draggable="true">
                <div class="shape-preview shape-hexagon"></div>
                <span>Preparation</span>
              </div>
              <div class="palette-item" data-type="manual-input" draggable="true">
                <div class="shape-preview shape-manual-input"></div>
                <span>Input</span>
              </div>
              <div class="palette-item" data-type="delay" draggable="true">
                <div class="shape-preview shape-delay"></div>
                <span>Delay</span>
              </div>
              <div class="palette-item" data-type="display" draggable="true">
                <div class="shape-preview shape-display"></div>
                <span>Display</span>
              </div>
              <div class="palette-item" data-type="connector" draggable="true">
                <div class="shape-preview shape-connector"></div>
                <span>Connector</span>
              </div>
              <div class="palette-item" data-type="off-page-connector" draggable="true">
                <div class="shape-preview shape-off-page-connector"></div>
                <span>Off-Page</span>
              </div>
              <div class="palette-item" data-type="note" draggable="true">
                <div class="shape-preview shape-note"></div>
                <span>Note</span>
              </div>
            </div>
          </div>
          <div class="palette-category" data-category="connectors">
            <div class="category-header">
              <span>Connectors</span>
            </div>
            <div class="category-items">
              <div class="palette-item" data-edge-type="bezier">
                <div class="connector-preview bezier"></div>
                <span>Curved</span>
              </div>
              <div class="palette-item" data-edge-type="straight">
                <div class="connector-preview straight"></div>
                <span>Straight</span>
              </div>
              <div class="palette-item" data-edge-type="orthogonal">
                <div class="connector-preview orthogonal"></div>
                <span>Orthogonal</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Templates Panel (hidden by default) -->
      <aside class="sidebar templates-panel" id="templates-panel" style="display: none;">
        <div class="palette-header">
          <span>Templates</span>
          <button class="panel-collapse" id="templates-collapse" title="Collapse">◀</button>
        </div>
        <div class="palette-items">
          <div class="template-item" data-template="process">
            <div class="template-preview">📊</div>
            <span>Process Flow</span>
          </div>
          <div class="template-item" data-template="decision">
            <div class="template-preview">🔀</div>
            <span>Decision Tree</span>
          </div>
          <div class="template-item" data-template="swimlane">
            <div class="template-preview">🏊</div>
            <span>Swimlane</span>
          </div>
          <div class="template-item" data-template="org">
            <div class="template-preview">👥</div>
            <span>Org Chart</span>
          </div>
        </div>
      </aside>

      <!-- Layers Panel (hidden by default) -->
      <aside class="sidebar layers-panel" id="layers-panel" style="display: none;">
        <div class="palette-header">
          <span>Layers</span>
          <button class="panel-collapse" id="layers-collapse" title="Collapse">◀</button>
        </div>
        <div class="layers-toolbar">
          <button class="layers-btn" id="layer-add" title="Add Layer">+</button>
          <button class="layers-btn" id="layer-delete" title="Delete Layer">🗑</button>
        </div>
        <div class="layers-list" id="layers-list">
          <div class="layer-item active" data-layer="default">
            <span class="layer-visibility">👁</span>
            <span class="layer-name">Default Layer</span>
            <span class="layer-lock">🔓</span>
          </div>
        </div>
      </aside>

      <div class="canvas-container" id="canvas-container">
        <svg class="canvas-grid" id="canvas-grid"></svg>
        <svg class="canvas-main" id="canvas-main">
          <defs>
            <!-- Arrow markers -->
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="currentColor" />
            </marker>
            <marker id="arrow-selected" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="var(--color-selection)" />
            </marker>
          </defs>
          <g id="canvas-edges" class="layer-edges"></g>
          <g id="canvas-nodes" class="layer-nodes"></g>
          <g id="canvas-overlay" class="layer-overlay"></g>
        </svg>
        <div class="canvas-overlay" id="interaction-overlay"></div>
      </div>

      <aside class="sidebar properties-panel" id="properties-panel">
        <div class="panel-header">
          <span>Properties</span>
          <button class="panel-close" id="panel-close">×</button>
        </div>
        <div class="panel-content" id="panel-content">
          <div class="empty-state">
            Select a node or edge to edit its properties
          </div>
        </div>
      </aside>
    </main>

    <div class="minimap" id="minimap">
      <svg class="minimap-canvas" id="minimap-canvas">
        <rect class="minimap-viewport" id="minimap-viewport"></rect>
      </svg>
    </div>

    <div class="context-menu" id="context-menu" style="display: none;">
      <div class="menu-item" data-action="copy">Copy</div>
      <div class="menu-item" data-action="paste">Paste</div>
      <div class="menu-item" data-action="duplicate">Duplicate</div>
      <div class="menu-divider"></div>
      <div class="menu-item" data-action="delete">Delete</div>
      <div class="menu-divider"></div>
      <div class="menu-item" data-action="bring-front">Bring to Front</div>
      <div class="menu-item" data-action="send-back">Send to Back</div>
    </div>

    <div class="toast-container" id="toast-container"></div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private updateWebview(webview: vscode.Webview, document: vscode.TextDocument): void {
    try {
      const content = document.getText();
      const data = content ? JSON.parse(content) : null;
      webview.postMessage({
        type: 'load',
        payload: data,
      });
    } catch (error) {
      console.error('Failed to parse flowchart document:', error);
      webview.postMessage({
        type: 'error',
        payload: { message: 'Failed to parse flowchart document' },
      });
    }
  }

  private async handleMessage(
    message: { type: string; payload: unknown; requestId?: string },
    document: vscode.TextDocument
  ): Promise<void> {
    switch (message.type) {
      case 'save': {
        const content = JSON.stringify(message.payload, null, 2);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
          document.uri,
          new vscode.Range(0, 0, document.lineCount, 0),
          content
        );
        await vscode.workspace.applyEdit(edit);
        break;
      }

      case 'command': {
        const payload = message.payload as { command: string };
        if (payload.command === 'newFlowchart') {
          vscode.commands.executeCommand('flowchartBuilder.newFlowchart');
        }
        break;
      }

      case 'export': {
        const payload = message.payload as { format: string; data: string };
        await this.handleExport(payload.format, payload.data, document);
        break;
      }

      case 'showMessage': {
        const payload = message.payload as { type: 'info' | 'warn' | 'error'; message: string };
        switch (payload.type) {
          case 'info':
            vscode.window.showInformationMessage(payload.message);
            break;
          case 'warn':
            vscode.window.showWarningMessage(payload.message);
            break;
          case 'error':
            vscode.window.showErrorMessage(payload.message);
            break;
        }
        break;
      }

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private async handleExport(
    format: string,
    data: string,
    document: vscode.TextDocument
  ): Promise<void> {
    const defaultName = path.basename(document.uri.fsPath, '.flowchart');
    const extension = format === 'json' ? 'json' : format;

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${defaultName}.${extension}`),
      filters: {
        [format.toUpperCase()]: [extension],
      },
    });

    if (uri) {
      const content = (format === 'json' || format === 'svg') ? data : Buffer.from(data.split(',')[1] ?? '', 'base64');
      await vscode.workspace.fs.writeFile(
        uri,
        typeof content === 'string' ? Buffer.from(content) : content
      );
      vscode.window.showInformationMessage(`Exported to ${uri.fsPath}`);
    }
  }
}
