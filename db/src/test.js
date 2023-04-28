const _setNewPage = async () => {
  var url = (asset_contract_address, token_ids) => {
    return `https://api.opensea.io/v2/orders/ethereum/seaport/offers?asset_contract_address=${asset_contract_address}${token_ids}&order_by=eth_price&order_direction=desc`;
  };

  const urlString = url(collectionAddr, id);
  const params = new URLSearchParams(urlString.split('?')[1]);
  const assetAddress = params.get('asset_contract_address');
  const tokenIds = params.get('token_ids');

  console.log('asset_contract_address:', assetAddress);
  console.log('token_ids:', tokenIds);
};

(async () => {
  const collectionAddr = '0x495f947276749ce646f68ac8c248420045cb7b5e';
  const id = [1,2];
  await _setNewPage(collectionAddr, id);
})();
