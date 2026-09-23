import { z } from 'zod';
import raw from '../../reel.config.json';

/**
 * Per-channel settings from `reel.config.json`. The only thing a channel owns;
 * the look (tokens, fonts, chrome) is fixed for every reel in the series.
 */
const ChannelSchema = z.object({
  handle: z.string().startsWith('@'),
});

const parsed = ChannelSchema.safeParse(raw);
if (!parsed.success) {
  throw new Error(
    'reel.config.json is invalid:\n' +
      parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'),
  );
}

export const CHANNEL = parsed.data;
