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
        START_TIME_GET_ID: 0,
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
};

const apiCall = async ({url, options}) => {
    let res;
    await fetch(url, options)
        .then((response) => response.json())
        .then((json) => (res = JSON.parse(JSON.stringify(json))))
        .catch((error) => console.error(error));
    return res;
};

const getAllNftsBlur = async () => {
    const _updateDb = async (nft) => {
        const addr = ethers.getAddress(nft?.contractAddress);
        const price = nft?.floorPrice ? ethers.parseEther(nft.floorPrice.amount) : null;

        if (db.nft[addr]) {
            //update
            db.nft[addr].FLOOR = price;
            db.nft[addr].SLUG = nft.collectionSlug;
        } else if (!db.nft[addr]) {
            //add new
            db.nft[addr] = {
                SLUG: nft.collectionSlug,
                FLOOR: price,
                DEX: "",
                id: {}, //same as above
            };
        }
        // upsert (update or insert) into DB
        const collection = db.mongoDB.collection("idData");
        const query = {contractAddr: addr};
        const update = {
            $set: {
                slug: db.nft[addr].SLUG,
                floor: db.nft[addr].FLOOR,
                dex: db.nft[addr].DEX,
            },
        };

        await collection.updateOne(query, update, {upsert: true});
    };

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

            for (nft of data?.collections) {
                await _updateDb(nft);
            }

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
        Object.keys(db.nft).length
    );
    console.timeEnd("getAllNftsBlur");
};

const getEachNftIdSaleBlur = async () => {
    const _updateProgress = (SLUG) => {
        const percent = Math.round((++db.var.PROGRESS_GET_ID / Object.values(db.nft).length) * 100);
        if (percent > 100) percent = 100;

        const currTime = Math.floor(Date.now() / 1000);
        const timeDiff = currTime - db.var.START_TIME_GET_ID;
        const timeDiffStr = new Date(timeDiff * 1000).toISOString().substr(11, 8);

        process.stdout.write(`\r\x1B[2K ID progress: ${percent}%;  time: ${timeDiffStr};  ${SLUG}`);
        // if(percent > db.var.PROGRESS_GET_ID_PERCENT){
        // 	console.log(`\ngetEachNftId completed in ${percent}%`);
        // }
        db.var.PROGRESS_GET_ID_PERCENT = percent;
    };

    const _updateDb = async (_data) => {
        if (!_data.tokens) return;
        for (const {tokenId, price} of _data.tokens) {
            const addr = ethers.getAddress(_data.contractAddress);
            const nft = db.nft[addr]?.id?.[tokenId] ?? {DEX: ""}; //read or assign "{}"
            nft.PRICE = ethers.parseEther(price.amount); //set price (reason for try, cuz inputs incorrect)
            db.nft[addr].id[tokenId] = nft; //update or assign

            // upsert (update or insert) into DB
            const collection = db.mongoDB.collection("idData");
            const query = {contractAddr: addr};
            const update = {
                $set: {
                    slug: db.nft[addr].SLUG,
                    floor: db.nft[addr].FLOOR,
                    dex: db.nft[addr].DEX,
                },
            };
            Object.keys(db.nft[addr].id).forEach((id) => {
                update.$set[`ids.${id}`] = db.nft[addr].id[id];
            });

            await collection.updateOne(query, update, {upsert: true});
        }
    };

    const _setURL = async (data, slug) => {
        const hasAsksFilter = {hasAsks: true};
        const nftPrices = data?.nftPrices || [];

        const filters =
            nftPrices.length === 0
                ? hasAsksFilter
                : {
                      cursor: {
                          tokenId: nftPrices[nftPrices.length - 1].tokenId,
                          price: {...nftPrices[nftPrices.length - 1].price},
                      },
                      ...hasAsksFilter,
                  };

        const url = `http://127.0.0.1:3000/v1/collections/${slug}/tokens?filters=${encodeURIComponent(
            JSON.stringify(filters)
        )}`;
        return url;
    };

    //→→→ STARTS HERE ←←←
    // console.time('getEachNftIdSaleBlur')
    console.log("\x1b[33m%s\x1b[0m", "\nSTARTED COLLECTING EACH NFT ID PRICE");

    try {
        for (const {SLUG} of Object.values(db.nft)) {
            _updateProgress(SLUG);

            let data = {};
            let countPages = 0; //for collections > 1k

            do {
                const url = await _setURL(data, SLUG);
                data = await apiCall({url, options: db.api.blur.options.GET});
                if (!data) {
                    console.log("ERR: getEachNftIdSaleBlur, no data, SLUG:", SLUG);
                    continue;
                }
                await _updateDb(data);
                countPages += data?.tokens?.length;
            } while (countPages < data.totalCount);
        }
    } catch (e) {
        console.error("\nERR: getEachNftIdSaleBlur", e);
        // console.log('\nERROR_SLUG:', SLUG)
        // db.var.ERROR_SLUG = SLUG
        await getEachNftIdSaleBlur();
    }

    console.log("\x1b[33m%s\x1b[0m", "\nCOMPLETED COLLECTING EACH NFT ID PRICE");
    // console.timeEnd('getEachNftIdSaleBlur')
};

