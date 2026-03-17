// commands/helpCommand.js
import { escapeMarkdownV2 } from "../utils/escapeMarkdownV2.js";

export const helpCommand = async (ctx) => {

    const responseText = `
/menu - view the SolClaim menu
/settings - set your withdrawal wallet
/referrals - view your referral link and earnings
/wallets - view your wallets
/tutorial - watch a tutorial
/info - learn how the technology works

🆘 *Still need help?*

Ask any questions here:
https://t.me/SolClaimChat/35010

⚠️ ***_Keep in mind we will never DM you first_* - if you get a DM it's likely a scam.**
    `;

    try {
        await ctx.reply(escapeMarkdownV2(responseText), {
            parse_mode: 'MarkdownV2',
            reply_to_message_id: ctx.message.message_id
        });
    } catch (error) {
        console.error('Error info Command:', error.message);
    }
};
