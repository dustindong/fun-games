# Logo-inspired sticker artwork: first batch

Built-in image_gen created six individual transparent sprites from the user's approved logo-inspired preview. The prompts are recorded in prompts.json. Final production assets are the six WebP files in this directory.

Subjects: person, giraffe, polar bear, standard door, original PS5, Eiffel Tower. Other objects still use their existing illustrations until converted in a later batch.

Original generated pixels were resized within 768 × 768 and encoded as WebP with alpha preserved. manifest.js records visible-object bounds (alpha >= 128); the renderer uses this source rectangle so transparent padding does not alter measured height. The images are never stretched independently in width and height. PS5 excludes its stand; Eiffel Tower includes its antenna. Existing numerical heights and measurement fractions remain authoritative.

Sprites preload on entry. Missing or invalid images retain the original art. Images finishing during a play phase activate at the next round boundary rather than changing an active guess. Both normal pictures and tinted guess ghosts use the same artwork and bounds.

Validation: node --test how-big/tests/*.test.cjs. The actual canvas stage renderer was also used to inspect all six loaded assets and a guess ghost. A live multi-device playtest was not performed for this artwork-only update.
