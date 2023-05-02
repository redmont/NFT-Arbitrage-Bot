const {OpenSeaStreamClient, EventType} = require("@opensea/stream-js");
const {InitializeDB} = require("../mongo");
const fetch = require("node-fetch");
const {WebSocket} = require("ws");
const ethers = require("ethers");

const wallet = ethers.Wallet.createRandom();

const TEST_MODE = false

/** @todo
 * 	[ ] add blur sales
 * 	[ ] add os bids (if corresponding saleBlur exists & bid is top10 highest price)
 *  [ ] os sales (later)
 */

const osClient = new OpenSeaStreamClient({
    token: process.env.API_OS,
    networkName: "mainnet",
    connectOptions: {
        transport: WebSocket,
    },
    onError: (error) => console.error("ERR: osClient", error),
    logLevel: 1,
});

const db = {
    var: {
        TEST_NFT: '0xa7f551FEAb03D1F34138c900e7C08821F3C3d1d0',
		TEST_NFT_ID: '877',
        BLUR_AUTH_TKN: "",
        MIN_SELL_TO_PRICE: 10n**16n,
        OS_SUB_EVENTS: [
            EventType.ITEM_RECEIVED_BID,
            // EventType.COLLECTION_OFFER,
            // EventType.TRAIT_OFFER,
            // EventType.ITEM_LISTED,
        ],
    },
    api: {
        blur: {
            url: {
                AUTH_GET: "http://127.0.0.1:3000/auth/getToken",
                AUTH_SET: "http://127.0.0.1:3000/auth/setToken",
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
        os: {
            url: {},
            options: {
                GET: {
                    method: "GET",
                    headers: {accept: "application/json", "X-API-KEY": process.env.API_OS},
                },
            }
        },
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

const subSalesBidsOs = async () => {
    const handleBasicOffer = async (event) => {
        if (event.payload?.item?.chain?.name !== "ethereum") return;

        const addr = ethers.getAddress(
            event.payload?.protocol_data?.parameters?.consideration[0]?.token
        );
        const id = event.payload?.protocol_data?.parameters?.consideration[0]?.identifierOrCriteria;

        if(TEST_MODE){
            if (addr !== db.var.TEST_NFT || id !== db.var.TEST_NFT_ID) return
            console.log(`\n\x1b[38;5;202mSTARTED SUBSCRIBE OS BIDS\x1b[0m`)
        }

        let _sellToPrice = BigInt(event.payload.base_price);

        for (const osFeeData of event.payload?.protocol_data?.parameters.consideration) {
            if (osFeeData.itemType <= 1) {
                //0: ETH, 1: ERC20, 2: ERC721...
                _sellToPrice -= BigInt(osFeeData.startAmount);
            }
        }

        if(_sellToPrice <= db.var.MIN_SELL_TO_PRICE) return; //2small
        event.priceNet = _sellToPrice.toString();
        event.addr = addr;
        event.id = id;
        event.type = 'BID'

        //add to mongodb
        const collection = db.mongoDB.collection("BIDS");
        // const insertResult = await collection.insertOne(event);
        // console.log("Inserted OS BIDS:", insertResult);
        //@todo add to db only if correspoding SALE exists
        return;
    };

    const handleCollectionOffer = async (event) => {
        //@todo add to db
    };

    const handleTraitOffer = async (event) => {
        //@todo add to db
    };

    const handleItemListed = async (event) => {
        //@todo add to db
    };

    //→→→ STARTS HERE ←←←
    let count = 0;
    try {
        osClient.onEvents("*", db.var.OS_SUB_EVENTS, async (event, error) => {
            if(error) {
                console.error("found ERR", error);
            }
            process.stdout.write(`\r\x1b[38;5;12mSUBSCRIBE OS BIDS\x1b[0m: ${++count}`);
            switch (event.event_type) {
                case EventType.ITEM_RECEIVED_BID:
                    handleBasicOffer(event);
                    break;
                case EventType.COLLECTION_OFFER:
                    handleCollectionOffer(event);
                    break;
                case EventType.TRAIT_OFFER:
                    handleTraitOffer(event);
                    break;
                case EventType.ITEM_LISTED:
                    handleItemListed(event);
                    break;
            }
        });

    } catch (e) {
        console.error("ERR: subscribeSells", e);
        await subscribeSells();
    }
};

const subSalesBlur = async () => {
    console.log(`\n\x1b[38;5;202mSTARTED SUBSCRIBE BLUR SELL ORDERS\x1b[0m`);
    var prevOrders = new Set(); //needs that, cuz Blur returns "currOrders" in semi-random order.

    const _waitBasedOn = async (newOrdersLength) => {
        const toWait = Math.max(0, -10 * newOrdersLength + 500); //0new:500ms; 10new:400ms; ... >=50new:0ms
        return new Promise((resolve) => setTimeout(resolve, toWait));
    }

    const _addToDB = async (newBlurSales) => {
        const formattedSales = newBlurSales
            .map(sale => {
                const marketplace = sale.marketplace;
                if (marketplace !== 'BLUR') return null //only Blur

                const price = ethers.parseEther(sale.price.amount).toString();
                const owner_addr = ethers.getAddress(sale.fromTrader.address);
                const tkn_addr = ethers.getAddress(sale.contractAddress);
                const tkn_id = sale.tokenId;
                const listed_date_timestamp = Math.floor(Date.parse(sale.createdAt));
                const type = 'BLUR_SALE_SUB'

                const order_hash = ethers.solidityPackedKeccak256(
                    ['address', 'uint256', 'address', 'uint256', 'uint256'],
                    [tkn_addr, tkn_id, owner_addr, price, listed_date_timestamp]
                );

                return {
                    order_hash,
                    price,
                    owner_addr,
                    tkn_addr,
                    tkn_id,
                    type,
                    raw_sale: sale
                };
            })
            .filter(Boolean);

        console.log('formattedSales', formattedSales.length)
        if (formattedSales.length === 0) return; //can happen if 0 Blur sale

        const collection = db.mongoDB.collection('SALES');
        const bulkOps = formattedSales.map(sale => ({
            updateOne: {
                filter: { order_hash: sale.order_hash },
                update: { $set: sale },
                upsert: true
            }
        }));

        try {
            const result = await collection.bulkWrite(bulkOps, { ordered: true });
            console.log(`
                Inserted new BLUR SALES:
                - upsertedCount: ${result.upsertedCount}
                - matchedCount: ${result.matchedCount}
                - modifiedCount: ${result.modifiedCount}
                - insertedCount: ${result.insertedCount}
            `);
        } catch (err) {
            console.error('Error during bulkWrite:', err);
        }

        try {
            await collection.createIndex({ order_hash: 1 }, { unique: true });
        } catch (err) {
            console.error('Error during createIndex:', err);
        }
    }

    const _getData = async (prevCursor) => {
        const baseFilter = {
            count: 100, //or 50 or 25
            eventFilter: {
                orderCreated: {}, //@todo sub also sold items to delete from db
            },
        };

        const filters = prevCursor ? {cursor: prevCursor, ...baseFilter} : baseFilter;
        const url = `http://127.0.0.1:3000/v1/activity?filters=${encodeURIComponent(
            JSON.stringify(filters)
        )}`;
        const data = await apiCall({url: url, options: db.api.blur.options.GET});
        return data
    };

    const _getNewBlurSales = async (sales) => {
        return sales.filter(order => !prevOrders.has(order.id)); //can't filter Blur only, cuz !detect amt of missed orders
    }

    try {
        while(true){ //@todo when got time, create _getBlurSales() and call it here
            let data = await _getData();
            let newBlurSales = await _getNewBlurSales(data.activityItems);

            if(newBlurSales.length==0) {
                await _waitBasedOn(0);
                continue
            }

            while(newBlurSales.length%100==0 && prevOrders.size>0) {
                data = await _getData(data.cursor);
                const missedNewSales = await _getNewBlurSales(data.activityItems);
                newBlurSales = [...newBlurSales, ...missedNewSales];
            }

            prevOrders = new Set([...prevOrders, ...newBlurSales.map((order) => order.id)].slice(-1000)); //store 1k latest
            _addToDB(newBlurSales);
            await _waitBasedOn(newBlurSales.length);
        }

    } catch (e) {
        console.error("ERR: subSalesBlur", e);
        await subSalesBlur();
    }
};

const setup = async () => {
    /// SETUP BLUR AUTH TKN ///
    const dataToSign = await apiCall({
        url: db.api.blur.url.AUTH_GET,
        options: db.api.blur.options.AUTH,
    });

    console.log('dataToSign', dataToSign)

    //!!! @todo validate that (here use random wallet, but keep in mind) !!!
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

(async function root() {
    try {
        await setup();
        console.log('setup done:', db.var.BLUR_AUTH_TKN)

        subSalesBlur();
        // subSalesBidsOs();
    } catch (e) {
        console.error("\nERR: root:", e);
        await root();
    }
})();
