import { ApiBlurUnofficialApplication, ApplicationConfig } from "./application";
const puppeteer = require("puppeteer-core");
const proxyChain = require("proxy-chain");
const { executablePath } = require("puppeteer");

export * from "./application";

// Initialize puppeteer browser and page
declare global {
  var page: any;
}

export async function main(options: ApplicationConfig = {}) {
  const app = new ApiBlurUnofficialApplication(options);
  await app.boot();
  await app.start();

  (async () => {
    const proxies = [
      "http://tJCulVRS:NFA7dwKimBCANhgm5mEaiBBpeFHNGXEy72mfAxUOM1y0CiOJf8PqI65rrwyxrpKQ3s3Pb-5Rrjx5Mg@ustr16.p.ap2.me:49067",
      "http://tJCulVRS:NFA7dwKimBCANhgm5mEaiBBpeFHNGXEy72mfAxUOM1y0CiOJf8PqI65rrwyxrpKQ3s3Pb-R7dznZEt@ustr16.p.ap2.me:49022",
      // "http://xnmldktr:p980i7e5knud@185.199.229.156:7492".
    ];

    const launchOptions = {
      headless: true,
      devtools: true,
      args: [
        "--disable-web-security",
        "--disable-features=IsolateOrigins",
        "--disable-site-isolation-trials",
      ],
      executablePath: executablePath(),
    };

    if (!process.env.TEST_MODE) {
      console.log("No TEST_MODE, Setting proxy...");
      const proxyURL = await proxyChain.anonymizeProxy(proxies[0]);
      launchOptions.args.push(`--proxy-server=${proxyURL}`);
    } else {
      console.log("Detected TEST_MODE, no Proxy ");
    }

    const browser = await puppeteer.launch(launchOptions);

    globalThis.page = await browser.newPage();
    await globalThis.page.goto("https://core-api.prod.blur.io/v1/");
    await globalThis.page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
    });

    console.log("Browser and page initialized");
    const url = app.restServer.url;
    console.log(`Server is running at ${url}`);
    console.log(`Try ${url}/ping`);
  })();
  return app;
}

if (require.main === module) {
  // Run the application
  const config = {
    rest: {
      port: +(process.env.PORT ?? 3000),
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
