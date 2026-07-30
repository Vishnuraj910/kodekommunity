import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import {
  NotificationCenter,
  type AppNotification,
} from "./NotificationCenter";

const notification: AppNotification = {
  id: "notification_1",
  title: "New message from Lee Morgan",
  description: "The architecture channel has a new reply.",
  createdAt: "2026-07-30T12:00:00.000Z",
  destination: {
    page: "messages",
    conversationId: "conversation_1",
  },
};

it("shows incoming notifications as toasts and keeps them in an actionable list", async () => {
  const user = userEvent.setup();
  const onClear = vi.fn();
  const onClearAll = vi.fn();
  const onDismissToast = vi.fn();
  const onOpen = vi.fn();

  const { rerender } = render(
    <NotificationCenter
      notifications={[notification]}
      toasts={[notification]}
      onClear={onClear}
      onClearAll={onClearAll}
      onDismissToast={onDismissToast}
      onOpen={onOpen}
    />,
  );

  expect(screen.getByRole("status")).toHaveTextContent(
    "New message from Lee Morgan",
  );
  await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
  const toast = screen.getByRole("status");
  expect(toast).toHaveAttribute("data-state", "closed");
  expect(onDismissToast).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(onDismissToast).toHaveBeenCalledWith(notification.id),
  );

  await user.click(screen.getByRole("button", { name: "Notifications (1 unread)" }));
  const list = screen.getByRole("region", { name: "Notification list" });
  expect(within(list).getByRole("heading", { name: "Notifications" })).toBeVisible();
  expect(within(list).getByText(notification.description)).toBeVisible();

  await user.click(
    screen.getByRole("button", {
      name: "Open notification: New message from Lee Morgan",
    }),
  );
  expect(onOpen).toHaveBeenCalledWith(notification);

  await user.click(screen.getByRole("button", { name: "Notifications (1 unread)" }));
  await user.click(
    screen.getByRole("button", {
      name: "Clear notification: New message from Lee Morgan",
    }),
  );
  const reopenedList = screen.getByRole("region", { name: "Notification list" });
  const clearingItem = within(reopenedList).getByRole("listitem");
  expect(clearingItem).toHaveAttribute("data-state", "removing");
  expect(onClear).not.toHaveBeenCalled();
  await waitFor(() => expect(onClear).toHaveBeenCalledWith(notification.id));

  await user.click(screen.getByRole("button", { name: "Clear all notifications" }));
  expect(onClearAll).not.toHaveBeenCalled();
  const laterNotification = {
    ...notification,
    id: "notification_2",
    title: "New event reminder",
  };
  rerender(
    <NotificationCenter
      notifications={[notification, laterNotification]}
      toasts={[notification, laterNotification]}
      onClear={onClear}
      onClearAll={onClearAll}
      onDismissToast={onDismissToast}
      onOpen={onOpen}
    />,
  );
  await user.click(
    screen.getByRole("button", {
      name: "Clear notification: New event reminder",
    }),
  );
  await waitFor(() =>
    expect(onClearAll).toHaveBeenCalledWith([notification.id]),
  );
  await waitFor(() =>
    expect(onClear).toHaveBeenCalledWith(laterNotification.id),
  );
});

it("closes the notification popover with Escape and restores trigger focus", async () => {
  const user = userEvent.setup();

  render(
    <NotificationCenter
      notifications={[notification]}
      toasts={[]}
      onClear={vi.fn()}
      onClearAll={vi.fn()}
      onDismissToast={vi.fn()}
      onOpen={vi.fn()}
    />,
  );

  const trigger = screen.getByRole("button", {
    name: "Notifications (1 unread)",
  });
  await user.click(trigger);
  expect(screen.getByRole("region", { name: "Notification list" })).toHaveAttribute(
    "data-state",
    "open",
  );

  await user.keyboard("{Escape}");
  expect(
    screen.queryByRole("region", { name: "Notification list" }),
  ).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("communicates an empty notification list", async () => {
  const user = userEvent.setup();

  render(
    <NotificationCenter
      notifications={[]}
      toasts={[]}
      onClear={vi.fn()}
      onClearAll={vi.fn()}
      onDismissToast={vi.fn()}
      onOpen={vi.fn()}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Notifications" }));
  expect(screen.getByText("You’re all caught up.")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Clear all notifications" }),
  ).toBeDisabled();
});
