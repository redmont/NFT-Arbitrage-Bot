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

(async () => {
  // toDecode = "QXNzZXRFdmVudFR5cGU6MTE5MzI3NzE5NDM=";
  // decoded = Buffer.from(toDecode, "base64").toString("ascii");
  // console.log(decoded);
  // return;
  const msgToSign = await getAuthTkn();
  const msg = msgToSign.data.auth.loginMessage;

  const sign = await wallet.signMessage(msg);
  const tknRawData = await setAuthTkn(msg, sign);

  const authTkn = tknRawData.data.auth.login.token;
  console.log("\nauthTkn", authTkn);

  const slug = "yes-ser";
  const criteriaBids = await getCriteriaBids(slug, authTkn);
  console.log("\ncriteriaBids", JSON.stringify(criteriaBids, null, 2));
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
    orderId: "T3JkZXJWMlR5cGU6OTYzMTUyODQyOA==",
    // orderId: "T3JkZXJWMlR5cGU6OTYzMTU3MTQ4Mw==", //work
    itemFillAmount: "1",
    takerAssetsForCriteria: {
      assetContractAddress: "0xa7f551feab03d1f34138c900e7c08821f3c3d1d0",
      tokenId: "877",
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
