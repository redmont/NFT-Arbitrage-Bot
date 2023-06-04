const fetch = require("node-fetch");
const ethers = require("ethers");
const {
  signTypedData,
  SignTypedDataVersion,
} = require("@metamask/eth-sig-util");

const provider = new ethers.AlchemyProvider(
  "homestead",
  process.env.API_ALCHEMY
);
const wallet = new ethers.Wallet(process.env.PK_0, provider);

const testData = {
  collectionSlug: "yes-ser",
  contractAddress: "0xa7f551feab03d1f34138c900e7c08821f3c3d1d0",
  walletAddress: "0x00000E8C78e461678E455b1f6878Bb0ce50ce587",
  offerAmount: "0.0027",
};

const apiCall = async ({ url, options }) => {
  let res;
  await fetch(url, options)
    .then((response) => response.json())
    .then((json) => (res = JSON.parse(JSON.stringify(json))))
    .catch((error) => console.error(error));
  return res;
};

const getSignTypedData = async (data) => {
  const privateKey = Buffer.from(process.env.PK_0, "hex");
  const signature = signTypedData({
    privateKey,
    data: JSON.parse(data),
    version: SignTypedDataVersion.V4,
  });
  return signature;
};

const _getCreateCollectionOfferPayload = async () => {
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      variables: JSON.stringify({
        price: {
          paymentAsset: "UGF5bWVudEFzc2V0VHlwZTo3OQ==",
          amount: testData.offerAmount,
        },
        closedAt: "2023-06-06T07:41:16.740Z",
        assetContract: {
          contractAddress: testData.contractAddress,
          chain: "ETHEREUM",
        },
        collection: testData.collectionSlug,
        trait: null,
        quantity: "1",
      }),
    },
  };

  var url = "http://127.0.0.1:3001/v1/createCollectionOfferPayload";
  const payload = await apiCall({ url: url, options: options });
  return payload;
};

const _createCollectionOfferOS = async (
  orderData,
  clientSignature,
  serverSignature
) => {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      variables: JSON.stringify({
        orderData,
        clientSignature,
        serverSignature,
      }),
    },
  };

  var url = "http://127.0.0.1:3001/v1/createCollectionOffer";
  const payload = await apiCall({ url: url, options: options });
  return payload;
};

const _createCollectionOfferOsAPI = async (message, signature) => {
  const options = {
    url: "https://api.opensea.io/v2/offers",
    method: "POST",
    headers: {
      "X-API-KEY": process.env.API_OS_0,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      criteria: {
        collection: {
          slug: testData.collectionSlug,
        },
      },
      protocol_data: {
        parameters: message,
        signature: signature,
      },
      protocol_address: "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC",
    }),
  };
  const url = "https://api.opensea.io/v2/offers";

  const payload = await apiCall({ url: url, options: options });
  return payload;
};

const _getBlurToken = async () => {
  const dataToSign = await apiCall({
    url: "http://127.0.0.1:3000/auth/getToken",
    options: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: testData.walletAddress }),
    },
  });

  dataToSign.signature = await wallet.signMessage(dataToSign.message);

  const token = (
    await apiCall({
      url: "http://127.0.0.1:3000/auth/setToken",
      options: {
        body: JSON.stringify(dataToSign),
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    })
  ).accessToken;

  console.log("\n\x1b[38;5;202mBLUR_AUTH_TKN\x1b[0m", token);
  testData.blurToken = token;
};

const _getBlurNFTs = async () => {
  try {
    let data = await apiCall({
      url:
        "http://127.0.0.1:3000/v1/collections/" +
        testData.collectionSlug +
        "/prices?filters=%7B%22traits%22%3A%5B%5D%2C%22hasAsks%22%3Atrue%7D",
      options: {
        headers: {
          "Content-Type": "application/json",
          walletAddress: testData.walletAddress,
          authToken: testData.blurToken,
        },
      },
    });
    return data;
  } catch (e) {
    console.error(e);
  }
};

(async () => {
  //await _getBlurToken();
  //const cheapestNFT = (await _getBlurNFTs())?.nftPrices[0];
  //console.log(cheapestNFT);

  // Create a collection offer
  // Item Type: 4
  // orderType: 0

  const payload = await _getCreateCollectionOfferPayload();
  let { orderData, serverSignature, clientMessage } =
    payload?.data?.blockchain?.createCollectionOfferActions[0].method;

  const clientMessageEdited = JSON.parse(clientMessage);

  // Edit for order type 0
  clientMessageEdited.message.zone =
    "0x0000000000000000000000000000000000000000";
  clientMessageEdited.message.orderType = "0";

  const signature = await getSignTypedData(JSON.stringify(clientMessageEdited));

  const offer = await _createCollectionOfferOsAPI(
    clientMessageEdited.message,
    signature
  );
  console.log(offer);

  // Via graphql
  // const offer = await _createCollectionOfferOS(
  //   orderData,
  //   signature,
  //   serverSignature
  // );
  // console.log(JSON.stringify(offer, null, 2));
})();
