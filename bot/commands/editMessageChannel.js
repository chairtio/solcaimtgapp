const CHANNEL_USERNAME = '@SolClaimTrending';

export const editMessageCommand = async (ctx) => {
  try {
    // Ensure the /edit command is used as a reply to a message
    if (!ctx.message.reply_to_message) {
      return await ctx.reply('Please reply to a message you want to use for editing.', {
        reply_to_message_id: ctx.message.message_id
    });
    }

    // Extract the message ID from the command argument
    const messageId = ctx.message.text.split(' ')[1]; // Assuming the command is /edit <message_id>

    if (!messageId) {
      return ctx.reply('Please provide a message ID to edit.', {
        reply_to_message_id: ctx.message.message_id
    });
    }

    const newMessageContent = ctx.message.reply_to_message.text; // The new content from the replied message

    // Edit the message in the channel
    await ctx.telegram.editMessageText(
      CHANNEL_USERNAME, // Target channel ID or username
      messageId,        // Message ID to edit
      null,             // Inline message ID (null if not editing a message sent by the bot)
      newMessageContent // New content for the message
    );

    ctx.reply('Message edited in the channel!', {
      reply_to_message_id: ctx.message.message_id
  });
  } catch (error) {
    console.error('Error editMessageCommand:', error.message);

    // Handle specific error for message not found
    if (error.message.includes('message to edit not found')) {
      await ctx.reply('Message not found. Please check the message ID.', {
        reply_to_message_id: ctx.message.message_id
      });
    } else {
      // General error handling
      await ctx.reply(`Failed to edit message: ${error.message}`, {
        reply_to_message_id: ctx.message.message_id
      });
    }
  }
};
