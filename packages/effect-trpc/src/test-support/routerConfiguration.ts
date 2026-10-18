import { Effect } from "effect";
import { storyKit, type Trait } from "@shivaedev/test-story/storyKit.ts";
import { emptyEngine, type RouterEngine } from "./routerEngine.ts";

export const routerConfiguration = storyKit({
	create: emptyEngine,
	name: "tRPC router configuration",
	stages: ["router"],
	verbs: (engine, story) => ({
		configure: (trait: Trait<RouterEngine, "router">) =>
			Effect.forEach(
				trait.parts,
				(part) => {
					story.tell(part.line);
					return part.apply(engine);
				},
				{ discard: true },
			),
	}),
});
