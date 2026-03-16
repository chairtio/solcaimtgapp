const CHANNEL_USERNAME = '@SolClaimTrending';

export const deleteMessageCommand = async (ctx) => {
  try {
    // Extract the message ID from the command argument
    const messageId = ctx.message.text.split(' ')[1]; // Assuming the command is /delete <message_id>

    if (!messageId) {
      return await ctx.reply('Please provide a message ID to delete.', {
        reply_to_message_id: ctx.message.message_id
    });
    }

    // Delete the message from the channel
    await ctx.telegram.deleteMessage(CHANNEL_USERNAME, messageId);

    await ctx.reply('Message deleted from the channel!', {
        reply_to_message_id: ctx.message.message_id
    })
  } catch (error) {
    console.error('Error deleting message:', error.message);

    // Handle specific error for message not found
    if (error.message.includes('message to delete not found')) {
      await ctx.reply('Message not found. Please check the message ID.', {
        reply_to_message_id: ctx.message.message_id
      });
    } else {
      // General error handling
      await ctx.reply(`Failed to delete message: ${error.message}`, {
        reply_to_message_id: ctx.message.message_id
      });
    }
  }
};
