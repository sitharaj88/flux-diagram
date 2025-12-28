import { StateManager } from '../../src/core/state';

describe('StateManager', () => {
    let stateManager: StateManager;

    beforeEach(() => {
        stateManager = new StateManager({ undoLimit: 10 });
    });

    describe('Node Operations', () => {
        test('should add a node', () => {
            const node = stateManager.addNode({ type: 'rectangle', position: { x: 100, y: 100 } });
            expect(node).toBeDefined();
            expect(node.type).toBe('rectangle');
            expect(stateManager.getAllNodes().length).toBe(1);
        });

        test('should delete a node', () => {
            const node = stateManager.addNode({ type: 'rectangle', position: { x: 100, y: 100 } });
            stateManager.deleteNode(node.id);
            expect(stateManager.getAllNodes().length).toBe(0);
        });

        test('should move a node', () => {
            const node = stateManager.addNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            stateManager.moveNode(node.id, { x: 200, y: 150 });
            const updated = stateManager.getNode(node.id);
            expect(updated?.position).toEqual({ x: 200, y: 150 });
        });

        test('should update node data', () => {
            const node = stateManager.addNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            stateManager.updateNodeData(node.id, { label: 'Updated Label' });
            const updated = stateManager.getNode(node.id);
            expect(updated?.data.label).toBe('Updated Label');
        });
    });

    describe('Undo/Redo', () => {
        test('should undo add node', () => {
            stateManager.addNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            expect(stateManager.getAllNodes().length).toBe(1);

            stateManager.undo();
            expect(stateManager.getAllNodes().length).toBe(0);
        });

        test('should redo undone action', () => {
            stateManager.addNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            stateManager.undo();
            stateManager.redo();
            expect(stateManager.getAllNodes().length).toBe(1);
        });

        test('should clear redo stack on new action', () => {
            stateManager.addNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            stateManager.undo();
            expect(stateManager.canRedo()).toBe(true);

            stateManager.addNode({ type: 'diamond', position: { x: 100, y: 100 } });
            expect(stateManager.canRedo()).toBe(false);
        });

        test('should respect undo limit', () => {
            // Add 15 nodes (limit is 10)
            for (let i = 0; i < 15; i++) {
                stateManager.addNode({ type: 'rectangle', position: { x: i * 10, y: 0 } });
            }

            // Should only be able to undo 10 times
            let undoCount = 0;
            while (stateManager.canUndo()) {
                stateManager.undo();
                undoCount++;
            }
            expect(undoCount).toBe(10);
        });
    });

    describe('Selection', () => {
        test('should select a node', () => {
            const node = stateManager.addNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            stateManager.setSelection({ type: 'node', ids: [node.id] });

            const selection = stateManager.getSelection();
            expect(selection.type).toBe('node');
            expect(selection.ids).toContain(node.id);
        });

        test('should clear selection', () => {
            const node = stateManager.addNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            stateManager.setSelection({ type: 'node', ids: [node.id] });
            stateManager.clearSelection();

            const selection = stateManager.getSelection();
            expect(selection.ids.length).toBe(0);
        });
    });

    describe('Document', () => {
        test('should save and load document', () => {
            stateManager.addNode({ type: 'rectangle', position: { x: 100, y: 100 }, data: { label: 'Test' } });
            stateManager.addNode({ type: 'diamond', position: { x: 300, y: 200 } });

            const doc = stateManager.saveDocument();
            expect(doc.nodes.length).toBe(2);

            const newStateManager = new StateManager();
            newStateManager.loadDocument(doc);
            expect(newStateManager.getAllNodes().length).toBe(2);
        });

        test('should track dirty state', () => {
            expect(stateManager.getIsDirty()).toBe(false);
            stateManager.addNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            expect(stateManager.getIsDirty()).toBe(true);

            stateManager.saveDocument();
            expect(stateManager.getIsDirty()).toBe(false);
        });
    });

    describe('Batch Operations', () => {
        test('should batch multiple operations into one undo', () => {
            stateManager.beginBatch();
            stateManager.addNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            stateManager.addNode({ type: 'diamond', position: { x: 100, y: 0 } });
            stateManager.addNode({ type: 'oval', position: { x: 200, y: 0 } });
            stateManager.endBatch('Add 3 nodes');

            expect(stateManager.getAllNodes().length).toBe(3);

            // Single undo should remove all 3
            stateManager.undo();
            expect(stateManager.getAllNodes().length).toBe(0);
        });
    });
});
