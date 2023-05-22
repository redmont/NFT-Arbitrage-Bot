const ethers = require("ethers");
const fetch = require("node-fetch");

const provider = new ethers.AlchemyProvider(
  "homestead",
  process.env.API_ALCHEMY
);
const wallet = new ethers.Wallet(process.env.PK_0, provider);

const apiCall = async ({ url, options }) => {
  var res;
  await fetch(url, options)
    .then((response) => response.json())
    .then((json) => (res = JSON.parse(JSON.stringify(json))))
    .catch((error) => console.error(error));
  return res;
};

const getOsBids = async () => {
  const queryParams = new URLSearchParams({
    chain: "ETHEREUM",
    count: "20",
    // event_types: "OFFER_ENTERED"
  });

  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  };

  var url = "http://127.0.0.1:3001/v1/allorders?" + queryParams;
  // var url = 'http://127.0.0.1:3001/v1/allorders'
  const bids_os = await apiCall({ url: url, options: options });
  return bids_os;
};

const getAuthTkn = async () => {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address: wallet.address,
    }),
  };

  var url = `http://127.0.0.1:3001/auth/getToken`;

  const msg = await apiCall({ url: url, options: options });
  return msg;
};

const setAuthTkn = async (msg, sign) => {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address: wallet.address,
      message: msg,
      signature: sign,
      chain: "ETHEREUM",
    }),
  };

  var url = `http://127.0.0.1:3001/auth/setToken`;

  const authTkn = await apiCall({ url: url, options: options });
  return authTkn;
};

const getPayload = async (authTkn, variables) => {
  // console.log(authTkn)
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      authtkn: authTkn,
      variables: JSON.stringify(variables),
    },
  };

  var url = `http://127.0.0.1:3001/v1/getPayload`;
  const payload = await apiCall({ url: url, options: options });
  return payload;
};

const getSell = async (authTkn) => {
  const collection = "0x5b11fe58a893f8afea6e8b1640b2a4432827726c";
  const id = "1033";

  const queryParams = new URLSearchParams({
    chain: "ETHEREUM",
    collection: collection,
    tokenID: id,
  });

  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      authtoken: authTkn,
      walletaddress: "0xffFFF8F8122eb53e503A535ba0eD63D35906F52f",
    },
  };

  const url =
    `http://127.0.0.1:3001/v1/${collection}/${id}/sell?` + queryParams;
  const payload = await apiCall({ url: url, options: options });
  console.log("payload", payload);
};

const getCriteriaBids = async (slug, authTkn) => {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      slug: slug,
      authtkn: authTkn,
    }),
  };

  var url = `http://127.0.0.1:3001/v1/getCriteriaBids`;

  const msg = await apiCall({ url: url, options: options });
  return msg;
};

// const testApi1 = async () => {
//   const options = {method: 'GET', headers: {'Content-Type': 'application/json'}};
//   // const options = {method: 'GET', headers: {'X-API-KEY': process.env.API_OS_OLD, 'Content-Type': 'application/json'}};

//   fetch('https://api.opensea.io/api/v1/asset/0xa7f551feab03d1f34138c900e7c08821f3c3d1d0/877/?include_orders=false', options)
//     .then(response => response.text())
//     .then(response => console.log(response))
//     .catch(err => console.error(err));
// }

// const testApi2 = async () => {
//   url = "https://api.opensea.io/api/v1/asset/0x34d85c9cdeb23fa97cb08333b511ac86e1c4e258/34316?format=json"
//   const options = {method: 'GET', headers: {'Content-Type': 'application/json'}};
//   fetch(url, options)
//     .then(response => response.text())
//     .then(response => console.log(response))
//     .catch(err => console.error(err));
// }

(async () => {
  // toDecode = "T3JkZXJWMlR5cGU6OTY3NDQ5OTA5Mg==";
  // toDecode = "QXNzZXRUeXBlOjQxMDgzOTEyMg==";
  // decoded = Buffer.from(toDecode, "base64").toString("ascii");
  // console.log(decoded);

  // toEncode = "AssetType:410839122";
  // encoded = Buffer.from(toEncode).toString("base64");
  // console.log("encoded", encoded);
  // return;
  const msgToSign = await getAuthTkn();
  const msg = msgToSign.data.auth.loginMessage;

  const sign = await wallet.signMessage(msg);
  const tknRawData = await setAuthTkn(msg, sign);

  const authTkn =
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiVlhObGNsUjVjR1U2TkRFME5EYzVORGs9IiwidXNlcm5hbWUiOiJfX09TX19weXhFcEJCc0c2ZVVrVmVJSkg0NUVuY3ZNVUFNMm1YNnd1TXZXUEs3cEpEZGxjNVJwS2FFWmVLQUFvOVdLVEhYIiwiYWRkcmVzcyI6IjB4MDAwMDBlOGM3OGU0NjE2NzhlNDU1YjFmNjg3OGJiMGNlNTBjZTU4NyIsImlzcyI6Ik9wZW5TZWEiLCJleHAiOjE2ODQ4MjYxNDUsIm9yaWdJYXQiOjE2ODQ3Mzk3NDUsImFwaUFjY2VzcyI6Im5vbmUifQ.HvBpQwXoQp37-rD3FdpquiGIpH7YNRxGVp9dvlCVK4o"; //tknRawData.data.auth.login.token;
  console.log("\nauthTkn", authTkn);

  const slug = "sakura-park";
  const criteriaBids = await getCriteriaBids(slug, authTkn);
  console.log("\ncriteriaBids", JSON.stringify(criteriaBids, null, 2));
  process.exit();
  // criteriaBids {
  // 	"data": {
  // 		"collection": {
  // 			"statsV2": {
  // 				"totalListed": 0
  // 			},
  // 			"collectionOffers": {
  // 				"edges": [
  // 					{
  // 						"node": {
  // 							"perUnitPriceType": {
  // 								"unit": "0.0041",
  // 								"symbol": "WETH"
  // 							},
  // 							"id": "T3JkZXJWMlR5cGU6OTYzMTUyODQyOA=="
  // 						}
  // 					}
  // 				]
  // 			},
  // 			"id": "Q29sbGVjdGlvblR5cGU6MTY0MDkyMTQ="
  // 		}
  // 	}
  // }

  const variables = {
    orderId: "T3JkZXJWMlR5cGU6OTY2OTc1OTMxMg==",
    // orderId: "T3JkZXJWMlR5cGU6OTYzMTU3MTQ4Mw==", //work
    itemFillAmount: "1",
    takerAssetsForCriteria: {
      assetContractAddress: "0x2fC722C1c77170A61F17962CC4D039692f033b43",
      tokenId: "1261",
      // assetContractAddress: "0x4b570b636e4f744199ec82f52d69b08b394ab850",
      // tokenId: "9110",
      chain: "ETHEREUM",
    },
    giftRecipientAddress: null,
    optionalCreatorFeeBasisPoints: 0,
  };

  const payload = await getPayload(authTkn, variables);
  console.log("payload", JSON.stringify(payload, null, 2));
})();
