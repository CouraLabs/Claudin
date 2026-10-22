import { z } from "zod";

export const BACKGROUND_CHANNELS = ["r", "g", "b", "a"] as const;

export type BackgroundChannel = (typeof BACKGROUND_CHANNELS)[number];

export const CHANNEL_MAX = 255;

const channelSchema = z.number().int().min(0).max(CHANNEL_MAX);

export const backgroundColorSchema = z.object({
  r: channelSchema,
  g: channelSchema,
  b: channelSchema,
  a: channelSchema,
});

export type BackgroundColor = z.infer<typeof backgroundColorSchema>;

export const TRANSPARENT_BACKGROUND: BackgroundColor = { r: 0, g: 0, b: 0, a: 0 };
