import { groupChatId, bot } from './private/private.js';
import { startCommand } from './commands/startCommand.js';
import { connectButton } from './buttons/connectButton.js';
import { claimButton } from './storeMap/claimButton.js';
import { settingWithdrawAddress } from './commands/settingWithdrawAddress.js';
import { handleWalletActions, mywalletsButton } from './buttons/mywalletsButton.js';
import { confirmDeleteAllWallets, askDeleteAllWalletsConfirmation } from './buttons/deleteAllWalletsButton.js';
import { menuButton } from './buttons/menuButton.js';
import { viewchangeWithdrawButton } from './buttons/viewchangeWithdrawButton.js';
import { settingsCommand } from './commands/settingsCommand.js';
import { settingsButton } from './buttons/settingsButton.js';
import { checkWalletConnected } from './storeMap/checkWalletConnected.js';
import { statsCommand } from './commands/statsCommand.js';
import { burntokensButton } from './buttons/burntokensButton.js';
import { askBurnAllConfirmation, confirmBurnAllWallets } from './buttons/askBurnConfirmation.js';
import { checkButton } from './storeMap/checkButton.js';
import { mywalletsRefreshConnectButton } from './miniButtons/mywalletsRefreshConnectButton.js';

import { infoCommand } from './commands/infoCommand.js';
import { checkCommand } from './storeMap/checkCommand.js';
import { referralButton } from './buttons/referralButton.js';
import { tutorialCommand } from './commands/tutorialCommand.js';
import { updateLeaderboardMessage } from './stats/updateLeaderboardMessage.js';
import { linkCommand } from './commands/linkCommand.js';
import { leadersClaimCommand } from './commands/leadersClaimCommand.js';
import { leadersRefCommand } from './commands/leadersRefCommand.js';
import { referralsCommand } from './commands/referralsCommand.js';
import pTimeout from './utils/pTimeout.js';
import { deleteMessages } from './utils/deleteMessages.js';
import { scheduleReminderChecks } from './utils/reminderScheduler.js';
import { helpCommand } from './commands/helpCommand.js';
import { testCommand } from './commands/testCommand.js';

// trading
import { fetchTokenDataCommand } from './trading/fetchTrade.js'; // Import fetch data command

import { getMessageId, saveMessageId} from './utils/redisUtils.js';
import { mywalletsButtonReply } from './miniButtons/mywalletsButtonReply.js';
import { checkAddressType } from './utils/checkAddressType.js';

import { positionsCommand } from './trading/position.js';

import { closeMessage } from './buttons/closeMessage.js';
import { generateWalletButton } from './buttons/generateWalletButton.js';

import { forwardMessagesToUsers } from './utils/forwardMessagesToUsers.js';
import { sendMessagesGifToUsers } from './utils/sendMessagesGifToUsers.js';

//
import { airdropCommand } from './commands/airdropCommand.js';
import { idCommand } from './commands/idCommand.js';
import { priceCoinCommand } from './priceCrypto/priceCoinCommand.js';
import { fetchAllCryptoData } from './priceCrypto/getCryptoData.js';
import { fetchAndSaveMarkets } from './priceCrypto/getExchangeData.js';

import { forwardCommand } from './commands/forwardCommand.js';
import { forwardCopyCommand } from './commands/forwardCopyCommand.js';
import { deleteMessageCommand } from './commands/deleteMessageChannel.js';
import { editMessageCommand } from './commands/editMessageChannel.js';

console.log(`${new Date().toLocaleTimeString()} - Bot is running ...`);


