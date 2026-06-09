import { Router } from 'express';

const router = Router();

const keywordEmojiMap: Record<string, string[]> = {
  love: ['💕', '❤️', '😍', '🥰', '💖', '💘', '💝'],
  beautiful: ['✨', '🤩', '😍', '💖', '🌸', '🌟', '🌷'],
  gorgeous: ['✨', '🤩', '😍', '💖', '🌸', '🌟', '🌷'],
  amazing: ['✨', '🤩', '🤯', '🙌', '🌟', '🔥', '👏'],
  wow: ['🤩', '🤯', '✨', '🔥', '🌟', '😱', '👏'],
  gift: ['🎁', '💝', '🎀', '🎉', '🛍️', '🎊', '✨'],
  present: ['🎁', '💝', '🎀', '🎉', '🛍️', '🎊', '✨'],
  birthday: ['🎂', '🎉', '🎁', '🥳', '🎈', '🎊', '🍰'],
  bday: ['🎂', '🎉', '🎁', '🥳', '🎈', '🎊', '🍰'],
  celebration: ['🎉', '🎊', '🍾', '🥂', '🥳', '🙌', '✨'],
  congrats: ['🎉', '🎊', '🍾', '🥂', '🥳', '🙌', '👏'],
  anniversary: ['💍', '🥂', '💑', '❤️', '🌹', '🎉', '✨'],
  thanks: ['🙏', '🥰', '❤️', '💕', '💐', '🙌', '😊'],
  thank: ['🙏', '🥰', '❤️', '💕', '💐', '🙌', '😊'],
  appreciate: ['🙏', '🥰', '❤️', '💕', '💐', '🙌', '😊'],
  cute: ['🥺', '🥰', '🧸', '🐰', '💕', '😍', '🌸'],
  sweet: ['🥺', '🥰', '🍬', '💕', '😍', '🍭', '💖'],
  perfect: ['💯', '👌', '✨', '🤩', '🎯', '❤️', '🌟'],
  art: ['🎨', '✨', '🖼️', '👩‍🎨', '🖌️', '🔥', '🌟'],
  craft: ['🧵', '🧶', '✂️', '🎨', '✨', '🙌', '🔨'],
  handmade: ['🤲', '✨', '🧶', '🧵', '🙌', '❤️', '🎨']
};

const defaultEmojis = ['🎁', '✨', '❤️', '🥰', '🎉', '🔥'];

router.post('/emoji-suggestions', (req, res) => {
  const { partialText } = req.body;
  if (!partialText || typeof partialText !== 'string') {
    return res.json({ emojis: [] });
  }

  const words = partialText.toLowerCase().match(/\b\w+\b/g) || [];
  let suggestedEmojis: string[] = [];

  for (const word of words) {
    if (keywordEmojiMap[word]) {
      suggestedEmojis = suggestedEmojis.concat(keywordEmojiMap[word]);
    }
  }

  // Deduplicate and slice
  suggestedEmojis = [...new Set(suggestedEmojis)];

  // If no specific match, maybe return some defaults or empty. 
  // The prompt says "Return 6-8 relevant emojis based on partialText context."
  // If no match, we can return empty to hide the row, or fallback.
  // "This row appears only when the user is actively typing, and disappears when the input is empty."
  // It's usually better to return fallback gifting emojis if they are typing but we don't recognize the word.
  if (suggestedEmojis.length === 0 && partialText.trim().length > 0) {
    suggestedEmojis = defaultEmojis;
  }

  res.json({ emojis: suggestedEmojis.slice(0, 8) });
});

export default router;
