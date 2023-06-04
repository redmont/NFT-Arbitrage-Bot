import { inject } from "@loopback/core";
import {
  param,
  post,
  Request,
  requestBody,
  response,
  ResponseObject,
  RestBindings,
} from "@loopback/rest";
import { Interface } from "ethers";
const { XMLHttpRequest } = require("xmlhttprequest");
const { ethers } = require("ethers");

const abi = require("../customs/abi/blurExchange").default;
const iface = new Interface(abi);

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
export class OrdersController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) {}

  // Map to `POST /v1/orders/format`
  @post("/v1/orders/format")
  @response(200, RESPONSE)
  async createListingFormat(@requestBody() data: Object): Promise<any> {
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

    const apiURL = "https://core-api.prod.blur.io/v1/orders/format";

    const response = await globalThis.page.evaluate(
      async (apiURL: string, data: Object) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", apiURL);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhr.send(JSON.stringify(data));

        return new Promise((resolve) => {
          xhr.onload = () => {
            resolve(JSON.parse(xhr.responseText));
          };
        });
      },
      apiURL,
      data
    );
    return response;
  }

  // Map to `POST /v1/orders/submit`
  @post("/v1/orders/submit")
  @response(200, RESPONSE)
  async submitListing(@requestBody() data: Object): Promise<any> {
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

    const apiURL = "https://core-api.prod.blur.io/v1/orders/submit";

    const response = await globalThis.page.evaluate(
      async (apiURL: string, data: Object) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", apiURL);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhr.send(JSON.stringify(data));

        return new Promise((resolve) => {
          xhr.onload = () => {
            resolve(JSON.parse(xhr.responseText));
          };
        });
      },
      apiURL,
      data
    );
    return response;
  }

  // Map to `POST /v1/buy/{collection}?fulldata=true`
  @post("/v1/buy/{collection}")
  @response(200, RESPONSE)
  async createBuyFormat(
    @requestBody() data: Object,
    @param.path.string("collection") collection: string,
    @param.query.boolean("fulldata") fulldata?: boolean
  ): Promise<any> {
    console.log(`POST buy data for: https://blur.io/collections/${collection}`);
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

    const apiURL = "https://core-api.prod.blur.io/v1/buy/" + collection;

    const response = await globalThis.page.evaluate(
      async (apiURL: string, data: Object) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", apiURL);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhr.send(JSON.stringify(data));

        return new Promise((resolve) => {
          xhr.onload = () => {
            resolve(JSON.parse(xhr.responseText));
          };
        });
      },
      apiURL,
      data
    );

    if (fulldata) {
      return JSON.parse(this.decodedData(response.data));
      const responseData: any = [];
      const a = this.decodedData(response.data);
      let decodedDataJson = JSON.parse(a);
      // return decodedDataJson;

      // not all function are "execute"
      responseData.push(decodedDataJson);
      // console.log('decodedDataJson', decodedDataJson.buys[0])
      // decodedDataJson.buys.forEach((buy:any) => {
      //   console.log('\nb4 decode', buy.txnData.data)
      //   let decodedResponse = iface.decodeFunctionData("execute", buy.txnData.data);
      //   console.log('after decode')
      //   let data:any = {};
      //   this.mapKeyValues(decodedResponse, data);
      //   data.decodedResponse = decodedDataJson.buys
      //   responseData.push(data)
      // });

      console.log("\n///////responseData////////", responseData);
      return responseData;
    }

    return response;
  }

  mapKeyValues = (
    obj: { [key: string]: any },
    baseObj: { [key: string]: any }
  ) => {
    Object.keys(obj).forEach((key) => {
      if (!Number(key) && key != "0") {
        let value = obj[key];
        if (ethers.BigNumber.isBigNumber(value)) {
          value = ethers.BigNumber.from(value).toString();
        }
        baseObj[key] = value;
        if (typeof value === "object") {
          baseObj[key] = {};
          this.mapKeyValues(value, baseObj[key]);
        }
      }
    });
  };
  decodedData = function (x: any) {
    let plaintext = (function (key, x) {
      let y = "";
      for (let i = 0; i < x.length; i++) {
        let byte = x.charCodeAt(i) ^ key.charCodeAt(i % key.length),
          char = String.fromCharCode(byte);
        y += char;
      }
      return y;
    })(
      "XTtnJ44LDXvZ1MSjdyK4pPT8kg5meJtHF44RdRBGrsaxS6MtG19ekKBxiXgp",
      Buffer.from(x, "base64").toString("utf-8")
    );
    return plaintext;
  };
}
