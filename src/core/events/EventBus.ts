/**
 * Type-safe Event Bus for communication between layers
 */

import type { EventType, FlowEvent, UUID } from '../../types';

type EventCallback<T = unknown> = (event: FlowEvent<T>) => void;

interface Subscription {
    id: UUID;
    type: EventType;
    callback: EventCallback;
    once: boolean;
}

export class EventBus {
    private subscriptions: Map<EventType, Subscription[]>;
    private allSubscriptions: Subscription[];
    private subscriptionCounter: number;

    constructor() {
        this.subscriptions = new Map();
        this.allSubscriptions = [];
        this.subscriptionCounter = 0;
    }

    /**
     * Subscribe to a specific event type
     */
    on<T = unknown>(type: EventType, callback: EventCallback<T>): () => void {
        return this.subscribe(type, callback as EventCallback, false);
    }

    /**
     * Subscribe to an event type, but only fire once
     */
    once<T = unknown>(type: EventType, callback: EventCallback<T>): () => void {
        return this.subscribe(type, callback as EventCallback, true);
    }

    /**
     * Subscribe to all events
     */
    onAll(callback: EventCallback): () => void {
        const id = `sub_${++this.subscriptionCounter}`;
        const subscription: Subscription = {
            id,
            type: 'node:added' as EventType, // Placeholder, not used for all subscriptions
            callback,
            once: false,
        };
        this.allSubscriptions.push(subscription);

        return () => {
            this.allSubscriptions = this.allSubscriptions.filter((s) => s.id !== id);
        };
    }

    /**
     * Emit an event to all subscribers
     */
    emit<T = unknown>(type: EventType, payload: T): void {
        const event: FlowEvent<T> = {
            type,
            payload,
            timestamp: Date.now(),
        };

        // Notify specific subscribers
        const subscribers = this.subscriptions.get(type) ?? [];
        const toRemove: string[] = [];

        subscribers.forEach((subscription) => {
            try {
                subscription.callback(event);
                if (subscription.once) {
                    toRemove.push(subscription.id);
                }
            } catch (error) {
                console.error(`Error in event handler for ${type}:`, error);
            }
        });

        // Remove once subscriptions
        if (toRemove.length > 0) {
            this.subscriptions.set(
                type,
                subscribers.filter((s) => !toRemove.includes(s.id))
            );
        }

        // Notify all-event subscribers
        this.allSubscriptions.forEach((subscription) => {
            try {
                subscription.callback(event);
            } catch (error) {
                console.error(`Error in all-event handler:`, error);
            }
        });
    }

    /**
     * Remove all subscriptions for a specific event type
     */
    off(type: EventType): void {
        this.subscriptions.delete(type);
    }

    /**
     * Remove all subscriptions
     */
    clear(): void {
        this.subscriptions.clear();
        this.allSubscriptions = [];
    }

    /**
     * Get the number of subscribers for a specific event type
     */
    listenerCount(type: EventType): number {
        return (this.subscriptions.get(type) ?? []).length + this.allSubscriptions.length;
    }

    /**
     * Check if there are any subscribers for a specific event type
     */
    hasListeners(type: EventType): boolean {
        return this.listenerCount(type) > 0;
    }

    private subscribe(type: EventType, callback: EventCallback, once: boolean): () => void {
        const id = `sub_${++this.subscriptionCounter}`;
        const subscription: Subscription = {
            id,
            type,
            callback,
            once,
        };

        const existing = this.subscriptions.get(type) ?? [];
        this.subscriptions.set(type, [...existing, subscription]);

        // Return unsubscribe function
        return () => {
            const subs = this.subscriptions.get(type) ?? [];
            this.subscriptions.set(
                type,
                subs.filter((s) => s.id !== id)
            );
        };
    }
}

// Singleton instance for global event bus
let globalEventBus: EventBus | null = null;

export function getEventBus(): EventBus {
    if (!globalEventBus) {
        globalEventBus = new EventBus();
    }
    return globalEventBus;
}

export function resetEventBus(): void {
    globalEventBus?.clear();
    globalEventBus = null;
}
