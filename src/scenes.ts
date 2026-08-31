import { SceneSchema, type Scene } from './schema/scene';

/**
 * Auto-discovers every scenes/*.json at bundle time via webpack's require.context.
 *
 * Deliberately dynamic: dropping a new topic JSON into scenes/ registers a
 * composition with no code change, which is the whole point of an LLM-authored
 * pipeline. A hand-maintained import list is one more thing to forget.
 */
const ctx = require.context('../scenes', false, /\.json$/);

export const SCENES: Scene[] = ctx
  .keys()
  .sort()
  .map((key) => {
    const raw = ctx(key);
    const parsed = SceneSchema.safeParse(raw);
    if (!parsed.success) {
      // Fail loudly in Studio rather than rendering a half-broken composition.
      throw new Error(
        `scenes/${key.replace('./', '')} does not match the scene schema:\n` +
          parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'),
      );
    }
    return parsed.data;
  });

export const sceneBySlug = (slug: string): Scene => {
  const found = SCENES.find((s) => s.slug === slug);
  if (!found) throw new Error(`No scene with slug "${slug}". Have: ${SCENES.map((s) => s.slug).join(', ')}`);
  return found;
};
