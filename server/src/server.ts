try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch (error) {
  if (
    !(error instanceof Error) ||
    !("code" in error) ||
    error.code !== "ENOENT"
  ) {
    throw error;
  }
}

const [{ buildApp }, { loadConfig }] = await Promise.all([
  import("./app.js"),
  import("./config/env.js"),
]);
const config = loadConfig();
const app = await buildApp(config);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "Shutting down");
  await app.close();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: config.HOST, port: config.PORT });
