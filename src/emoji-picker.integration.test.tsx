import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

vi.stubGlobal(
  "IntersectionObserver",
  class {
    constructor(
      private readonly callback: IntersectionObserverCallback,
    ) {}
    disconnect() {}
    observe(target: Element) {
      this.callback(
        [
          {
            intersectionRatio: 1,
            isIntersecting: true,
            target,
          } as IntersectionObserverEntry,
        ],
        this as unknown as IntersectionObserver,
      );
    }
    takeRecords() {
      return [];
    }
    unobserve() {}
  },
);

vi.mock("./services/api", () => ({
  createDirectConversation: vi.fn(),
  loadMessages: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  postMessage: vi.fn(),
}));
vi.mock("./services/live-chat", () => ({
  subscribeToConversation: vi.fn(() => vi.fn()),
}));

import { MessageWorkspace } from "./App";

it("inserts a selected emoji from the real picker into the message draft", async () => {
  const user = userEvent.setup();
  render(
    <MessageWorkspace
      conversations={[
        {
          id: "conversation_1",
          communityId: "c1",
          title: "General",
          type: "community",
          updatedAt: "2026-07-30T12:00:00.000Z",
          lastMessage: null,
        },
      ]}
      viewerId="maya"
    />,
  );

  await user.click(screen.getByRole("button", { name: /add emoji/i }));
  const grinningFace = await screen.findByRole("button", {
    name: "grinning face",
  });
  expect(
    screen.queryByRole("img", { name: "grinning face" }),
  ).not.toBeInTheDocument();
  await user.click(grinningFace);

  expect(screen.getByLabelText(/^message$/i)).toHaveValue("😀");
  expect(
    screen.queryByRole("dialog", { name: /emoji picker/i }),
  ).not.toBeInTheDocument();
});
