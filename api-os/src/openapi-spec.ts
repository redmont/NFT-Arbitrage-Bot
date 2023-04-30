import { ApplicationConfig } from "@loopback/core";
import { ApiOSUnofficialApplication } from "./application";

/**
 * Export the OpenAPI spec from the application
 */
async function exportOpenApiSpec(): Promise<void> {
  const config: ApplicationConfig = {
    rest: {
      port: +(process.env.PORT ?? 3001),
      host: process.env.HOST ?? "localhost",
    },
  };
  const outFile = process.argv[2] ?? "";
  const app = new ApiOSUnofficialApplication(config);
  await app.boot();
  await app.exportOpenApiSpec(outFile);
}

exportOpenApiSpec().catch((err) => {
  console.error("Fail to export OpenAPI spec from the application.", err);
  process.exit(1);
});