// Middleware to check chat type and ID
const privateOrGroupCheckMiddleware = (ctx, next) => {
    if (((ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') && ctx.chat.id.toString() === groupChatId) || ctx.chat.type === 'private') {
        return next();
    }
};

const privateChatOnlyMiddleware = (ctx, next) => {
    if (ctx.chat.type === 'private') {
        return next();
    }
};

const authorizedUserIds = [387171760, 7046463711, 7142144875];

// Middleware to check if the user is authorized
const checkAuthorization = (ctx, next) => {
  if (!authorizedUserIds.includes(ctx.from.id)) {
    // ctx.reply('You are not authorized to use this command.');
    return;
  }
  return next();
};

bot.command('updateCryptoData', checkAuthorization, async (ctx) => {
    try {
        await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
        fetchAllCryptoData(ctx);
    } catch (error) {
        console.error('Error in /updateCryptoData command:', error.message);
    }
});
bot.command('updateExchangeData', checkAuthorization, async (ctx) => {
    try {
        await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
        fetchAndSaveMarkets(ctx);
    } catch (error) {
        console.error('Error in /updateExchangeData command:', error.message);
    }
});

// Register commands
bot.command(['forward', 'Forward'], checkAuthorization, async (ctx) => {
    try {
        await forwardCommand(ctx);
    } catch (error) {
        console.error('Error in /forward command:', error.message);
    }
});
bot.command(['copy', 'Copy'], checkAuthorization, async (ctx) => {
    try {
        await forwardCopyCommand(ctx);
    } catch (error) {
        console.error('Error in /forwardCopyCommand command:', error.message);
    }
});

bot.command(['delete', 'Delete'], checkAuthorization, async (ctx) => {
    try {
        await deleteMessageCommand(ctx);
    } catch (error) {
        console.error('Error in /delete command:', error.message);
    }
});
bot.command(['edit', 'Edit'], checkAuthorization, async (ctx) => {
    try {
        await editMessageCommand(ctx);
    } catch (error) {
        console.error('Error in /edit command:', error.message);
    }
});

//
bot.command('start', privateChatOnlyMiddleware, async (ctx) => {
    try {
        await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
        await startCommand(ctx);
    } catch (error) {
        console.error('Error in /start command:', error.message);
    }
});
// test
bot.command('test', privateChatOnlyMiddleware, async (ctx) => {
    try {
        await testCommand(ctx);
    } catch (error) {
        console.error('Error in /test command:', error.message);
    }
});
//
bot.command('menu', privateChatOnlyMiddleware, async (ctx) => {
    try {
        await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
        await menuButton(ctx);
    } catch (error) {
        console.error('Error in /menu command:', error.message);
    }
});

bot.command('wallets', privateChatOnlyMiddleware, async (ctx) => {
    try {
        await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
        await mywalletsButton(ctx);
    } catch (error) {
        console.error('Error in /wallets command:', error.message);
    }
});

bot.command('settings', privateChatOnlyMiddleware, async (ctx) => {
    try {
        await settingsCommand(ctx);
    } catch (error) {
        console.error('Error in /settings command:', error.message);
    }
});

bot.command('stats', privateOrGroupCheckMiddleware, async (ctx) => {
    try {
        await statsCommand(ctx);
    } catch (error) {
        console.error('Error in /stats command:', error.message);
    }
});

bot.command(['check', 'Check'], privateChatOnlyMiddleware, async (ctx) => {
    try {
        await checkCommand(ctx);
    } catch (error) {
        console.error('Error in /check command:', error.message);
    }
});

bot.command('info', privateOrGroupCheckMiddleware, async (ctx) => {
    try {
        await infoCommand(ctx);
    } catch (error) {
        console.error('Error in /info command:', error.message);
    }
});

bot.command('tutorial', privateOrGroupCheckMiddleware, async (ctx) => {
    try {
        await tutorialCommand(ctx);
    } catch (error) {
        console.error('Error in /tutorial command:', error.message);
    }
});

bot.command('link', privateOrGroupCheckMiddleware, async (ctx) => {
    try {
        await linkCommand(ctx);
    } catch (error) {
        console.error('Error in /link command:', error.message);
    }
});

bot.command('claims', privateOrGroupCheckMiddleware, async (ctx) => {
    try {
        await leadersClaimCommand(ctx);
    } catch (error) {
        console.error('Error in /claims command:', error.message);
    }
});

bot.command('leaders', privateOrGroupCheckMiddleware, async (ctx) => {
    try {
        await leadersRefCommand(ctx);
    } catch (error) {
        console.error('Error in /leaders command:', error.message);
    }
});

bot.command('referrals', privateOrGroupCheckMiddleware, async (ctx) => {
    try {
        await referralsCommand(ctx);
    } catch (error) {
        console.error('Error in /referrals command:', error.message);
    }
});

bot.command('help', privateChatOnlyMiddleware, async (ctx) => {
    try {
        await helpCommand(ctx);
    } catch (error) {
        console.error('Error in /help command:', error.message);
    }
});
bot.command(['token', 'Token'], privateChatOnlyMiddleware, async (ctx) => {
    try {
        await fetchTokenDataCommand(ctx);
    } catch (error) {
        console.error('Error in /token command:', error.message);
    }
});
bot.command(['positions', 'Positions'], privateChatOnlyMiddleware, async (ctx) => {
    try {
        await positionsCommand(ctx);
    } catch (error) {
        console.error('Error in positions command:', error.message);
    }
});
bot.command('airdrop', privateChatOnlyMiddleware, async (ctx) => {
    try {
        await airdropCommand(ctx);
    } catch (error) {
        console.error('Error in /airdrop command:', error.message);
    }
});
bot.command(['id', 'Id', 'ID'],async (ctx) => {
    try {
        await idCommand(ctx);
    } catch (error) {
        console.error('Error in /id command:', error.message);
    }
});

bot.command(['price', 'Price', 'PRICE', 'p', 'P'],async (ctx) => {
    try {
        await priceCoinCommand(ctx);
    } catch (error) {
        console.error('Error in /price command:', error.message);
    }
});
//

const nonBlockingHandler = async (ctx, next) => {
    next().catch((error) => {
        console.error('[Error]', error);
    });
};
bot.use(nonBlockingHandler);

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Handle message replies
bot.on('message', async (ctx, next) => {
    try {
        const message = ctx.message;
        if (!message || !message.text) {
            await next();
            return;
        }

        const messageText = message.text;
        const replyMessage = message.reply_to_message;

        if (replyMessage && ctx.chat.type === 'private') {
            const replyText = replyMessage.text;

            if (replyText && replyText.includes('Paste up to 20 private keys')) {
                const editMessageConnectId = await getMessageId(ctx.from.id, 'connect');
                await connectButton(ctx, editMessageConnectId);
            } else if (replyText && replyText.includes('Reply with your withdrawal address:')) {
                await settingWithdrawAddress(ctx);
            } else if (replyText && replyText.includes('Paste up to 20 wallet addresses, each on a single line to check (not private keys):')) {
                await checkButton(ctx);      
            } else {
                await next();
            }
        } else if (messageText && SOLANA_ADDRESS_REGEX.test(messageText)) {
            const addressType = await pTimeout(checkAddressType(messageText), 20000);
            if (addressType === 'Wallet Address' || addressType === 'Invalid Address' || addressType === 'Error') {
                ctx.message.text = `/check ${messageText}`;
                await checkCommand(ctx);
            }
        } else if (messageText.startsWith('p ') || messageText.startsWith('P ') || messageText.startsWith('!')) {
            let symbol;
        
            if (messageText.startsWith('p ') || messageText.startsWith('P ')) {
                const parts = messageText.split(' ');
                if (parts.length === 2) { // Ensure only one word after "p"
                    symbol = parts[1];
                }
            } else if (messageText.startsWith('!')) {
                const parts = messageText.split(' ');
                if (parts.length === 1) { // Ensure no extra words after "!"
                    symbol = messageText.substring(1).trim();
                }
            }
        
            if (!symbol) {
                return; // Exit if no valid symbol is found
            }
        
            ctx.message.text = `/price ${symbol}`;
            await priceCoinCommand(ctx);
        
        } else {
            await next();
        }
    } catch (error) {
        console.error('Error handling message:', error.message);
    }
});

// Handle actions
bot.action('viewchange', async (ctx) => {
    try {
        await viewchangeWithdrawButton(ctx);
    } catch (error) {
        console.error('Error handling viewchange action:', error.message);
    }
});

bot.action('menu', async (ctx) => {
    try {
        await menuButton(ctx);
    } catch (error) {
        console.error('Error handling menu action:', error.message);
    }
});
bot.action('menuReply', async (ctx) => {
    try {
        const deleteMessageId = ctx.callbackQuery.message.message_id;
        await menuButton(ctx, deleteMessageId);
    } catch (error) {
        console.error('Error handling menuReply action:', error.message);
    }
});

bot.action('refreshConnect', async (ctx) => {
    try {
        await mywalletsRefreshConnectButton(ctx);
    } catch (error) {
        console.error('Error handling refreshConnect action:', error.message);
    }
});

bot.action('burntokensButton', async (ctx) => {
    try {
        await burntokensButton(ctx);
    } catch (error) {
        console.error('Error handling burntokensButton action:', error.message);
    }
});

bot.action('checkWalletConnected', async (ctx) => {
    try {
        await checkWalletConnected(ctx);
    } catch (error) {
        console.error('Error handling checkWalletConnected action:', error.message);
    }
});

bot.action('settings', async (ctx) => {
    try {
        await settingsButton(ctx);
    } catch (error) {
        console.error('Error handling settings action:', error.message);
    }
});

bot.action('mywallets', async (ctx) => {
    try {
        await mywalletsButton(ctx);
    } catch (error) {
        console.error('Error handling mywallets action:', error.message);
    }
});

bot.action(/^(wallet|delete|confirmdelete|checkSingleWallet|claim|burn|confirmBurn)_.+$/, async (ctx) => {
    try {
        await handleWalletActions(ctx);
    } catch (error) {
        console.error('Error handling wallet action:', error.message);
    }
});

bot.action('burn', async (ctx) => {
    try {
        await askBurnAllConfirmation(ctx);
    } catch (error) {
        console.error('Error handling burn action:', error.message);
    }
});

bot.action(/confirmBurnAll_(yes|no)/, async (ctx) => {
    try {
        await confirmBurnAllWallets(ctx);
    } catch (error) {
        console.error('Error handling confirmBurnAll action:', error.message);
    }
});

bot.action('deleteAllWallets', async (ctx) => {
    try {
        await askDeleteAllWalletsConfirmation(ctx);
    } catch (error) {
        console.error('Error handling deleteAllWallets action:', error.message);
    }
});

bot.action(/confirmDeleteAllWallets_(yes|no)/, async (ctx) => {
    try {
        await confirmDeleteAllWallets(ctx);
    } catch (error) {
        console.error('Error handling confirmDeleteAllWallets action:', error.message);
    }
});

bot.action('connect', async (ctx) => {
    try {
        const editMessageConnectId = ctx.callbackQuery.message.message_id;
        await saveMessageId(ctx.from.id, editMessageConnectId, 'connect');
        await ctx.reply('Paste up to 20 private keys [*\\(read here about why private keys are needed\\)*](https://t.me/SolClaimPortal/162)\\, each on a single line to connect them\\. For your security you can make sure they are empty\\, and all SOL claimed will be sent to your withdrawal address set in your \\/settings:\n\n\\*_Don’t want to claim in telegram and provide your key\\? Claim your SOL on the web app with phantom: [app\\.solclaim\\.io](https://t.me/SolClaimPortal/276)_', {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                force_reply: true,
            },
            disable_web_page_preview: true
        });
    } catch (error) {
        console.error('Error handling connect action:', error.message);
    }
});

bot.action('check', async (ctx) => {
    try {
        const originalMessageId = ctx.callbackQuery.message.message_id;
        const replyPromise = pTimeout(ctx.reply('Paste up to 20 wallet addresses, each on a single line to check (not private keys):', {
            reply_markup: {
                force_reply: true,
            },
        }), 10000);
        const deleteMessagesPromise = deleteMessages(ctx, [originalMessageId]);
        await Promise.all([replyPromise, deleteMessagesPromise]);

    } catch (error) {
        console.error('Error handling check action:', error.message);
    }
});

bot.action('claim', async (ctx) => {
    try {
        await claimButton(ctx);
    } catch (error) {
        console.error('Error handling claim action:', error.message);
    }
});

bot.action('settingWithdrawAddress', async (ctx) => {
    try {
        const originalMessageId = ctx.callbackQuery.message.message_id;

        const replyPromise = pTimeout(ctx.reply('⚙️ Reply with your withdrawal address:', {
            reply_markup: {
                force_reply: true,
            },
        }), 10000);

        const deleteMessagesPromise = deleteMessages(ctx, [originalMessageId]);

        await Promise.all([replyPromise, deleteMessagesPromise]);

    } catch (error) {
        console.error('Error handling settingWithdrawAddress action:', error.message);
    }
});

bot.action('referral', async (ctx) => {
    try {
        await referralButton(ctx);
    } catch (error) {
        console.error('Error handling referral action:', error.message);
    }
});

bot.action('generateWallet', async (ctx) => {
    try {
        await generateWalletButton(ctx);
    } catch (error) {
        console.error('Error handling generateWalletButton action:', error.message);
    }
});

// Trading
bot.action('positions', privateChatOnlyMiddleware, async (ctx) => {
    try {
        await positionsCommand(ctx);
    } catch (error) {
        console.error('Error in positions action :', error.message);
    }
});

bot.action('closeMessage', privateChatOnlyMiddleware, async (ctx) => {
    try {
        const messageId = ctx.callbackQuery.message.message_id;
        await closeMessage(ctx, messageId);
    } catch (error) {
        console.error('Error handling closeMessage action:', error.message);
    }
});

bot.action('mywalletsReply', privateChatOnlyMiddleware, async (ctx) => {
    try {
        await mywalletsButtonReply(ctx);
    } catch (error) {
        console.error('Error handling mywallets reply action:', error.message);
    }
});

// Function to schedule leaderboard updates
const scheduleLeaderboardUpdate = () => {
    const updateDelay = 1800000; // 30 minutes in milliseconds

    setTimeout(async () => {
        try {
            await updateLeaderboardMessage();
        } catch (error) {
            console.error('Error updating leaderboard message:', error.message);
        } finally {
            scheduleLeaderboardUpdate(); // Schedule the next update regardless of success or failure
        }
    }, updateDelay);
};

// Start the scheduling
scheduleLeaderboardUpdate();

// Start the scheduling for reminder checks
// scheduleReminderChecks(bot);

// forwardMessagesToUsers(bot);
// sendMessagesGifToUsers(bot);
// Launch bot
bot.launch();

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('SIGINT received. Exiting gracefully.');
    bot.stop('SIGINT');
    process.exit(0);
});
process.once('SIGTERM', () => {
    console.log('SIGTERM received. Exiting gracefully.');
    bot.stop('SIGTERM');
    process.exit(0);
});

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
