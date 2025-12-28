/**
 * Main Webview Application for Flowchart Builder
 * Handles canvas rendering, interactions, and state synchronization
 */

import { FlowchartApp } from './app/FlowchartApp';

// VS Code API interface
interface VSCodeAPI {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeAPI;

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const vscode = acquireVsCodeApi();
    const app = new FlowchartApp(vscode);

    // Make app available globally for debugging
    (window as unknown as { flowchartApp: FlowchartApp }).flowchartApp = app;

    // Handle messages from extension
    window.addEventListener('message', (event) => {
        const message = event.data;
        app.handleMessage(message);
    });

    // Signal ready
    vscode.postMessage({ type: 'ready' });
});
