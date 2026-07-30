import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthScreen } from "./AuthScreen";

describe("AuthScreen", () => {
  it("keeps OIDC primary and local login secondary", async () => {
    const user = userEvent.setup();
    render(
      <AuthScreen
        onLocalLogin={vi.fn()}
        onLocalRegister={vi.fn()}
        onOidc={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /continue with oidc/i }),
    ).toBeVisible();
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /use email and password/i }),
    );

    expect(screen.getByLabelText(/email or username/i)).toBeVisible();
    expect(screen.getByLabelText(/^password$/i)).toBeVisible();
  });

  it("submits local login credentials through its public callback", async () => {
    const user = userEvent.setup();
    const onLocalLogin = vi.fn().mockResolvedValue(undefined);
    render(
      <AuthScreen
        onLocalLogin={onLocalLogin}
        onLocalRegister={vi.fn()}
        onOidc={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /use email and password/i }),
    );
    await user.type(
      screen.getByLabelText(/email or username/i),
      "USER@Example.COM",
    );
    await user.type(
      screen.getByLabelText(/^password$/i),
      "A secure passphrase! 2026",
    );
    await user.click(screen.getByRole("button", { name: /^log in$/i }));

    expect(onLocalLogin).toHaveBeenCalledWith({
      identifier: "user@example.com",
      password: "A secure passphrase! 2026",
    });
  });

  it("lets the user reveal and hide the password without changing it", async () => {
    const user = userEvent.setup();
    render(
      <AuthScreen
        onLocalLogin={vi.fn()}
        onLocalRegister={vi.fn()}
        onOidc={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /use email and password/i }),
    );
    const password = screen.getByLabelText(/^password$/i);
    await user.type(password, "A secure passphrase! 2026");

    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("A secure passphrase! 2026");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("registers without asking for a username and reports provider errors", async () => {
    const user = userEvent.setup();
    const onLocalRegister = vi
      .fn()
      .mockRejectedValueOnce(new Error("Email already registered"));
    const onOidc = vi.fn();
    render(
      <AuthScreen
        onLocalLogin={vi.fn()}
        onLocalRegister={onLocalRegister}
        onOidc={onOidc}
      />,
    );

    await user.click(screen.getByRole("button", { name: /continue with oidc/i }));
    expect(onOidc).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: /use email and password/i }));
    await user.click(screen.getByRole("tab", { name: /register/i }));
    await user.type(screen.getByLabelText(/display name/i), "  Lee Morgan  ");
    expect(screen.queryByLabelText(/handle|username/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/email address/i), "LEE@EXAMPLE.TEST");
    await user.type(screen.getByLabelText(/^password$/i), "A secure passphrase");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email already registered",
    );
    expect(onLocalRegister).toHaveBeenCalledWith({
      displayName: "Lee Morgan",
      email: "lee@example.test",
      password: "A secure passphrase",
    });
    await user.click(screen.getByRole("button", { name: /back to preferred sign-in/i }));
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
  });

  it("keeps the user signed out while explaining email verification", async () => {
    const user = userEvent.setup();
    const onLocalRegister = vi.fn().mockResolvedValue({
      status: "verification_required",
      username: "lee_morgan_a1b2c3d4",
    });
    render(
      <AuthScreen
        onLocalLogin={vi.fn()}
        onLocalRegister={onLocalRegister}
        onOidc={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /use email and password/i }),
    );
    await user.click(screen.getByRole("tab", { name: /register/i }));
    await user.type(screen.getByLabelText(/display name/i), "Lee Morgan");
    await user.type(screen.getByLabelText(/email address/i), "lee@example.test");
    await user.type(screen.getByLabelText(/^password$/i), "A secure passphrase");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Check your email",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "@lee_morgan_a1b2c3d4",
    );
    expect(screen.getByRole("tab", { name: /log in/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText(/^password$/i)).toHaveValue("");
  });
});
