import { indexStory } from "./indexStory.ts";
import { referenceLink } from "./referenceLink.ts";

export const indexedAliases = indexStory.trait("project", "two aliases point at different folders", ({ notes }) => {
	referenceLink(notes, "alias", "first");
	referenceLink(notes, "replacement", "second");
});
