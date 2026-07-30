import { WebSocket } from "ws";
import type { LiveMessage } from "../schemas/api.js";

export type MessageCreatedEvent = {
  conversationId: string;
  message: LiveMessage;
  type: "message.created";
};

const MAX_BUFFERED_BYTES = 256 * 1024;

export class MessageHub {
  readonly #subscriptions = new Map<string, Set<WebSocket>>();

  subscribe(conversationId: string, socket: WebSocket) {
    const subscribers =
      this.#subscriptions.get(conversationId) ?? new Set<WebSocket>();
    subscribers.add(socket);
    this.#subscriptions.set(conversationId, subscribers);
    return () => {
      subscribers.delete(socket);
      if (subscribers.size === 0) {
        this.#subscriptions.delete(conversationId);
      }
    };
  }

  publish(event: MessageCreatedEvent) {
    const payload = JSON.stringify(event);
    for (const socket of this.#subscriptions.get(event.conversationId) ?? []) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
        socket.close(1013, "Client is not keeping up");
        continue;
      }
      socket.send(payload);
    }
  }
}
