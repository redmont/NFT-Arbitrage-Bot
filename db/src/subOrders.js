const {OpenSeaStreamClient, EventType} = require("@opensea/stream-js");
const fetch = require("node-fetch");
const {WebSocket} = require("ws");
const ethers = require("ethers");
const {InitializeDB} = require("./mongo");

const wallet = ethers.Wallet.createRandom();

//@todo only add (blur sales & os bids + os sales) to db.

const osClient = new OpenSeaStreamClient({
    token: process.env.API_OS,
    networkName: "mainnet",
    connectOptions: {
        transport: WebSocket,
    },
});

const db = {
    var: {
        BLUR_AUTH_TKN: "",
        OS_SUB_EVENTS: [
            EventType.ITEM_RECEIVED_BID,
            EventType.COLLECTION_OFFER,
            EventType.TRAIT_OFFER,
            EventType.ITEM_LISTED, //not sure
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
    const handleBasicOffer = async ({payload}) => {
        if (payload?.item?.chain?.name !== "ethereum") return;

        const addr = ethers.getAddress(payload?.protocol_data?.parameters?.consideration[0]?.token);
        const id = payload?.protocol_data?.parameters?.consideration[0]?.identifierOrCriteria;
        const salePrice = BigInt(payload.base_price);
        //@todo add to db

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
    try {
        osClient.onEvents("*", db.var.OS_SUB_EVENTS, async (event) => {
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
    let prevOrders = new Set(); //needs that, cuz Blur returns "currOrders" in semi-random order.

    //↓↓↓ STARTS BELOW ↓↓↓
    function _waitBasedOn(newOrdersLength) {
        const toWait = Math.max(0, -10 * newOrdersLength + 500); //0new:500ms; 10new:400ms; ... >=50new:0ms
        return new Promise((resolve) => setTimeout(resolve, toWait));
    }

    //↓↓↓ STARTS BELOW ↓↓↓
    const _handleNewOrder = async (order) => {
        const addr = ethers.getAddress(order.contractAddress);
        const price = ethers.parseEther(order.price.amount);

        //@todo add to db
    };

    //↓↓↓ STARTS BELOW ↓↓↓
    const _handleNewOrders = async (orders) => {
        const collection = db.mongoDB.collection("collectionSalesBids");
        const insertResult = await collection.insertMany(orders);
        console.log("Inserted documents =>", insertResult);
    };

    //↓↓↓ STARTS BELOW ↓↓↓
    function _getNewOrders(activityItems) {
        return activityItems.filter((order) => !prevOrders.has(order.id));
    }

    //↓↓↓ STARTS BELOW ↓↓↓
    const _getData = async (prevCursor) => {
        const baseFilter = {
            count: 100,
            eventFilter: {
                orderCreated: {}, //@todo sub also sold items to delete from db
            },
        };

        const filters = prevCursor ? {cursor: prevCursor, ...baseFilter} : baseFilter;
        const url = `http://127.0.0.1:3000/v1/activity?filters=${encodeURIComponent(
            JSON.stringify(filters)
        )}`;
        const data = await apiCall({url: url, options: db.api.blur.options.GET});

        return [data.activityItems, data.cursor];
    };

    //→→→ STARTS HERE ←←←
    try {
        while (true) {
            let [activityItems, cursor] = await _getData();
            let newOrders = _getNewOrders(activityItems, prevOrders);

            while (newOrders.length > 99 && prevOrders.size > 0) {
                //catch missed orders
                [activityItems, cursor] = await _getData(cursor);
                const additionalOrders = _getNewOrders(activityItems, prevOrders);
                newOrders.push(...additionalOrders);
            }

            if (newOrders.length > 0) {
                //newOrders.forEach((order) => _handleNewOrder(order)); //update db for each
                // Prepare Data for DB
                newOrders = newOrders.map((order) => ({
                    ...order,
                    owner: order.fromTrader.address,
                    collection: order.contractAddress,
                    price: ethers.parseEther(order.price.amount),
                    type: "SALE",
                }));

                // Bulk Insert
                await _handleNewOrders(newOrders);
            }

            const orderIds = newOrders.map((order) => order.id); //set prevOrders
            prevOrders = new Set([...Array.from(prevOrders), ...orderIds].slice(-1000)); //hold 1k orders
            await _waitBasedOn(newOrders.length);
        }
    } catch (e) {
        console.error("\nERR: subscribeSells", e);
        await subscribeSells();
    }
};

const setup = async () => {
    /// SETUP BLUR AUTH TKN ///
    const dataToSign = await apiCall({
        url: db.api.blur.url.AUTH_GET,
        options: db.api.blur.options.AUTH,
    });

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

        subSalesBlur();
        //subSalesBidsOs();
    } catch (e) {
        console.error("\nERR: root:", e);
        await root();
    }
})();
