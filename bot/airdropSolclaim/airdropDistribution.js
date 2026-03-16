import { sendTokenAirdrop } from './sendTokenAirdrop.js';
import { urlNeedProcessing, urlSolclaimAirdrop } from './solclaimInfo.js';
import { readProcessedRequests, updateProcessedRequestWithRetry } from './requestTracker.js';
import { sendMessageToAirdropsTopic } from './sendMessageAirdropToTopic.js';
import { abbreviateUserId } from '../utils/escapeMarkdownV2.js';
import { fetchData } from '../utils/fetchData.js';
import { generateClaimedAirdrop } from './generateClaimedAirdrop.js';

// Function to fetch and process airdrop requests
export const airdropDistribution = async (bot) => {
    try {
        // Define query parameters
        const params = new URLSearchParams({
            count: 1,
            airdrop_id: 1
        });

        // Construct the URL with query parameters
        const urlWithParams = `${urlNeedProcessing}?${params.toString()}`;
        const response = await fetchData(urlWithParams, 'GET');
        if (!Array.isArray(response) || response.length === 0) {
            console.warn('No airdrop requests found.');
            return; // Early return if no requests found
        }

        const processedRequests = await readProcessedRequests();
        const unprocessedUsers = response.filter(request => !request.processed && !processedRequests[request.telegram_user_id]);

        if (unprocessedUsers.length > 0) {
            for (const user of unprocessedUsers) {
                const { request_id, airdrop_id, telegram_user_id, withdrawal_wallet, amount, username } = user;
                try {
                    await sendTokenAirdrop({ request_id, airdrop_id, telegram_user_id, withdrawal_wallet, amount, username, bot });
                } catch (error) {
                    console.error(`Failed to send tokens to User ID: ${telegram_user_id} aridrop distribution. Error: ${error.message}`);
                }
            }
        // } else {
            // console.log('All requests have been processed.');
        }

        // Retry API updates for processed requests
        for (const [telegram_user_id, processedData] of Object.entries(processedRequests)) {
            // console.log(`Checking processed data for User ID: ${telegram_user_id}`, processedData);
            
            // Ensure the necessary fields are present and the API update is still pending
            if (processedData && processedData.signature && processedData.amount && !processedData.apiUpdated) {
                const { signature, amount, airdrop_id, request_id } = processedData;
                const payload = {
                    airdrop_id,
                    airdrop_request_id: request_id,
                    txid: signature
                };

                try {
                    // console.log(`Retrying API update for User ID: ${telegram_user_id}`);
                    
                    // API call
                    const url = `${urlSolclaimAirdrop}/${telegram_user_id}/processed`;
                    await fetchData(url, 'PUT', payload);

                    await updateProcessedRequestWithRetry(telegram_user_id, signature, amount, true, airdrop_id, request_id);

                    const groupMessage = `🟢 ${amount} $SCLAIM sent to [${abbreviateUserId(telegram_user_id)}](tg://user?id=${telegram_user_id}) ([tx link 🔗](https://solscan.io/tx/${signature}))`;
                    const privateMessage = `🟢 Airdrop sent: ${amount} $SCLAIM\n💳 [Tx link](https://solscan.io/tx/${signature})`;
                    const claimedImage = await generateClaimedAirdrop(amount, 'solclaim.jpg');
                    await Promise.all([
                        sendMessageToAirdropsTopic(bot, groupMessage),
                        // bot.telegram.sendMessage(telegram_user_id, privateMessage, { parse_mode: 'Markdown' }),
                        bot.telegram.sendPhoto(
                            telegram_user_id,
                            { source: claimedImage },
                            {
                                caption: privateMessage,
                                parse_mode: 'Markdown',
                            }
                        )
                    ]);
                    console.log(`Successfully updated API for User ID: ${telegram_user_id}`);
                } catch (error) {
                    console.error(`Error retrying API update for User ID: ${telegram_user_id}. Error: ${error.message}`);
                }
            }
        }
    } catch (error) {
        console.error('Failed to fetch airdrop request:', error.message);
    }
};

