const CHANNEL_USERNAME = '@SolClaimTrending';

export const forwardCommand = async (ctx) => {
  try {
    // Ensure the /forward command is used as a reply to a message
    if (!ctx.message.reply_to_message) {
      return await ctx.reply('Please reply to a message to forward it.', {
        reply_to_message_id: ctx.message.message_id
      });
    }

    const repliedMessage = ctx.message.reply_to_message;

    // Forward the message to the channel
    await ctx.telegram.forwardMessage(
      CHANNEL_USERNAME,               // Target channel ID or username
      repliedMessage.chat.id,         // Source group ID
      repliedMessage.message_id        // Message ID to forward
    );

    await ctx.reply('Message forwarded to the channel!', {
        reply_to_message_id: ctx.message.message_id
    });
  } catch (error) {
    console.error('Error forwardCommand:', error.message);
    
    // Check if the error message does not include MESSAGE_ID_INVALID
    if (!error.message.includes('MESSAGE_ID_INVALID')) {
      await ctx.reply(`Failed to forward message: ${error.message}`, {
        reply_to_message_id: ctx.message.message_id
      });
    } else {
      // Specific handling for MESSAGE_ID_INVALID
      await ctx.reply('Unable to forward bot messages. Please reply to a user message instead.', {
        reply_to_message_id: ctx.message.message_id
      });
    }
  }
};
