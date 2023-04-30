const fetch = require("node-fetch");
const ethers = require("ethers");

const wallet = ethers.Wallet.createRandom();

const {InitializeDB} = require("./mongo");

const db = {
    var: {
        BLUR_AUTH_TKN: "",
        PROGRESS_GET_ID_PERCENT: 0,
        PROGRESS_GET_ID: 0,
        START_TIME_GET_SALES_AND_BIDS: 0,
        NFT_COUNT: 0,
        MIN_SELL_TO_PRICE: 10n ** 16n,
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

const getOsBidsViaPuppeteer = async (slug, addr, tknIds) => {
    /**
     * OS API KEY is 2limited, we need to find alternatives. Please:
     *
     * @todo implement ASAP solution to fetch all basic bids for each tknId in tknIds via api-os puppeteer.
     *  [ ] find & test all queries
     *     - you can start with: "/v1/{collection}/{tokenID}/orders"
     *     - ensure you are using the cursor to get all orders
     *     - find&set amt bids to retrieve to max value (curr is hardcoded to 10)
     *     - optimize & "test" each solution.
     */
}

const getOsBidsViaApi = async (addr, tknIds) => {
    const __fetchAllBids = async (url) => {
        const batchBids = [];

        const ___fetchBids = async (currUrl) => {
            while (true) {
                try {
                    const data = await apiCall({ url: currUrl, options: db.api.os.options.GET });
                    if (data.detail) {//'Request was throttled. Expected available in 1 second.'
                        // console.log('data.detail:', data.detail)
                        console.log('api err limit: ', data)
                        //Request was throttled.
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue
                    }
                    return data;
                } catch (error) {
                    console.error('ERR ___fetchBids: ', error, '\nurl: ', currUrl);
                    return null;
                }
            }
        };

        let nextUrl = url;
        while (nextUrl) {
            const data = await ___fetchBids(nextUrl);
            if (!data || data.orders.length === 0) break

            const { next, previous, orders } = data;
            batchBids.push(...orders);
            nextUrl = next ? url + '&cursor=' + next : null; //if ordersInBatch>50, nextUrl exists
        }

        return batchBids;
    };

    try{
        let bids = [];
        const batchSize = 30; //tknsIds/call limit

        const baseURL = `https://api.opensea.io/v2/orders/ethereum/seaport/offers?limit=50&order_by=eth_price&order_direction=desc&asset_contract_address=${addr}&`;

        for (let i = 0; i < tknIds.length; i += batchSize) {
            const batchTknIds = tknIds.slice(i, i + batchSize);
            const url = baseURL + batchTknIds.map(tokenId => `token_ids=${tokenId}`).join('&');
            const batchBids = await __fetchAllBids(url);
            bids.push(...batchBids);
        }

        return bids
    } catch (error) {
        console.error('\nERR _getAndAddOsBidsToDb: ', error);
    }
};

const getBlurSales = async (slug) => {
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

    let data = {};
    let tkns = [];
    let countPages = 0; //for collections > 100

    try{
        do {
            const url = await _setURL(data, slug);
            data = await apiCall({url, options: db.api.blur.options.GET});
            if (!data) {
                console.log("ERR: getBlurSalesAndOsBids, Blur, no data, slug:", slug);
                continue;
            }
            tkns = tkns.concat(data.tokens);
            countPages += data?.tokens?.length;
        } while (countPages < data.totalCount);

        const tknIds = tkns.map((tkn) => tkn.tokenId);
        console.log('tknIds: ', tknIds.length)
        return [tknIds, ethers.getAddress(data.contractAddress)]
    } catch (error) {
        console.error('\nERR _getBlurSales: ', error);
    }
}

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
    db.SLUGS = ['proof-moonbirds', 'mutant-ape-yacht-club', 'otherdeed'] //4test: ~300, ~900, ~3k ids

    for(const slug of db.SLUGS){
        console.log('\nGETTING SLUG: ', slug)

        console.time('getBlurSales')
        const [tknIds, nftAddr] = await getBlurSales(slug);
        console.timeEnd('getBlurSales')

        console.time('getOsBidsViaApi')
        await getOsBidsViaApi(nftAddr, tknIds);
        console.timeEnd('getOsBidsViaApi')

        console.time('getOsBidsViaPuppeteer')
        await getOsBidsViaPuppeteer();
        console.timeEnd('getOsBidsViaPuppeteer')
    }
})();