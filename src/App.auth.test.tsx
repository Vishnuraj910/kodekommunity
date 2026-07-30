import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("shows the preferred authentication screen when no session exists", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Authentication required",
            requestId: "test-request",
          },
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    ),
  );

  render(<App />);

  expect(
    await screen.findByRole("button", { name: /continue with oidc/i }),
  ).toBeVisible();
  expect(
    screen.queryByRole("navigation", { name: /primary navigation/i }),
  ).not.toBeInTheDocument();
});
