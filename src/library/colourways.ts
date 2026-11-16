import type { Steps } from "../pattern/design";

/**
 * A stepped colourway's yarns by place (see Colourway.stepped), fetched when
 * a sweater laid out for one knitter is shown in it, and not before: a table
 * no published sweater needs, a file a colourway, written beside the
 * catalogue by `npm run editions`.
 */
const fetched = new Map<string, Promise<Steps | undefined>>();

/** Where a colourway's steps are served from. */
export const stepsUrl = (colourwayId: string) => `${import.meta.env.BASE_URL}colourways/${colourwayId}.json`;

/** A colourway's steps; none where they cannot be had, when it is drawn as published. */
export const loadSteps = (colourwayId: string): Promise<Steps | undefined> => {
  let asked = fetched.get(colourwayId);
  if (!asked) {
    asked = fetch(stepsUrl(colourwayId)).then(
      async (response) => (response.ok ? ((await response.json()) as Steps) : undefined),
      () => undefined,
    );
    // One that could not be had is asked for again.
    void asked.then((steps) => {
      if (!steps) fetched.delete(colourwayId);
    });
    fetched.set(colourwayId, asked);
  }
  return asked;
};