const getEachNftIdBidOs = async () => {
    const _setNewPage = async () => {
        var url = (asset_contract_address, token_ids) => {
            return `https://api.opensea.io/v2/orders/ethereum/seaport/offers?asset_contract_address=${asset_contract_address}${token_ids}&order_by=eth_price&order_direction=desc`;
        };

        var myHeaders = new fetch.Headers();
        myHeaders.append("X-API-KEY", process.env.API_OS);
        myHeaders.append("content-type", "application/json");
        myHeaders.append("accept", "application/json");

        const options = {
            method: "GET",
            headers: myHeaders,
            redirect: "follow",
        };

        db.api.os.url.OFFERS = url;
        db.api.os.options.OFFERS = options;
    };

    const getOffers = async (collectionAddr, tokenIDs) => {
        tokenIDs = Object.keys(tokenIDs);
        const token_ids = tokenIDs.map((id) => "&token_ids=" + id).join("");

        const url = db.api.os.url.OFFERS(collectionAddr, token_ids);
        const options = db.api.os.options.OFFERS;
        console.log("url:", url);

        let data;
        await fetch(url, options)
            .then((res) => res.json())
            .then((json) => (data = JSON.parse(JSON.stringify(json))))
            .catch((err) => console.error("error:" + err));

        if (!data || !data.orders) {
            console.log("Error in API");
            console.log(url);
        }
        return data?.orders;
    };

    const updateDB = async (collectionAddr, offers) => {
        // upsert (update or insert) into DB
        const collection = db.mongoDB.collection("idData");
        const query = {contractAddr: collectionAddr};
        const update = {
            $set: {},
        };

        offers.forEach((offer) => {
            const id = offer.protocol_data.parameters.consideration[0].identifierOrCriteria;
            update.$set[`ids.${id}.OFFERS`] = offer;
        });

        await collection.updateOne(query, update, {upsert: true});
    };

    try {
        for (const collectionAddr of Object.keys(db.nft)) {
            const {SLUG, id} = db.nft[collectionAddr];
            _setNewPage(collectionAddr, id);
            const offers = await getOffers(collectionAddr, id);
            //console.log("offers:", JSON.stringify(offers, null, 2));
            if (offers.length > 0) {
                console.log("\nSLUG:", SLUG);
                console.log(collectionAddr, id);
                await updateDB(collectionAddr, offers);
            }
        }
    } catch (error) {
        console.log("error:", error);
        await getEachNftIdBidOs();
    }
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
    await getAllNftsBlur(); //<1m
    //console.log("\ndb after all nfts", db.nft);

    db.var.START_TIME_GET_ID = Math.floor(Date.now() / 1000);
    await getEachNftIdSaleBlur(); //~1h
    //console.log("\ndb after all ids", db.nft);
    // getEachNftIdBidOs();
    // console.log('\ndb after all ids', db.nft)
    //@todo same from os
})();