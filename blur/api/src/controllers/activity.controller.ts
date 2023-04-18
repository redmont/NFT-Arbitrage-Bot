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

//https://core-api.prod.blur.io/v1/activity/?filters={"eventFilter":{"orderCreated":{}}}
export class ActivityController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) {
  }

  // Map to `GET /v1/activity`
  @get('/v1/activity')
  @response(200, RESPONSE)
    async activity(): Promise<any> {
      const {authtoken,walletaddress} = this.req.headers

      const cookies = [{
        'name': 'authToken',
        'value': authtoken
      },{
        'name': 'walletAddress',
        'value': walletaddress
      }];

      await page.setCookie(...cookies);

			const apiURL = 'https://core-api.prod.blur.io/v1/activity/event-filter?filters={"count":100, "eventFilter":{"orderCreated":{}}}'
			// const apiURL = 'https://core-api.prod.blur.io/v1/activity/event-filter?filters={%22eventFilter%22:{%22orderCreated%22:{}}}'

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
}

