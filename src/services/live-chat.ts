import {
  messageCreatedEventSchema,
  type LiveMessage,
} from "../../server/src/schemas/api.ts";

type SubscriptionOptions = {
  createSocket?: (url: string) => WebSocket;
};

const MAX_RECONNECT_DELAY_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_DEDUPLICATION_IDS = 500;

export const subscribeToConversation = (
  conversationId: string,
  onMessage: (message: LiveMessage) => void,
  options: SubscriptionOptions = {},
) => {
  const createSocket =
    options.createSocket ?? ((url: string) => new WebSocket(url));
  const seenMessageIds = new Set<string>();
  let stopped = false;
  let reconnectDelay = 1_000;
  let reconnectTimer: number | undefined;
  let heartbeatTimer: number | undefined;
  let socket: WebSocket | undefined;

  const clearTimers = () => {
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    if (heartbeatTimer !== undefined) window.clearInterval(heartbeatTimer);
    reconnectTimer = undefined;
    heartbeatTimer = undefined;
  };

  const rememberMessage = (messageId: string) => {
    seenMessageIds.add(messageId);
    if (seenMessageIds.size > MAX_DEDUPLICATION_IDS) {
      const oldest = seenMessageIds.values().next().value;
      if (typeof oldest === "string") seenMessageIds.delete(oldest);
    }
  };

  const connect = () => {
    if (stopped) return;
    const socketProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = new URL(
      `/api/v1/conversations/${encodeURIComponent(conversationId)}/live`,
      `${socketProtocol}//${window.location.host}`,
    );
    socket = createSocket(url.href);
    socket.onopen = () => {
      reconnectDelay = 1_000;
      heartbeatTimer = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, HEARTBEAT_INTERVAL_MS);
    };
    socket.onmessage = (event) => {
      let payload: unknown;
      try {
        payload = JSON.parse(String(event.data)) as unknown;
      } catch {
        return;
      }
      const parsed = messageCreatedEventSchema.safeParse(payload);
      if (
        !parsed.success ||
        parsed.data.conversationId !== conversationId ||
        seenMessageIds.has(parsed.data.message.id)
      ) {
        return;
      }
      rememberMessage(parsed.data.message.id);
      onMessage(parsed.data.message);
    };
    socket.onclose = () => {
      if (heartbeatTimer !== undefined) window.clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
      if (stopped) return;
      reconnectTimer = window.setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(
        reconnectDelay * 2,
        MAX_RECONNECT_DELAY_MS,
      );
    };
  };

  connect();
  return () => {
    stopped = true;
    clearTimers();
    socket?.close(1000, "Leaving conversation");
  };
};
