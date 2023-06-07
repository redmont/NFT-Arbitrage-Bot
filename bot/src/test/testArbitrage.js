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
  trait: { name: "clothes", value: "TShirt" },
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

const _getCreateCollectionOfferPayload = async (trait) => {
  const expirationTime = new Date();
  expirationTime.setDate(expirationTime.getDate() + 30);

  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      variables: JSON.stringify({
        price: {
          paymentAsset: "UGF5bWVudEFzc2V0VHlwZTo3OQ==",
          amount: testData.offerAmount,
        },
        closedAt: expirationTime.toISOString(),
        assetContract: {
          contractAddress: testData.contractAddress,
          chain: "ETHEREUM",
        },
        collection: testData.collectionSlug,
        trait: trait || null,
        quantity: "1",
      }),
    },
  };

  var url = "http://127.0.0.1:3001/v1/createCollectionOfferPayload";
  const payload = await apiCall({ url: url, options: options });
  return payload;
};

const _createCollectionOfferOsAPI = async (message, signature, trait) => {
  const criteria = {
    collection: {
      slug: testData.collectionSlug,
    },
  };
  if (trait) {
    criteria.trait = {
      type: trait.name,
      value: trait.value,
    };
  }
  const options = {
    url: "https://api.opensea.io/v2/offers",
    method: "POST",
    headers: {
      "X-API-KEY": process.env.API_OS_0,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      criteria: criteria,
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
let trait;

(async () => {
  // Create a collection offer
  // Item Type: 4
  // orderType: 0

  //const payload = await _getCreateCollectionOfferPayload();

  // Create a trait offer
  // Item Type: 4
  // orderType: 0

  trait = testData.trait;
  const payload = await _getCreateCollectionOfferPayload(trait);
  console.log(JSON.stringify(payload, null, 2));

  let { clientMessage } =
    payload?.data?.blockchain?.createCollectionOfferActions[0].method;

  const clientMessageEdited = JSON.parse(clientMessage);

  // Edit for order type 0
  clientMessageEdited.message.zone =
    "0x0000000000000000000000000000000000000000";
  clientMessageEdited.message.orderType = "0";

  // ressign
  const signature = await getSignTypedData(JSON.stringify(clientMessageEdited));

  // create offer using OS API
  const offer = await _createCollectionOfferOsAPI(
    clientMessageEdited.message,
    signature,
    trait || null
  );
  console.log(offer);
})();
