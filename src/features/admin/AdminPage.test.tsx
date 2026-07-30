import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { AdminOverview } from "../../../server/src/schemas/api";
import { AdminPage } from "./AdminPage";

const createdAt = "2026-07-30T12:00:00.000Z";
const overview: AdminOverview = {
  users: [
    {
      id: "maya",
      email: "maya@kommunity.local",
      handle: "maya",
      displayName: "Maya Chen",
      initials: "MC",
      status: "active",
      assignments: [
        { role: "user", scope: "platform" },
        { role: "root", scope: "platform" },
      ],
    },
  ],
  communities: [
    {
      id: "c1",
      slug: "kodekommunity",
      name: "KodeKommunity",
      description: "Builders helping builders.",
      visibility: "public",
      memberCount: 12,
      joined: true,
    },
  ],
  events: [
    {
      id: "e1",
      communityId: "c1",
      title: "Architecture clinic",
      description: "Review one system together.",
      startsAt: "2027-01-10T10:00:00.000Z",
      endsAt: "2027-01-10T11:00:00.000Z",
      location: "Online",
      attendeeCount: 4,
      going: false,
    },
  ],
  posts: [
    {
      id: "p1",
      communityId: "c1",
      groupId: null,
      body: "A useful update",
      author: {
        id: "maya",
        displayName: "Maya Chen",
        initials: "MC",
        color: "ink",
      },
      own: true,
      createdAt,
      updatedAt: createdAt,
    },
  ],
  groups: [
    {
      id: "g1",
      communityId: "c1",
      name: "Platform reliability",
      slug: "platform-reliability",
      description: "Build dependable systems.",
      visibility: "private",
      memberCount: 4,
      joined: true,
      createdAt,
    },
  ],
};

it("offers root CRUD workflows for users, events, posts, and groups", async () => {
  const user = userEvent.setup();
  const actions = {
    createUser: vi.fn().mockResolvedValue(undefined),
    updateUser: vi.fn().mockResolvedValue(undefined),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    createEvent: vi.fn().mockResolvedValue(undefined),
    updateEvent: vi.fn().mockResolvedValue(undefined),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
    createPost: vi.fn().mockResolvedValue(undefined),
    updatePost: vi.fn().mockResolvedValue(undefined),
    deletePost: vi.fn().mockResolvedValue(undefined),
    createGroup: vi.fn().mockResolvedValue(undefined),
    updateGroup: vi.fn().mockResolvedValue(undefined),
    deleteGroup: vi.fn().mockResolvedValue(undefined),
  };
  render(<AdminPage overview={overview} {...actions} />);

  expect(screen.getByRole("heading", { name: /platform administration/i })).toBeVisible();
  const statusPicker = screen.getByRole("combobox", {
    name: /status/i,
  });
  expect(statusPicker).not.toBeInstanceOf(HTMLSelectElement);
  await user.click(statusPicker);
  expect(screen.getByRole("listbox")).toHaveAttribute(
    "data-slot",
    "select-content",
  );
  await user.click(screen.getByRole("option", { name: "Active" }));
  await user.type(screen.getByLabelText(/new user display name/i), "Lee Morgan");
  await user.type(screen.getByLabelText(/new user username/i), "lee-morgan");
  await user.type(screen.getByLabelText(/new user email/i), "lee@example.test");
  await user.click(screen.getByRole("button", { name: /create invited user/i }));
  expect(actions.createUser).toHaveBeenCalledWith({
    displayName: "Lee Morgan",
    handle: "lee-morgan",
    email: "lee@example.test",
  });
  await user.click(screen.getByRole("button", { name: /save maya chen/i }));
  expect(actions.updateUser).toHaveBeenCalledWith("maya", {
    displayName: "Maya Chen",
    email: "maya@kommunity.local",
    handle: "maya",
    status: "active",
  });
  await user.click(screen.getByRole("button", { name: /revoke maya chen/i }));
  expect(actions.deleteUser).toHaveBeenCalledWith("maya");

  await user.click(screen.getByRole("tab", { name: /events/i }));
  expect(screen.getByDisplayValue("Architecture clinic")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /save architecture clinic/i }));
  expect(actions.updateEvent).toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: /delete architecture clinic/i }));
  expect(actions.deleteEvent).toHaveBeenCalledWith("e1");

  await user.click(screen.getByRole("tab", { name: /posts/i }));
  await user.click(screen.getByRole("button", { name: /save post by maya chen/i }));
  expect(actions.updatePost).toHaveBeenCalledWith("p1", {
    body: "A useful update",
  });
  await user.click(screen.getByRole("button", { name: /delete post by maya chen/i }));
  expect(actions.deletePost).toHaveBeenCalledWith("p1");

  await user.click(screen.getByRole("tab", { name: /groups/i }));
  await user.click(screen.getByRole("button", { name: /save platform reliability/i }));
  expect(actions.updateGroup).toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: /delete platform reliability/i }));
  expect(actions.deleteGroup).toHaveBeenCalledWith("g1");
});
