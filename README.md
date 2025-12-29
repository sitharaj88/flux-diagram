<div align="center">
  <img src="media/flux-icon.png" alt="FluxDiagram Logo" width="128" />
  <h1>FluxDiagram</h1>
  <p><strong>The Professional Flowchart & Diagram Builder for VS Code</strong></p>
  
  [![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC.svg?style=flat&logo=visual-studio-code&logoColor=white)](https://marketplace.visualstudio.com/vscode)
  [![License](https://img.shields.io/badge/License-Apache_2.0-green.svg?style=flat)](https://github.com/sitharaj88/flux-diagram/blob/main/LICENSE)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Version](https://img.shields.io/badge/version-1.0.1-blue.svg?style=flat)](https://github.com/sitharaj88/flux-diagram/blob/main/package.json)

  <p>
    Design beautiful, complex flowcharts and diagrams directly within VS Code. <br>
    Built with modern web technologies, Glassmorphism UI, and high-performance rendering.
  </p>
</div>

---

## ✨ Features

### 🎨 Modern & Beautiful UI
- **Premium Glassmorphism Design**: A sleek, modern interface that fits right into 2024.
- **Adaptive Theming**: Seamlessly switches between Dark and Light modes based on your VS Code theme.
- **Retina Ready**: Crisp SVG-based rendering for all shapes and connections.

### 🛠️ Powerful Editing Tools
- **Rich Node Library**: Over 15+ standard shapes including flowcharts, decision trees, and process symbols.
- **Smart Connections**:
  - **Bezier Curves**: Smooth, elegant lines for organic flows.
  - **Orthogonal**: Structured, right-angle lines for technical diagrams.
  - **Straight**: Direct connections for simple graphs.
- **Snap-to-Grid**: Precision alignment with customizable grid snapping (Toggleable).
- **Minimap**: Navigate large diagrams with ease using the interactive minimap.

### ⚡ Advanced Productivity
- **Auto-Layout**: Instantly organize messy diagrams with hierarchical or force-directed layouts.
- **Export Options**: Export your work to high-quality **PNG** or **SVG** for reports and presentations.
- **History Management**: Robust Undo/Redo system capturing every movement and edit.
- **Keyboard Shortcuts**: Designed for power users to speed up workflows.

---

## 🚀 Getting Started

### Installation
1. Search for **FluxDiagram** in the VS Code Marketplace.
2. Click **Install**.

### Usage
1. Open the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Type **"New Fluxdiagram"** and verify the file extension is `.fluxdiagram`.
3. The editor will open automatically.

### Creating Your First Diagram
1. **Drag & Drop** shapes from the left sidebar onto the infinite canvas.
2. **Connect** nodes by dragging from one port (dot) to another.
3. **Edit Text** by double-clicking on any node.
4. **Style** your diagram using the properties panel (coming soon) or auto-layout features.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl` + `S` | **Save** | Save the diagram to disk |
| `Ctrl` + `Z` | **Undo** | Revert last action |
| `Ctrl` + `Y` | **Redo** | Re-apply last undone action |
| `Delete` | **Delete** | Remove selected nodes/edges |
| `Ctrl` + `A` | **Select All** | Select all elements on canvas |
| `Ctrl` + `+` | **Zoom In** | Increase canvas zoom level |
| `Ctrl` + `-` | **Zoom Out** | Decrease canvas zoom level |
| `Ctrl` + `0` | **Fit to View** | Reset zoom to fit all content |
| `Space` + `Drag` | **Pan** | Pan around the canvas |

---

## 🏗️ Architecture

FluxDiagram is built with a modern stack ensuring performance and maintainability:

- **Core**: VS Code Webview API & Custom Editor API
- **Language**: TypeScript (Strict Mode)
- **Rendering**: SVG-based custom rendering engine (No heavy third-party canvas libs)
- **Bundling**: esbuild for lightning-fast builds
- **State**: Centralized state management with command pattern for history

---

## 📄 License

This project is licensed under the **Apache 2.0 License** - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Built with ❤️ by sitharaj</sub>
</div>
