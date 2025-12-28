# Flowchart Builder

Enterprise-level VS Code extension for creating and managing flowcharts with modern UI.

![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- 🎨 **Modern UI** with glassmorphism design
- 🌓 **Dark/Light themes** that follow VS Code
- 📐 **7+ Node shapes** (rectangle, diamond, oval, parallelogram, etc.)
- 🔗 **Smart connections** with bezier, orthogonal, and straight edges
- ↩️ **Undo/Redo** with 50+ operation history
- 🔍 **Zoom & Pan** with mouse wheel and keyboard
- 🗺️ **Minimap** for navigation
- 📦 **Export** to JSON, SVG
- ⌨️ **Keyboard shortcuts** for power users

## Installation

```bash
# Clone the repository
cd flowchart-builder

# Install dependencies
npm install

# Build
npm run build
```

## Development

```bash
# Watch mode with hot reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

Press **F5** in VS Code to launch the Extension Development Host.

## Usage

1. Create a new flowchart: `Ctrl+Shift+P` → "Flowchart: New"
2. Drag shapes from the left palette onto the canvas
3. Click on ports to create connections
4. Double-click nodes to edit labels
5. Use `Ctrl+S` to save

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+C` | Copy |
| `Ctrl+V` | Paste |
| `Ctrl+D` | Duplicate |
| `Ctrl+A` | Select All |
| `Delete` | Delete selected |
| `Ctrl+=` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Fit to view |
| `Alt+Drag` | Pan canvas |

## Architecture

```
src/
├── core/           # Domain logic
│   ├── models/     # Node, Edge, Graph
│   ├── state/      # State management
│   └── events/     # Event bus
├── webview/        # UI
│   ├── app/        # Components
│   └── styles/     # CSS
├── extension.ts    # Entry point
└── FlowchartEditorProvider.ts
```

## License

MIT
