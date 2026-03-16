export const buyButtons = (mintAddressStr) => [
    [{ text: 'Buy 0.1 SOL', callback_data: `buy0_1sol:${mintAddressStr}` }, { text: 'Buy 0.25 SOL', callback_data: `buy0_25sol:${mintAddressStr}` }, { text: 'Buy 0.5 SOL', callback_data: `buy0_5sol:${mintAddressStr}` }],
    [{ text: 'Buy 1 SOL', callback_data: `buy1sol:${mintAddressStr}` }, { text: 'Buy 3 SOL', callback_data: `buy3sol:${mintAddressStr}` }, { text: 'Buy X SOL', callback_data: `buyXsol:${mintAddressStr}` }],
    [{ text: '↻ Refresh', callback_data: `refreshBuy:${mintAddressStr}` }]
];

export const sellButtons = (mintAddressStr) => [
    [{ text: 'Sell 10%', callback_data: `sell10:${mintAddressStr}` }, { text: 'Sell 25%', callback_data: `sell25:${mintAddressStr}` }, { text: 'Sell 50%', callback_data: `sell50:${mintAddressStr}` }],
    [{ text: 'Sell 75%', callback_data: `sell75:${mintAddressStr}` }, { text: 'Sell 100%', callback_data: `sell100:${mintAddressStr}` }, { text: 'Sell X Token', callback_data: `sellXtoken:${mintAddressStr}` }],
    [{ text: '↻ Refresh', callback_data: `refreshSell:${mintAddressStr}` }]
];