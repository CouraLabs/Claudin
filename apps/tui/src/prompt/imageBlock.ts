const IMAGE_MEDIA_TYPES = ["image/gif", "image/jpeg", "image/png", "image/webp"] as const;

export type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

export type ImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: ImageMediaType; data: string };
};

export const readImageMediaType = (mediaType: string | undefined): ImageMediaType | undefined =>
  IMAGE_MEDIA_TYPES.find((known) => known === mediaType);

export const buildImageBlock = (mediaType: ImageMediaType, bytes: Uint8Array): ImageBlock => ({
  type: "image",
  source: { type: "base64", media_type: mediaType, data: Buffer.from(bytes).toString("base64") },
});
