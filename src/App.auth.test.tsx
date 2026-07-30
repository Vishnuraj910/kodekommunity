import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  window.history.replaceState(null, "", "/");
});

it("matches the device dark theme when no preference has been saved", async () => {
  localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
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
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("kommunity-theme")).toBeNull();
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
  expect(window.location.pathname).toBe("/login");
  expect(
    screen.queryByRole("navigation", { name: /primary navigation/i }),
  ).not.toBeInTheDocument();
});
