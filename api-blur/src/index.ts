import {ApiBlurUnofficialApplication, ApplicationConfig} from './application';
const puppeteer = require("puppeteer-core");
const proxyChain = require("proxy-chain");
const {executablePath} = require("puppeteer");

export * from './application';

// Initialize puppeteer browser and page
declare global {
  var page: any;
}

export async function main(options: ApplicationConfig = {}) {
  const app = new ApiBlurUnofficialApplication(options);
  await app.boot();
  await app.start();

  ;(async ()=>{
    const url1 = "http://xnmldktr:p980i7e5knud@185.199.229.156:7492";
    // const proxyUrl = "http://user-sps2v0tyzc-country-us-city-ashburn-sessionduration-30:qW3aVSn6buop47Ndfj@gate.smartproxy.com:10000" //sticky 30m (stop after 30m)
    // const proxyUrl = "http://tJCulVRS:NFA7dwKimBCANhgm5mEaiBBpeFHNGXEy72mfAxUOM1y0CiOJf8PqI65rrwyxrpKQ3s3Pb@ustr16.p.ap2.me:49000" //rotating
    // const proxyUrl = "http://tJCulVRS:NFA7dwKimBCANhgm5mEaiBBpeFHNGXEy72mfAxUOM1y0CiOJf8PqI65rrwyxrpKQ3s3Pb-uw3SY85h@ustr16.p.ap2.me:49006" //sticky
    // const proxyUrl = "http://user-sps2v0tyzc-country-us-city-ashburn:qW3aVSn6buop47Ndfj@gate.smartproxy.com:7000" //rotating (stop after 10m)

    const proxies = [
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.205:24972',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.206:46983',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.207:52014',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.208:16031',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.209:14893',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.210:5482',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.211:56966',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.212:36301',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.213:14739',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.214:58027',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.215:30662',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.216:40265',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.217:7160',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.218:10687',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.219:49121',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.220:52213',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.221:51264',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.222:54986',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.223:44013',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.224:52829',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.225:40341',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.226:54218',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.227:6286',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.228:9566',
      'http://cus_NrUtR6CVdKk5Ux:ie94797f@64.50.179.229:30710'
    ]
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.205:24972',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.206:46983',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.207:52014',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.208:16031',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.209:14893',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.210:5482',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.211:56966',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.212:36301',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.213:14739',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.214:58027',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.215:30662',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.216:40265',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.217:7160',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.218:10687',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.219:49121',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.220:52213',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.221:51264',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.222:54986',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.223:44013',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.224:52829',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.225:40341',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.226:54218',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.227:6286',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.228:9566',
      // 'http://cus_NrUtR6CVdKk5Ux:6479b2h7@64.50.179.229:30710'


    const proxyURL = await proxyChain.anonymizeProxy(proxies[0])
    // const proxyURL = await proxyChain.anonymizeProxy(url1)

    const browser = await puppeteer.launch({
      headless: true,
      devtools: true,
        args: [
            `--proxy-server=${proxyURL}`, //can comment locally
            "--disable-web-security",
            "--disable-features=IsolateOrigins",
            "--disable-site-isolation-trials",
        ],
        executablePath: executablePath(),
    });

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
  })()
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
  main(config).catch(err => {
    console.error('Cannot start the application.', err);
    process.exit(1);
  });
}
