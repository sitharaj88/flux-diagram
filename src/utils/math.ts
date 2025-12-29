/**
 * Math and geometry utilities
 */

import type { Position, Bounds } from '@types/index';

/**
 * Clamps a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * Calculates the distance between two points
 */
export function distance(p1: Position, p2: Position): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the squared distance between two points (faster, no sqrt)
 */
export function distanceSquared(p1: Position, p2: Position): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return dx * dx + dy * dy;
}

/**
 * Snaps a value to a grid
 */
export function snapToGrid(value: number, gridSize: number): number {
    return Math.round(value / gridSize) * gridSize;
}

/**
 * Snaps a position to a grid
 */
export function snapPositionToGrid(position: Position, gridSize: number): Position {
    return {
        x: snapToGrid(position.x, gridSize),
        y: snapToGrid(position.y, gridSize),
    };
}

/**
 * Checks if two bounds intersect
 */
export function boundsIntersect(a: Bounds, b: Bounds): boolean {
    return !(
        a.x + a.width < b.x ||
        b.x + b.width < a.x ||
        a.y + a.height < b.y ||
        b.y + b.height < a.y
    );
}

/**
 * Checks if bounds A contains bounds B completely
 */
export function boundsContains(outer: Bounds, inner: Bounds): boolean {
    return (
        outer.x <= inner.x &&
        outer.y <= inner.y &&
        outer.x + outer.width >= inner.x + inner.width &&
        outer.y + outer.height >= inner.y + inner.height
    );
}

/**
 * Checks if a point is inside bounds
 */
export function pointInBounds(point: Position, bounds: Bounds): boolean {
    return (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
    );
}

/**
 * Gets the center of bounds
 */
export function getBoundsCenter(bounds: Bounds): Position {
    return {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
    };
}

/**
 * Expands bounds by a given amount on all sides
 */
export function expandBounds(bounds: Bounds, amount: number): Bounds {
    return {
        x: bounds.x - amount,
        y: bounds.y - amount,
        width: bounds.width + amount * 2,
        height: bounds.height + amount * 2,
    };
}

/**
 * Merges multiple bounds into a single bounding box
 */
export function mergeBounds(boundsList: Bounds[]): Bounds | null {
    if (boundsList.length === 0) {
        return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const b of boundsList) {
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
    }

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

/**
 * Calculates the angle between two points in radians
 */
export function angle(from: Position, to: Position): number {
    return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Converts degrees to radians
 */
export function degToRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees
 */
export function radToDeg(radians: number): number {
    return (radians * 180) / Math.PI;
}

/**
 * Rotates a point around a center point
 */
export function rotatePoint(point: Position, center: Position, angleRad: number): Position {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
    };
}

/**
 * Calculates control points for a cubic bezier curve between two points
 */
export function calculateBezierControlPoints(
    start: Position,
    end: Position,
    _curvature = 0.5
): [Position, Position] {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const midX = (start.x + end.x) / 2;

    // For horizontal-ish connections, curve vertically
    // For vertical-ish connections, curve horizontally
    const isHorizontal = Math.abs(dx) > Math.abs(dy);

    if (isHorizontal) {
        return [
            { x: midX, y: start.y },
            { x: midX, y: end.y },
        ];
    } else {
        const midY = (start.y + end.y) / 2;
        return [
            { x: start.x, y: midY },
            { x: end.x, y: midY },
        ];
    }
}

/**
 * Gets a point on a cubic bezier curve at parameter t (0-1)
 */
export function bezierPoint(
    p0: Position,
    p1: Position,
    p2: Position,
    p3: Position,
    t: number
): Position {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    return {
        x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
        y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
    };
}
