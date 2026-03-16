export const escapeMarkdownV2 = (text) => {
    if (typeof text !== 'string') {
      return text;
    }
    return text.replace(/[[\]()~>#+\-=|{}.!]/g, '\\$&');
  };

export const abbreviateUserId = (userId) => {
  const strId = String(userId);
  if (strId.length <= 6) {
      return strId;
  }
  return `${strId.slice(0, 3)}...${strId.slice(-3)}`;
};
