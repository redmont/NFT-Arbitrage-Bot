const fetch = require("node-fetch");
const ethers = require("ethers");

const wallet = ethers.Wallet.createRandom();

const {InitializeDB} = require("./mongo");

const TEST_MODE = true;

const db = {
    var: {
        BLUR_AUTH_TKN: "",
        PROGRESS_GET_ID_PERCENT: 0,
        PROGRESS_GET_ID: 0,
        START_TIME_GET_SALES_AND_BIDS: 0,
        NFT_COUNT: 0,
    },
    api: {
        blur: {
            url: {
                AUTH_GET: "http://127.0.0.1:3000/auth/getToken",
                AUTH_SET: "http://127.0.0.1:3000/auth/setToken",
                COLLECTIONS:
                    "http://127.0.0.1:3000/v1/collections/?filters=%7B%22sort%22%3A%22FLOOR_PRICE%22%2C%22order%22%3A%22DESC%22%7D",
            },
            options: {
                AUTH: {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({walletAddress: wallet.address}),
                },
                GET: {}, //in setup()
            },
        },
        os: {url: {}, options: {}},
    },
    nft: {},
    SLUGS: [],
};

const apiCall = async ({url, options}) => {
    let res;
    await fetch(url, options)
        .then((response) => response.json())
        .then((json) => (res = JSON.parse(JSON.stringify(json))))
        .catch((error) => console.error(error));
    return res;
};

const getBlurSlugs = async () => {
    const _setNewPage = async (data) => {
        const lastCollection = data.collections[data.collections.length - 1];
        const floorPrice = lastCollection.floorPrice?.amount && lastCollection.floorPrice.amount;

        const filters = {
            cursor: {
                contractAddress: lastCollection.contractAddress,
                floorPrice: floorPrice || null,
            },
            sort: "FLOOR_PRICE",
            order: "DESC",
        };

        const filtersURLencoded = encodeURIComponent(JSON.stringify(filters));
        db.api.blur.url.COLLECTIONS =
            "http://127.0.0.1:3000/v1/collections/" + "?filters=" + filtersURLencoded;
    };

    const _getAllNfts = async () => {
        try {
            let data = await apiCall({
                url: db.api.blur.url.COLLECTIONS,
                options: db.api.blur.options.GET,
            });

            if (!data || data?.collections?.length === 0) return;

            if (TEST_MODE) {
                data.collections = data.collections.slice(0, 3);
            }

            data?.collections?.forEach(nft => db.SLUGS.push(nft.collectionSlug));

            if (TEST_MODE && db.var.NFT_COUNT++ > 2) return;

            await _setNewPage(data);
            await _getAllNfts();
        } catch (e) {
            console.error("ERR: getAllNftsBlur:", e);
            await _getAllNfts();
        }
    };

    //→→→ STARTS HERE ←←←
    console.time("getAllNftsBlur");
    console.log("\x1b[95m%s\x1b[0m", "\n STARTED COLLECTING NFTs");
    await _getAllNfts();
    console.log(
        "\x1b[95m%s\x1b[0m",
        "\n FINISHED COLLECTING NFTs, amt:",
        db.SLUGS.length
    );
    console.timeEnd("getAllNftsBlur");
};

//@todo implement into getBlurSalesAndBids=>_addOsBidsToDb
// const getEachNftIdBidOs = async () => {
//     const _setNewPage = async () => {
//         var url = (asset_contract_address, token_ids) => {
//             return `https://api.opensea.io/v2/orders/ethereum/seaport/offers?asset_contract_address=${asset_contract_address}${token_ids}&order_by=eth_price&order_direction=desc`;
//         };

//         var myHeaders = new fetch.Headers();
//         myHeaders.append("X-API-KEY", process.env.API_OS);
//         myHeaders.append("content-type", "application/json");
//         myHeaders.append("accept", "application/json");

//         const options = {
//             method: "GET",
//             headers: myHeaders,
//             redirect: "follow",
//         };

//         db.api.os.url.OFFERS = url;
//         db.api.os.options.OFFERS = options;
//     };

//     const getOffers = async (collectionAddr, tokenIDs) => {
//         tokenIDs = Object.keys(tokenIDs);
//         const token_ids = tokenIDs.map((id) => "&token_ids=" + id).join("");

//         const url = db.api.os.url.OFFERS(collectionAddr, token_ids);
//         const options = db.api.os.options.OFFERS;
//         console.log("url:", url);

//         let data;
//         await fetch(url, options)
//             .then((res) => res.json())
//             .then((json) => (data = JSON.parse(JSON.stringify(json))))
//             .catch((err) => console.error("error:" + err));

//         if (!data || !data.orders) {
//             console.log("Error in API");
//             console.log(url);
//         }
//         return data?.orders;
//     };

//     const updateDB = async (collectionAddr, offers) => {
//         // upsert (update or insert) into DB
//         const collection = db.mongoDB.collection("idData");
//         const query = {contractAddr: collectionAddr};
//         const update = {
//             $set: {},
//         };

//         offers.forEach((offer) => {
//             const id = offer.protocol_data.parameters.consideration[0].identifierOrCriteria;
//             update.$set[`ids.${id}.OFFERS`] = offer;
//         });

//         await collection.updateOne(query, update, {upsert: true});
//     };

