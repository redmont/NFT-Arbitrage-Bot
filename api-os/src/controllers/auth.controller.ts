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
const ethers = require("ethers");
require("dotenv").config();

const AUTH_RESPONSE: ResponseObject = {
  description: "auth Response",
  content: {
    "application/json": {
      schema: {
        type: "object",
        title: "AccessToken",
        properties: {
          accessToken: { type: "string" },
        },
      },
    },
  },
};

const wallet = new ethers.Wallet(process.env.PK_0);

export class AuthController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) {}
  // Map to `GET /auth/getToken`
  @get("/auth/getToken")
  @response(200, AUTH_RESPONSE)
  async auth(
    @param.query.string("walletAddress") walletAddress: string,
    @param.query.string("chain") chain: string
  ): Promise<any> {
    chain = chain ? chain : "ETHEREUM";
    const response = await globalThis.page.evaluate(
      async (walletAddress: string) => {
        var data = JSON.stringify({
          id: "challengeLoginMessageQuery",
          query:
            "query challengeLoginMessageQuery(\n  $address: AddressScalar!\n) {\n  auth {\n    loginMessage(address: $address)\n  }\n}\n",
          variables: {
            address: walletAddress,
          },
        });

        var xhr = new XMLHttpRequest();
        xhr.withCredentials = true;

        xhr.open("POST", "https://opensea.io/__api/graphql/");
        xhr.setRequestHeader("authority", "opensea.io");
        xhr.setRequestHeader("content-type", "application/json");
        xhr.setRequestHeader("x-app-id", "opensea-web");
        xhr.setRequestHeader(
          "x-build-id",
          "3628e518a73d9a138760bf520fdcc1ec0e726539"
        );
        xhr.setRequestHeader(
          "x-signed-query",
          "05649d324b3f3db988d5065ea33599bca390adf00e3f46952dd59ff5cc61e1e0"
        );
        xhr.setRequestHeader("x-viewer-address", walletAddress);

        xhr.send(data);

        return new Promise((resolve) => {
          xhr.onload = () => {
            resolve(JSON.parse(xhr.responseText));
          };
        });
      },
      walletAddress
    );
    const loginMessage = response.data.auth.loginMessage;
    const signature = await wallet.signMessage(loginMessage);

    const loginResponse = await globalThis.page.evaluate(
      async (
        address: string,
        message: string,
        signature: string,
        chain: string
      ) => {
        var data = JSON.stringify({
          id: "authLoginMutation",
          query:
            "mutation authLoginMutation(\n  $address: AddressScalar!\n  $message: String!\n  $signature: String!\n  $chain: ChainScalar\n) {\n  auth {\n    login(address: $address, message: $message, signature: $signature, chain: $chain) {\n      token\n      account {\n        address\n        moonpayKycStatus\n        moonpayKycRejectType\n        isEmployee\n        id\n      }\n    }\n  }\n}\n",
          variables: {
            address: address,
            message: message,
            signature: signature,
            chain: chain,
          },
        });

        var xhr = new XMLHttpRequest();
        xhr.withCredentials = true;

        xhr.open("POST", "https://opensea.io/__api/graphql/");
        xhr.setRequestHeader("content-type", "application/json");
        xhr.setRequestHeader("x-app-id", "opensea-web");
        xhr.setRequestHeader(
          "x-build-id",
          "3628e518a73d9a138760bf520fdcc1ec0e726539"
        );
        xhr.setRequestHeader(
          "x-signed-query",
          "804a717e08ab2f12de3752b428dd9b6fd5d006f26e9f17ec4f4805db69b66e96"
        );
        xhr.setRequestHeader(
          "x-viewer-address",
          "0xcd342a494920e5435667d7540ae31750638763be"
        );

        xhr.send(data);
        return new Promise((resolve) => {
          xhr.onload = () => {
            resolve(xhr.responseText);
          };
        });
      },
      walletAddress,
      loginMessage,
      signature,
      chain
    );

    return loginResponse;
  }
}
