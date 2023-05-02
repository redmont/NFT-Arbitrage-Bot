# NFT MEV :robot:

...to extract it, starting with ar₿$.

## To-do :clipboard:

- [x] `getNfts`
  - [x] getBlurSlugs
  - [x] getBlurSales & save to `SALES`
    - [ ] only if !duplicate
  - [x] getOsBids & save to `BIDS`
    - [ ] only if !duplicate
- [ ] `bot` (recheck)
  - [ ] Listen to subOrders
  - [ ] If new bid, check `SALES`
  - [ ] If new sale, check `BIDS`
  - [ ] Connect to the exec arb
- [ ] `subOrders`
  - [ ] Get `BLUR_SALES`
    - [x] If `SALE` `contractAddress` exists in db, add to db.
    - [ ] If `SALE` `contractAddress` does not exist in db:
      - [x] Add to db
      - [ ] Get corresponding `OS_BIDS` via API & save to db `BIDS`
  - [ ] Get `OS_BIDS` (via stream)
    - [ ] If `contractAddress` exists in `SALES` (collected during `getNfts` || `subOrders`), add to `BIDS`
    - (Current implementation adds all bids)
- [ ] Consider: price & addr formatting for db
- [ ] Consider: `subOrders` Blur Sales does not add traits
- [ ] Consider: getOsBids via puppeteer for speed
- [ ] Setup db on `vps0`
  - [ ] Allow transferring data for `vps1` via SSH
- [ ] Cleaner
  - [ ] Remove expired data from db

## Project Diagram 🔧

![Project Diagram](https://i.gyazo.com/791201f3bd138f3ee8ffb15d9c177451.png)

📁 [Google Drive](https://drive.google.com/file/d/1Ks5DKz6f9DdRpffOGzYu5gjKxD21WbCk/view?usp=sharing)

🚀 [App](https://app.diagrams.net/#G1Ks5DKz6f9DdRpffOGzYu5gjKxD21WbCk)

## To-do DB Initialization :floppy_disk:

### 0. getNfts (create DB base)
   - get Blur SLUG
   - get Blur SALE
   - get OS   BID

### 1. subOrders (collect most recent)
   - Blur SALE
     - if tknId !in DB, call for OS BID <b>(not spam, cuz step 0)</b>
   - OS   BID
     - add to DB if: <b>"tknId in Blur SALE && price>minPrice"</b>

### 2. getNfts (get missed during getNfts)
   - get Blur SLUG
   - get Blur SALE (add only if missed)
   - get OS   BID (add only if missed)


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