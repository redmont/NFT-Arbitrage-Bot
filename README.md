# NFT MEV :robot:

...to extract it, starting with ar₿$.

## To-do :clipboard:

- [x] getNfts
-   [x] get collections on BLUR
-   [x] forEachId get BLUR_SALE & save to "SALES"
-   [x] forEachIdSale get OS_BID & save to "BIDS"
- [ ] bot
-   [x] listen to subOrders
-   [x] if new BID, check "SALES"
-   [x] if new SALE, check "BIDS"
-   [ ] connect to the exec arb
- [ ] subOrders
-   [ ] get Blur "SALES"
-     [x] if "SALE" contractAddress exists in db, add to db.
-     [ ] if "SALE" contractAddress !exist in db:
-       [x] add to db
-       [ ] get OS corresponding "BIDS" via API & save to db "BIDS"
-   [ ] get OS "BIDS" (via stream)
-     [ ] if addr exists in "SALE" (collected during getNfts and subOrders), add to "BIDS"
-     (current implementation adds all bids)
- [ ] Setup db on vps0
-   [ ] allow transferring data for vps1 via ssh
- [ ] cleaner
-   [ ] remove expired from db

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