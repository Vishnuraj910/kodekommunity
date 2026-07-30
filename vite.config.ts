import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const documentCsp =
  "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; form-action 'self'; manifest-src 'self'; worker-src 'self'";
const responseCsp = `${documentCsp}; frame-ancestors 'none'`;
const developmentCsp = documentCsp
  .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
  .replace("connect-src 'self'", "connect-src 'self' ws: wss:");

const commonSecurityHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export default defineConfig({
  plugins: [
    {
      name: "kommunity-development-csp",
      apply: "serve",
      enforce: "pre",
      transformIndexHtml: (html) =>
        html.replace(
          /<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]+"\s*\/>/,
          "",
        ),
    },
    react(),
  ],
  server: {
    host: "127.0.0.1",
    port: 4173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: false,
      },
    },
    headers: {
      ...commonSecurityHeaders,
      "Content-Security-Policy": developmentCsp,
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    headers: {
      ...commonSecurityHeaders,
      "Content-Security-Policy": responseCsp,
    },
  },
});
