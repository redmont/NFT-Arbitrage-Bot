// Uncomment these imports to begin using these cool features!

// import {inject} from '@loopback/core';
import {inject} from '@loopback/core';
import {
  Request,
  RestBindings,
  get,
  response,
  ResponseObject,
  param,
  requestBody,
} from '@loopback/rest';

const {XMLHttpRequest} =require('xmlhttprequest');
require('dotenv').config();

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
export class CollectionsController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) {
  }
  // Map to `GET /v1/collections/{collection}/executable-bids`
  @get('/v1/collections/{collection}/executable-bids')
  @response(200, RESPONSE)
  async collectionBids(@param.path.string('collection') collection: string): Promise<any> {

    const {authtoken,walletaddress} = this.req.headers

    const cookies = [{
      'name': 'authToken',
      'value': authtoken
    },{
      'name': 'walletAddress',
      'value': walletaddress
    }];

    await page.setCookie(...cookies);

    const apiURL = "https://core-api.prod.blur.io/v1/collections/"+collection+"/executable-bids?filters=%7B%7D"

    const response = await globalThis.page.evaluate(async (apiURL:string) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", apiURL);
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      xhr.send(JSON.stringify({filters: {}}));

      return new Promise((resolve) => {
          xhr.onload = () => {
              resolve(JSON.parse(xhr.responseText));
          };
      });
    },apiURL);
    return response
  }

  // Map to `GET /v1/collections/{collection}/prices`
  @get('/v1/collections/{collection}/prices')
  @response(200, RESPONSE)
  async collectionPrices(@param.path.string('collection') collection: string): Promise<any> {
    const {authtoken,walletaddress} = this.req.headers
    const {filters} = this.req.query
    const cookies = [{
      'name': 'authToken',
      'value': authtoken
    },{
      'name': 'walletAddress',
      'value': walletaddress
    }];

    await page.setCookie(...cookies);

    const _filtersString = decodeURIComponent(JSON.stringify(filters));
    const filtersString = decodeURIComponent(JSON.parse(_filtersString));
    const apiURL = "https://core-api.prod.blur.io/v1/collections/"+collection+"/prices?filters="+encodeURIComponent(filtersString);

    const response = await globalThis.page.evaluate(async (apiURL:string) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", apiURL);
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      xhr.send(JSON.stringify({filters: {}}));

      return new Promise((resolve) => {
        xhr.onload = () => {
          resolve(JSON.parse(xhr.responseText));
        };
      });
    }, apiURL);

    return response
  }

  // Map to `GET /v1/collections/{collection}/tokens/{id}`
  @get('/v1/collections/{collection}/tokens/{id}')
  @response(200, RESPONSE)
  async collectionPrice(@param.path.string('collection') collection: string, @param.path.string('id') id: string): Promise<any> {
    console.log(`GET price for: https://blur.io/asset/${collection}/${id}`)
    const {authtoken,walletaddress} = this.req.headers
    const cookies = [{
      'name': 'authToken',
      'value': authtoken
    },{
      'name': 'walletAddress',
      'value': walletaddress
    }];

    await page.setCookie(...cookies);
    const apiURL = "https://core-api.prod.blur.io/v1/collections/"+collection+"/tokens/"+id;
    // console.log(`GET price for: ${apiURL}`)

    const response = await globalThis.page.evaluate(async (apiURL:string) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", apiURL);
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      xhr.send(JSON.stringify({filters: {}}));

      return new Promise((resolve) => {
        xhr.onload = () => {
          resolve(JSON.parse(xhr.responseText));
        };
      });
    }, apiURL);

    return response
  }

  // Map to `GET /v1/collections`
  @get('/v1/collections')
  @response(200, RESPONSE)
  async collections(): Promise<any> {
    const {authtoken,walletaddress} = this.req.headers
    const {filters} = this.req.query

    const cookies = [{
      'name': 'authToken',
      'value': authtoken
    },{
      'name': 'walletAddress',
      'value': walletaddress
    }];

    await page.setCookie(...cookies);

    const _filtersString = decodeURIComponent(JSON.stringify(filters));
    const filtersString = decodeURIComponent(JSON.parse(_filtersString));
    const apiURL = `https://core-api.prod.blur.io/v1/collections/?filters=${encodeURIComponent(filtersString)}`;

    const response = await globalThis.page.evaluate(async (apiURL:string) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", apiURL);
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      xhr.send(JSON.stringify({filters: {}}));

      return new Promise((resolve) => {
        xhr.onload = () => {
          resolve(JSON.parse(xhr.responseText));
        };
      });
    },apiURL);

    return response
  }
}
