# Logo-inspired sticker artwork

Individual transparent illustrations created with built-in image_gen using the user's selected giraffe sprite as the style reference. Production images are the WebP files in this directory. `manifest.js` is the authoritative list of installed sticker assets; `progress.json` lists finished and remaining illustrated objects. The game catalog now includes 209 playable objects, including an expanded pop-culture category. Twenty-two pop-culture entries currently have matching sticker art; entries rejected by the image safety filter retain their emoji fallback. The larger dormant catalog contains additional objects outside that round pool.

Prompts for the first six sprites are in `prompts.json`; the subsequent object prompts are in `batch-prompts.json`. Later people prompts additionally request a straight standing pose, relaxed arms, and no props or hat. The Hollywood prompt was corrected to request a single freestanding H, because the comparison measures letter height.

Generated pixels are resized within 640 × 640 (the original six within 768 × 768), encoded as WebP with alpha preserved, and never stretched independently in width and height. `bounds` records each visible object's source rectangle (alpha >= 128), excluding transparent padding from its measurement. Optional `measurementFraction` aligns shoulder, roof, or head measurements within the new illustration without changing the stored real-world height. See `scripts/pack-artwork.cjs` for the conversion workflow (requires sharp).

The loader downloads up to four images at a time and prioritizes the current and next round. Missing or invalid images retain the existing art. An image finishing during a play phase activates at the next round boundary so the silhouette cannot change during a guess. The same sprite renderer supplies regular artwork and guess ghosts.

Validation: `node --test how-big/tests/*.test.cjs`. Asset bounds, transparency, contact sheets, and sample comparisons through the actual canvas renderer were checked. A live multi-device playtest was not performed for this artwork update.