//     try {
//         for (const collectionAddr of Object.keys(db.nft)) {
//             console.log('\n\ncollectionAddr', collectionAddr)
//             const {SLUG, id} = db.nft[collectionAddr];
//             // console.log("SLUG:", SLUG);
//             // console.log("id:", id);
//             // process.exit(0)
//             _setNewPage(collectionAddr, id);
//             const offers = await getOffers(collectionAddr, id);
//             console.log("offers:", offers)
//             //console.log("offers:", JSON.stringify(offers, null, 2));
//             if (offers.length > 0) {
//                 console.log("\nSLUG:", SLUG);
//                 console.log(collectionAddr, id);
//                 await updateDB(collectionAddr, offers);
//             }
//         }
//     } catch (error) {
//         console.log("error:", error);
//         await getEachNftIdBidOs();
//     }
// };

const getBlurSalesAndOsBids = async () => {
    // (3/3)
    const _addOsBidsToDb = async (slug, addr, tkns) => {
    /**
     * @todo check max amt of token_ids in: https://api.opensea.io/v2/orders/ethereum/seaport/offers?token_ids=token_ids%3D1%26token_ids%3D209&order_by=created_date&order_direction=desc
     * @todo check if -> more efficient: https://docs.opensea.io/reference/retrieve-all-offers
     */
    };

    // (2/3)
    const _addBlurSalesToDb = async (slug, addr, tkns) => {
        //@todo consider adding formatted price
        const formattedTkns = tkns.map((tkn) => {
            return {
                ...tkn,
                contractAddress: addr,
                slug: slug,
            };
          });

        const collection = db.mongoDB.collection("SALES1");
        const insertResult = await collection.insertMany(formattedTkns);
        // console.log("Inserted documents =>", insertResult);
        return
    };

    // (1/3)
    const _setURL = async (data, slug) => {
        // https://core-api.prod.blur.io/v1/collections/azuki/tokens?filters={"traits":[],"hasAsks":true}
        const baseFilter = {traits: [], hasAsks: true};
        const tkns = data?.tokens || [];

        // {"cursor":{"price":{"unit":"ETH","time":"2023-04-26T14:48:44.000Z","amount":"16.8"},"tokenId":"5599"},"traits":[],"hasAsks":true}
        const filters =
            tkns.length === 0
                ? baseFilter
                : {
                    cursor: {
                        price: tkns[tkns.length - 1].price,
                        tokenId: tkns[tkns.length - 1].tokenId,
                    },
                    ...baseFilter,
                };

        const url = `http://127.0.0.1:3000/v1/collections/${slug}/tokens?filters=${encodeURIComponent(
            JSON.stringify(filters)
        )}`;
        return url;
    };

    // (0/3)
    const _updateProgress = (SLUG) => {
        const percent = Math.round((++db.var.PROGRESS_GET_ID / db.SLUGS.length * 100));
        if (percent > 100) percent = 100;

        const currTime = Math.floor(Date.now() / 1000);
        const timeDiff = currTime - db.var.START_TIME_GET_SALES_AND_BIDS;
        const timeDiffStr = new Date(timeDiff * 1000).toISOString().substr(11, 8);

        process.stdout.write(`\r\x1B[2K ID progress: ${percent}%;  time: ${timeDiffStr};  ${SLUG}`);
        db.var.PROGRESS_GET_ID_PERCENT = percent;
    };

    // (0/3)
    console.log("\x1b[33m%s\x1b[0m", "\nSTARTED COLLECTING EACH NFT ID PRICE");
    try {
        for (const SLUG of db.SLUGS) {
            _updateProgress(SLUG);
            let data = {};
            let tkns = [];
            let countPages = 0; //for collections > 100

            do {
                const url = await _setURL(data, SLUG);
                data = await apiCall({url, options: db.api.blur.options.GET});
                if (!data) {
                    console.log("ERR: getEachNftIdSaleBlur, no data, SLUG:", SLUG);
                    continue;
                }
                tkns = tkns.concat(data.tokens);
                countPages += data?.tokens?.length;
            } while (countPages < data.totalCount);

            if(!tkns) continue

            const addr = ethers.getAddress(data.contractAddress);
            await _addBlurSalesToDb(SLUG, addr, tkns);

            //@todo get data from os & add \/
            //await _addOsBidsToDb(SLUG, addr, tkns);
        }
    } catch (e) {
        console.error("\nERR: getBlurSalesAndOsBids", e);
        await getEachNftIdSaleBlur();
    }

    console.log("\x1b[33m%s\x1b[0m", "\nCOMPLETED COLLECTING EACH NFT ID PRICE");
};

const setup = async () => {
    const dataToSign = await apiCall({
        url: db.api.blur.url.AUTH_GET,
        options: db.api.blur.options.AUTH,
    });

    dataToSign.signature = await wallet.signMessage(dataToSign.message);
    db.api.blur.options.AUTH.body = JSON.stringify(dataToSign);
    db.var.BLUR_AUTH_TKN = (
        await apiCall({url: db.api.blur.url.AUTH_SET, options: db.api.blur.options.AUTH})
    ).accessToken;

    /// SETUP BLUR API OPTIONS ///
    db.api.blur.options.GET = {
        method: "GET",
        headers: {
            authToken: db.var.BLUR_AUTH_TKN,
            walletAddress: wallet.address,
            "content-type": "application/json",
        },
    };

    // DB CLIENT
    db.mongoDB = await InitializeDB();
};

(async () => {
    await setup();
    // console.time("getBlurSlugs")
    // await getBlurSlugs(); //<1m
    // console.timeEnd("getBlurSlugs")

    //4test, 1st 344 ids; 2nd 2865 ids
    db.SLUGS = ['proof-moonbirds', 'otherdeed']
    db.var.START_TIME_GET_SALES_AND_BIDS = Math.floor(Date.now() / 1000);
    await getBlurSalesAndOsBids();
    return
})();
