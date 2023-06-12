# NFT MEV :robot:

...to extract it, starting with ar₿$.

## To-do :clipboard:

- [x] `subSalesBlur` (get & save to `SALES` & `SUBS`)
- [x] `getSalesBlur` (get & save to `SALES` & `SUBS`)
- [x] `subBidsOs`
- [x] `getBidsOs`
- [ ] VPS new db setup
- [ ] remove expired from BIDS (updater.js)
- [ ] create a whitelist for getBuyBlurData
- [ ] create a whitelist for conduict
- [ ] check 'ITEM_METADATA_UPDATED = "item_metadata_updated",' and how it affects traits arbs
- [ ] add info about last synced SALES & BIDS (perhaps in these collections) to know when to start catching up
- [ ] add support for non-weth payment bids (usually usdc) in getBidsOs & subBidsOs

## OLD Project Diagram 🔧

![Project Diagram](https://i.gyazo.com/791201f3bd138f3ee8ffb15d9c177451.png)

📁 [Google Drive](https://drive.google.com/file/d/1Ks5DKz6f9DdRpffOGzYu5gjKxD21WbCk/view?usp=sharing)

🚀 [App](https://app.diagrams.net/#G1Ks5DKz6f9DdRpffOGzYu5gjKxD21WbCk)

## To-do DB Initialization :floppy_disk:

- [ ] 1. `getSubsBlur` (local, 1-time, then...)
- [ ] 2. `getSalesBlur` (local, 1-time, then...)
- [ ] 3.0. `subSalesBlur` (VPS, set sync for ~1 day to catch missed SALES + SUBS & start listen recent)
- [ ] 3.1. `subBidsOs` (VPS, run for 1h+ (cuz +90% of bids are last hour), then...)
- [ ] 4. `getBidsOs` (VPS, set sync range from-to, run (~3h))

## Commands :

1st terminal inside bot-nft/api-blur:

```
yarn rebuild && node .
```

2nd terminal, run Mongo (with stream support):

```
sudo mongod --port 27017 --dbpath /var/lib/mongodb --replSet rs0 --bind_ip localhost
```

3rd terminal, Mongodb UI:

```
robo3t
```

View log with updates.

```
cat logs/getBidsOs.log && tail -f logs/getBidsOs.log
```

#### DB VPS commands:

Enter mongo terminal

```
mongosh
```

Connect to DB

```
use BOT_NFT
```

Print each collection name, count and size:

```
db.getCollectionNames().forEach(function(collName) {
    var coll = db.getCollection(collName);
    var stats = coll.stats();
    var count = coll.count();
    var sizeInMB = stats.size / (1024 * 1024);
    print(collName + " (" + count + " elements): " + sizeInMB.toFixed(2) + " MB");
});
```

Transfer mongo collection to VPS

```
scp -i "nft_bot.pem" /home/xter/mongo-collections/BOT_NFT/SALES_LOCAL.bson ubuntu@ec2-35-170-79-201.compute-1.amazonaws.com:db-from-local
```

DB VPS bashrc aliases:

```
alias logGetBid="cat ~/logs/getBidsOs.log && tail -f ~/logs/getBidsOs.log"
alias logSubBid="cat ~/logs/subBidsOs.log && tail -f ~/logs/subBidsOs.log"
alias logSubSale="cat ~/logs/subSalesBlur.log && tail -f ~/logs/subSalesBlur.log"
alias logApiBlur="cat ~/logs/apiBlur.log && tail -f ~/logs/apiBlur.log"

alias logGetBidErr="cat ~/logs/getBidsOsErr.log && tail -f ~/logs/getBidsOsErr.log"
alias logSubBidErr="cat ~/logs/subBidsOsErr.log && tail -f ~/logs/subBidsOsErr.log"
alias logSubSaleErr="cat ~/logs/subSalesBlurErr.log && tail -f ~/logs/subSalesBlurErr.log"
alias logApiBlurErr="cat ~/logs/apiBlurErr.log && tail -f ~/logs/logApiBlurErr.log"

alias logGetBidClear="sudo truncate -s 0 ~/logs/getBidsOs.log"
alias logSubBidClear="sudo truncate -s 0 ~/logs/subBidsOs.log"
alias logSubSaleClear="sudo truncate -s 0 ~/logs/subSalesBlur.log"
alias logApiBlurClear="sudo truncate -s 0 ~/logs/apiBlur.log"

alias logGetBidErrClear="sudo truncate -s 0 ~/logs/getBidsOsErr.log"
alias logSubBidErrClear="sudo truncate -s 0 ~/logs/subBidsOsErr.log"
alias logSubSaleErrClear="sudo truncate -s 0 ~/logs/subSalesBlurErr.log"
alias logApiBlurErrClear="sudo truncate -s 0 ~/logs/logApiBlurErr.log"
```

BOT VPS bashrc aliases:

```
alias logBot="cat ~/logs/bot.log && tail -f ~/logs/bot.log"
alias logApiBlur="cat ~/logs/apiBlur.log && tail -f ~/logs/apiBlur.log"

alias logBotErr="cat ~/logs/botErrors.log && tail -f ~/logs/botErrors.log"
alias logApiBlurErr="cat ~/logs/apiBlurErrors.log && tail -f ~/logs/apiBlurErrors.log"

alias logBotClear="sudo truncate -s 0 ~/logs/bot.log"
alias logBotErrClear="sudo truncate -s 0 ~/logs/botErrors.log"

alias logApiBlurErrClear="sudo truncate -s 0 ~/logs/apiBlur.log"
alias logApiBlurErrClear="sudo truncate -s 0 ~/logs/apiBlurErrors.log"
```

## Git Commit Types :construction_worker:

- :sparkles: `feat`: A new feature
- :bug: `fix`: A bug fix
- :books: `docs`: Documentation changes
- :art: `style`: Changes that do not affect the meaning of the code (e.g. formatting, missing semi-colons, etc.)
- :recycle: `refactor`: Code changes that neither fix a bug nor add a feature
- :arrow_up: `chore`: Changes to the build process, dependencies, or other non-code related changes
- :white_check_mark: `test`: Adding or modifying tests
- :globe_with_meridians: `i18n`: Internationalization/localization changes
- :construction: `WIP`: Work in progress (not intended for the final release)
- :x: `revert`: Reverting a previous commit

Let's go! :muscle:
