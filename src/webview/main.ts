/**
 * Main Webview Application for Fluxdiagram Builder
 * Handles canvas rendering, interactions, and state synchronization
 */

import { FluxdiagramApp } from './app/FluxdiagramApp';

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
    const app = new FluxdiagramApp(vscode);

    // Make app available globally for debugging
    (window as unknown as { fluxdiagramApp: FluxdiagramApp }).fluxdiagramApp = app;

    // Handle messages from extension
    window.addEventListener('message', (event) => {
        const message = event.data as { type: string; payload: unknown };
        app.handleMessage(message);
    });

    // Signal ready
    vscode.postMessage({ type: 'ready' });
});
