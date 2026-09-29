# Logo-inspired sticker artwork

Individual transparent illustrations created with built-in image_gen using the user's selected giraffe sprite as the style reference. Production images are the WebP files in this directory. `manifest.js` is the authoritative list of installed sticker assets; `progress.json` lists finished and remaining illustrated objects. The game catalog currently contains 370 distinct objects, including 22 Pop Culture entries. Objects that depended on emoji fallback were removed; the remaining emoji-marked entries use matching sprite or drawn artwork. Some catalog objects may not appear in every round pool.

Prompts for the first six sprites are in `prompts.json`; subsequent object and style-refresh prompts are in `batch-prompts.json`. Later people prompts additionally request a straight standing pose, relaxed arms, and no props or hat. The Hollywood prompt was corrected to request a single freestanding H, because the comparison measures letter height.

Generated pixels are resized within 640 × 640 (the original six within 768 × 768), encoded as WebP with alpha preserved, and never stretched independently in width and height. `bounds` records each visible object's source rectangle (alpha >= 128), excluding transparent padding. The game scales and measures the full cropped rectangle from its bottom to its top; no separate shoulder, roof, or head measurement fraction is used. See `scripts/pack-artwork.cjs` for the conversion workflow (requires sharp).

The loader downloads up to four images at a time and prioritizes the current and next round. Missing or invalid images retain the existing art. An image finishing during a play phase activates at the next round boundary so the silhouette cannot change during a guess. The same sprite renderer supplies regular artwork and guess ghosts.

Validation: `node --test how-big/tests/*.test.cjs`. Asset bounds, transparency, contact sheets, and sample comparisons through the actual canvas renderer were checked. A live multi-device playtest was not performed for this artwork update.
