import {inject} from '@loopback/core';
import {
  Request,
  RestBindings,
  get,
  response,
  ResponseObject,
  param,
  requestBody,
  post,
} from '@loopback/rest';

const {XMLHttpRequest} =require('xmlhttprequest');

const RESPONSE: ResponseObject = {
  description: 'Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'Info',
        properties: {},
      },
    },
  },
};
export class CollectionBidsController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) {
  }

  // Map to `POST /v1/collection-bids/accept`
  @post('/v1/collection-bids/accept')
  @response(200, RESPONSE)
    async collectionBidsAccept(@requestBody() data: Object): Promise<any> {
      const {authtoken,walletaddress} = this.req.headers

      const cookies = [{
        'name': 'authToken',
        'value': authtoken
      },{
        'name': 'walletAddress',
        'value': walletaddress
      }];

      await page.setCookie(...cookies);

      const apiURL = "https://core-api.prod.blur.io/v1/collection-bids/accept"

      const response = await globalThis.page.evaluate(async (apiURL:string,data:Object) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", apiURL);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhr.send(JSON.stringify(data));

        return new Promise((resolve) => {
            xhr.onload = () => {
                resolve(JSON.parse(xhr.responseText));
            };
        });
      },apiURL,data);
      return response
    }
}

