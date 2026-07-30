import { expect, it, vi } from "vitest";
import { subscribeToConversation } from "./live-chat";

it("validates and deduplicates durable realtime message events", () => {
  const onMessage = vi.fn();
  let socket: {
    onmessage: ((event: { data: string }) => void) | null;
  } | null = null;
  const createSocket = vi.fn(() => {
    socket = {
      onmessage: null,
      onopen: null,
      onclose: null,
      close: vi.fn(),
      send: vi.fn(),
      readyState: 1,
    } as never;
    return socket as never;
  });

  const unsubscribe = subscribeToConversation("m1", onMessage, {
    createSocket,
  });
  const payload = JSON.stringify({
    type: "message.created",
    conversationId: "m1",
    message: {
      id: "message_1",
      conversationId: "m1",
      authorId: "maya",
      author: "Maya Chen",
      initials: "MC",
      color: "ink",
      body: "Hello from the live channel",
      createdAt: "2026-07-30T12:00:00.000Z",
    },
  });
  socket!.onmessage!({ data: payload });
  socket!.onmessage!({ data: payload });
  socket!.onmessage!({ data: JSON.stringify({ type: "unknown" }) });

  expect(onMessage).toHaveBeenCalledTimes(1);
  expect(onMessage).toHaveBeenCalledWith(
    expect.objectContaining({ id: "message_1" }),
  );
  unsubscribe();
});
