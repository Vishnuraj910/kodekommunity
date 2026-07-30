import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SocialComposer } from "./SocialComposer";

const callbacks = {
  onClose: vi.fn(),
  onCreateBroadcast: vi.fn().mockResolvedValue(undefined),
  onCreateChannel: vi.fn().mockResolvedValue(undefined),
  onCreateGroup: vi.fn().mockResolvedValue(undefined),
  onCreatePost: vi.fn().mockResolvedValue(undefined),
};

describe("SocialComposer", () => {
  it("only offers post creation to a regular member", () => {
    render(<SocialComposer {...callbacks} canManageCommunity={false} />);

    expect(screen.getByRole("tab", { name: /post/i })).toBeVisible();
    expect(
      screen.queryByRole("tab", { name: /broadcast/i }),
    ).not.toBeInTheDocument();
  });

  it("lets an administrator schedule a broadcast", async () => {
    const user = userEvent.setup();
    const onCreateBroadcast = vi.fn().mockResolvedValue(undefined);
    render(
      <SocialComposer
        {...callbacks}
        canManageCommunity
        onCreateBroadcast={onCreateBroadcast}
      />,
    );

    await user.click(screen.getByRole("tab", { name: /broadcast/i }));
    await user.type(screen.getByLabelText(/broadcast title/i), "Office hours");
    await user.type(
      screen.getByLabelText(/broadcast details/i),
      "Bring deployment and observability questions.",
    );
    await user.type(
      screen.getByLabelText(/starts at/i),
      "2026-08-30T18:00",
    );
    await user.click(screen.getByRole("button", { name: /schedule broadcast/i }));

    expect(onCreateBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Office hours",
        body: "Bring deployment and observability questions.",
      }),
    );
  });
});
