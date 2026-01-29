# Changelog

All notable changes to the FluxDiagram extension will be documented in this file.

## [1.1.0] - 2026-01-29

### Added
- **Search/Find Nodes** (`Ctrl+F` / `Cmd+F`) - Quick search dialog to find nodes by label or description
- **Node Grouping** (`Ctrl+G` / `Cmd+G`) - Group multiple selected nodes together
- **Ungroup** (`Ctrl+Shift+G` / `Cmd+Shift+G`) - Break apart grouped nodes
- **Arrow Key Nudging** - Move selected nodes with arrow keys (1px), hold Shift for 10px
- **Distribute Horizontally/Vertically** - Evenly space 3+ selected nodes
- **Z-Order Shortcuts** - `Ctrl+Shift+]` bring to front, `Ctrl+Shift+[` send to back

### Enhanced
- **Properties Panel** - Completely redesigned with:
  - Color pickers with hex value display
  - Border width and radius controls
  - Opacity slider with percentage display
  - Shadow toggle
  - Text alignment buttons (left/center/right)
  - Compact position and size inputs
- **Alignment Toolbar** - Now includes distribution options with intuitive icons
- **Help Dialog** - Reorganized into categories with all new shortcuts documented

### Fixed
- Fixed missing node type definitions for manual-input, delay, display, connector, off-page-connector, and note shapes
- Fixed StateManager missing `layers` property when saving documents
- All unit tests now pass (23/23)

## [1.0.4] - Previous Release

- Initial stable release with core diagram editing functionality
- 15+ node shapes
- Multiple edge types (bezier, orthogonal, straight, step)
- Auto-layout engine
- Export to PNG, SVG, JSON
- Layer management
- Minimap navigation
- Undo/Redo history
