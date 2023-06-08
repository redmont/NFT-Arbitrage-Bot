// Uncomment these imports to begin using these cool features!

// import {inject} from '@loopback/core';
import { inject } from "@loopback/core";
import {
  Request,
  RestBindings,
  get,
  response,
  ResponseObject,
  param,
  requestBody,
} from "@loopback/rest";

const { XMLHttpRequest } = require("xmlhttprequest");

const RESPONSE: ResponseObject = {
  description: "Response",
  content: {
    "application/json": {
      schema: {
        type: "object",
        title: "Info",
        properties: {},
      },
    },
  },
};
export class CollectionsController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) {}
  // Map to `GET /v1/collections/{collection}/executable-bids`
  @get("/v1/collections/{collection}/executable-bids")
  @response(200, RESPONSE)
  async collectionBids(
    @param.path.string("collection") collection: string
  ): Promise<any> {
    const { authtoken, walletaddress } = this.req.headers;

    const cookies = [
      {
        name: "authToken",
        value: authtoken,
      },
      {
        name: "walletAddress",
        value: walletaddress,
      },
    ];

    await page.setCookie(...cookies);

    const apiURL =
      "https://core-api.prod.blur.io/v1/collections/" +
      collection +
      "/executable-bids?filters=%7B%7D";

    const response = await globalThis.page.evaluate(async (apiURL: string) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", apiURL);
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      xhr.send(JSON.stringify({ filters: {} }));

      return new Promise((resolve) => {
        xhr.onload = () => {
          resolve(JSON.parse(xhr.responseText));
        };
      });
    }, apiURL);
    return response;
  }

  // Map to `GET /v1/collections/{collection}/prices`
  @get("/v1/collections/{collection}/prices")
  @response(200, RESPONSE)
  async collectionPrices(
    @param.path.string("collection") collection: string
  ): Promise<any> {
    const { authtoken, walletaddress } = this.req.headers;
    const { filters } = this.req.query;
    const cookies = [
      {
        name: "authToken",
        value: authtoken,
      },
      {
        name: "walletAddress",
        value: walletaddress,
      },
    ];

    await page.setCookie(...cookies);

    const _filtersString = decodeURIComponent(JSON.stringify(filters));
    const filtersString = decodeURIComponent(JSON.parse(_filtersString));
    const apiURL =
      "https://core-api.prod.blur.io/v1/collections/" +
      collection +
      "/prices?filters=" +
      encodeURIComponent(filtersString);
    // console.log(`\nGET ID SLUG for: https://blur.io/asset/${collection} ...`);

    const timeStart = Date.now();

    const response = await globalThis.page.evaluate(async (apiURL: string) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", apiURL);
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      xhr.send(JSON.stringify({ filters: {} }));

      return new Promise((resolve) => {
        xhr.onload = () => {
          resolve(JSON.parse(xhr.responseText));
        };
      });
    }, apiURL);

    const timeEnd = Date.now();
    const timeDiff = timeEnd - timeStart;

    //timeDiff > 10s
    if (timeDiff > 5000) {
      // console.log("timeDiff>5000ms, timeDiff", timeDiff);
    } else {
      // console.log("ok, timeDiff", timeDiff);
    }

    return response;
  }

  // Map to `GET /v1/collections/{collection}/tokens`
  @get("/v1/collections/{collection}/tokens")
  @response(200, RESPONSE)
  async collectionTokens(
    @param.path.string("collection") collection: string
  ): Promise<any> {
    const { authtoken, walletaddress } = this.req.headers;
    const { filters } = this.req.query;
    const cookies = [
      {
        name: "authToken",
        value: authtoken,
      },
      {
        name: "walletAddress",
        value: walletaddress,
      },
    ];

    await page.setCookie(...cookies);

    const _filtersString = decodeURIComponent(JSON.stringify(filters));
    const filtersString = decodeURIComponent(JSON.parse(_filtersString));
    const apiURL =
      "https://core-api.prod.blur.io/v1/collections/" +
      collection +
      "/tokens?filters=" +
      encodeURIComponent(filtersString);
    // console.log(`\nGET ID SLUG for: https://blur.io/asset/${collection} ...`);

    const timeStart = Date.now();

    const response = await globalThis.page.evaluate(async (apiURL: string) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", apiURL);
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      xhr.send(JSON.stringify({ filters: {} }));

      return new Promise((resolve) => {
        xhr.onload = () => {
          resolve(JSON.parse(xhr.responseText));
        };
      });
    }, apiURL);

    const timeEnd = Date.now();
    const timeDiff = timeEnd - timeStart;

    //timeDiff > 10s
    if (timeDiff > 5000) {
      // console.log("timeDiff>5000ms, timeDiff", timeDiff);
    } else {
      // console.log("ok, timeDiff", timeDiff);
    }

    return response;
  }

  // Map to `GET /v1/collections/{collection}/tokens/{id}`
  @get("/v1/collections/{collection}/tokens/{id}")
  @response(200, RESPONSE)
  async collectionPrice(
    @param.path.string("collection") collection: string,
    @param.path.string("id") id: string
  ): Promise<any> {
    // console.log(`GET ID for: https://blur.io/asset/${collection}/${id}`);
    const { authtoken, walletaddress } = this.req.headers;
    const cookies = [
      {
        name: "authToken",
        value: authtoken,
      },
      {
        name: "walletAddress",
        value: walletaddress,
      },
    ];

    // https://core-api.prod.blur.io/v1/collections/0x60e4d786628fea6478f785a6d7e704777c86a7c6/tokens/24212

    await page.setCookie(...cookies);
    const apiURL =
      "https://core-api.prod.blur.io/v1/collections/" +
      collection +
      "/tokens/" +
      id;
    // console.log(`GET price for: ${apiURL}`);

    const timeStart = Date.now();
    const response = await globalThis.page.evaluate(async (apiURL: string) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", apiURL);
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      xhr.send(JSON.stringify({ filters: {} }));

      return new Promise((resolve) => {
        xhr.onload = () => {
          resolve(JSON.parse(xhr.responseText));
        };
      });
    }, apiURL);

    const timeEnd = Date.now();
    const timeDiff = timeEnd - timeStart;
    // console.log("timeDiff", timeDiff);
    return response;
  }

  // Map to `GET /v1/collections/{collection}/tokens/{id}`
  @get("/v1/asset/{collection}/{id}")
  @response(200, RESPONSE)
  async asset(
    @param.path.string("collection") collection: string,
    @param.path.string("id") id: string
  ): Promise<any> {
    // console.log(`GET ID for: https://blur.io/asset/${collection}/${id}`);
    const { authtoken, walletaddress } = this.req.headers;
    const cookies = [
      {
        name: "authToken",
        value: authtoken,
      },
      {
        name: "walletAddress",
        value: walletaddress,
      },
    ];

    await page.setCookie(...cookies);
    const apiURL =
      "https://core-api.prod.blur.io/v1/asset/" + collection + "/" + id;
    // console.log(`GET asset data for: ${apiURL}`);

    const response = await globalThis.page.evaluate(async (apiURL: string) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", apiURL);
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      xhr.send(JSON.stringify({ filters: {} }));

      return new Promise((resolve) => {
        xhr.onload = () => {
          resolve(JSON.parse(xhr.responseText));
        };
      });
    }, apiURL);

    return response;
  }

  // Map to `GET /v1/collections`
  @get("/v1/collections")
  @response(200, RESPONSE)
  async collections(): Promise<any> {
    const { authtoken, walletaddress } = this.req.headers;
    const { filters } = this.req.query;

    const cookies = [
      {
        name: "authToken",
        value: authtoken,
      },
      {
        name: "walletAddress",
        value: walletaddress,
      },
    ];

    await page.setCookie(...cookies);

    const _filtersString = decodeURIComponent(JSON.stringify(filters));
    const filtersString = decodeURIComponent(JSON.parse(_filtersString));
    const apiURL = `https://core-api.prod.blur.io/v1/collections/?filters=${encodeURIComponent(
      filtersString
    )}`;

    // console.log();

    const response = await globalThis.page.evaluate(async (apiURL: string) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", apiURL);
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      xhr.send(JSON.stringify({ filters: {} }));

      return new Promise((resolve) => {
        xhr.onload = () => {
          resolve(JSON.parse(xhr.responseText));
        };
      });
    }, apiURL);

    return response;
  }

  // Map to `GET /v1/collections/{collection}/{addr}`
  @get("/v1/collections/{addr}")
  @response(200, RESPONSE)
  async collection(@param.path.string("addr") addr: string): Promise<any> {
    // console.log(`GET ID for: https://blur.io/collections/${addr}`);
    const { authtoken, walletaddress } = this.req.headers;
    const cookies = [
      {
        name: "authToken",
        value: authtoken,
      },
      {
        name: "walletAddress",
        value: walletaddress,
      },
    ];

    await page.setCookie(...cookies);
    const apiURL = "https://core-api.prod.blur.io/v1/collections/" + addr;
    // console.log(`GET collection: ${apiURL}`);

    const response = await globalThis.page.evaluate(async (apiURL: string) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", apiURL);
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      xhr.send(JSON.stringify({ filters: {} }));

      return new Promise((resolve) => {
        xhr.onload = () => {
          resolve(JSON.parse(xhr.responseText));
        };
      });
    }, apiURL);

    return response;
  }
}
