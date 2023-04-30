import { ApiOSUnofficialApplication, ApplicationConfig } from "./application";
const puppeteer = require("puppeteer-core");
const proxyChain = require("proxy-chain");
const { executablePath } = require("puppeteer");

export * from "./application";

// Initialize puppeteer browser and page
declare global {
  var page: any;
}

export async function main(options: ApplicationConfig = {}) {
  const app = new ApiOSUnofficialApplication(options);
  await app.boot();
  await app.start();

  (async () => {
    // const oldProxyUrl = 'http://user-sps2v0tyzc-country-us-city-ashburn:sps2v0tyzc:8d9fa897GG8430s2qPs2@gate.smartproxy.com:7000';
    const oldProxyUrl = "http://xnmldktr:p980i7e5knud@185.199.229.156:7492";
    const newProxyUrl = await proxyChain.anonymizeProxy(oldProxyUrl);

    console.log(newProxyUrl);

    const browser = await puppeteer.launch({
      headless: true,
      devtools: true,
      args: [
        `--proxy-server=${newProxyUrl}`,
        "--disable-web-security",
        "--disable-features=IsolateOrigins",
        "--disable-site-isolation-trials",
      ],
      executablePath: executablePath(),
    });

    globalThis.page = await browser.newPage();
    await globalThis.page.goto(
      "https://opensea.io/assets/ethereum/0x05327e6e27f251d2f2cfdbc37b9f289cf9f21529/6729"
    );
    await globalThis.page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
    });

    console.log("Browser and page initialized");
    const url = app.restServer.url;
    console.log(`Server is running at ${url}`);
  })();
  return app;
}

if (require.main === module) {
  // Run the application
  const config = {
    rest: {
      port: +(process.env.PORT ?? 3001),
      host: process.env.HOST,
      // The `gracePeriodForClose` provides a graceful close for http/https
      // servers with keep-alive clients. The default value is `Infinity`
      // (don't force-close). If you want to immediately destroy all sockets
      // upon stop, set its value to `0`.
      // See https://www.npmjs.com/package/stoppable
      gracePeriodForClose: 5000, // 5 seconds
      openApiSpec: {
        // useful when used with OpenAPI-to-GraphQL to locate your application
        setServersFromRequest: true,
      },
    },
  };
  main(config).catch((err) => {
    console.error("Cannot start the application.", err);
    process.exit(1);
  });
}
