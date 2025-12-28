import { Graph, createNode, createEdge } from '../../src/core/models';

describe('Graph', () => {
    let graph: Graph;

    beforeEach(() => {
        graph = new Graph();
    });

    describe('Node Operations', () => {
        test('should add a node', () => {
            const node = createNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            graph.addNode(node);
            expect(graph.getNode(node.id)).toBeDefined();
            expect(graph.getNodeCount()).toBe(1);
        });

        test('should remove a node', () => {
            const node = createNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            graph.addNode(node);
            graph.removeNode(node.id);
            expect(graph.getNode(node.id)).toBeUndefined();
            expect(graph.getNodeCount()).toBe(0);
        });

        test('should update a node', () => {
            const node = createNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            graph.addNode(node);
            graph.updateNode(node.id, { position: { x: 100, y: 100 } });
            const updated = graph.getNode(node.id);
            expect(updated?.position).toEqual({ x: 100, y: 100 });
        });
    });

    describe('Edge Operations', () => {
        test('should add an edge between nodes', () => {
            const node1 = createNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            const node2 = createNode({ type: 'rectangle', position: { x: 200, y: 0 } });
            graph.addNode(node1);
            graph.addNode(node2);

            const edge = createEdge({
                sourceNodeId: node1.id,
                sourcePortId: node1.ports[0]!.id,
                targetNodeId: node2.id,
                targetPortId: node2.ports[0]!.id,
            });
            const success = graph.addEdge(edge);

            expect(success).toBe(true);
            expect(graph.getEdgeCount()).toBe(1);
        });

        test('should not add edge for non-existent nodes', () => {
            const edge = createEdge({
                sourceNodeId: 'fake-1',
                sourcePortId: 'fake-port-1',
                targetNodeId: 'fake-2',
                targetPortId: 'fake-port-2',
            });
            const success = graph.addEdge(edge);
            expect(success).toBe(false);
        });

        test('should remove edges when node is removed', () => {
            const node1 = createNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            const node2 = createNode({ type: 'rectangle', position: { x: 200, y: 0 } });
            graph.addNode(node1);
            graph.addNode(node2);

            const edge = createEdge({
                sourceNodeId: node1.id,
                sourcePortId: node1.ports[0]!.id,
                targetNodeId: node2.id,
                targetPortId: node2.ports[0]!.id,
            });
            graph.addEdge(edge);

            graph.removeNode(node1.id);
            expect(graph.getEdgeCount()).toBe(0);
        });
    });

    describe('Graph Analysis', () => {
        test('should find root nodes', () => {
            const node1 = createNode({ type: 'oval', position: { x: 0, y: 0 } });
            const node2 = createNode({ type: 'rectangle', position: { x: 0, y: 100 } });
            const node3 = createNode({ type: 'rectangle', position: { x: 0, y: 200 } });
            graph.addNode(node1);
            graph.addNode(node2);
            graph.addNode(node3);

            const edge1 = createEdge({
                sourceNodeId: node1.id,
                sourcePortId: node1.ports[0]!.id,
                targetNodeId: node2.id,
                targetPortId: node2.ports[0]!.id,
            });
            const edge2 = createEdge({
                sourceNodeId: node2.id,
                sourcePortId: node2.ports[1]!.id,
                targetNodeId: node3.id,
                targetPortId: node3.ports[0]!.id,
            });
            graph.addEdge(edge1);
            graph.addEdge(edge2);

            const roots = graph.getRootNodes();
            expect(roots.length).toBe(1);
            expect(roots[0]?.id).toBe(node1.id);
        });

        test('should detect cycles', () => {
            const node1 = createNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            const node2 = createNode({ type: 'rectangle', position: { x: 100, y: 0 } });
            graph.addNode(node1);
            graph.addNode(node2);

            graph.addEdge(createEdge({
                sourceNodeId: node1.id,
                sourcePortId: node1.ports[0]!.id,
                targetNodeId: node2.id,
                targetPortId: node2.ports[0]!.id,
            }));
            graph.addEdge(createEdge({
                sourceNodeId: node2.id,
                sourcePortId: node2.ports[1]!.id,
                targetNodeId: node1.id,
                targetPortId: node1.ports[1]!.id,
            }));

            expect(graph.hasCycle()).toBe(true);
        });

        test('should calculate bounds', () => {
            const node1 = createNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            const node2 = createNode({ type: 'rectangle', position: { x: 300, y: 200 } });
            graph.addNode(node1);
            graph.addNode(node2);

            const bounds = graph.getBounds();
            expect(bounds).toBeDefined();
            expect(bounds!.x).toBe(0);
            expect(bounds!.y).toBe(0);
        });
    });

    describe('Serialization', () => {
        test('should serialize and deserialize', () => {
            const node1 = createNode({ type: 'rectangle', position: { x: 0, y: 0 } });
            const node2 = createNode({ type: 'diamond', position: { x: 200, y: 100 } });
            graph.addNode(node1);
            graph.addNode(node2);

            const json = graph.toJSON();
            const newGraph = Graph.fromJSON(json);

            expect(newGraph.getNodeCount()).toBe(2);
            expect(newGraph.getNode(node1.id)).toBeDefined();
            expect(newGraph.getNode(node2.id)).toBeDefined();
        });
    });
});
