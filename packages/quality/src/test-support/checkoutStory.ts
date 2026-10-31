import { rmSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type CheckoutEngine, checkoutVerbs } from "./checkoutVerbs.ts";
import { hookRepository } from "./hookRepository.ts";

function emptyCheckout(): CheckoutEngine {
	return {
		answer: undefined,
		commit: undefined,
		layout: { configless: false, folder: "", scripts: {} },
		ownQuality: undefined,
		repository: undefined,
		root: "",
		worktrees: new Map(),
	};
}

// A committed git repository whose quality is this package's source, with its linked worktrees under .worktrees/.
export const checkoutStory = storyKit({
	after: {
		repository: (engine) => {
			engine.repository = hookRepository(engine.layout);
			engine.root = join(engine.repository.root, engine.layout.folder);
		},
	},
	clock: "live",
	create: () =>
		Effect.acquireRelease(Effect.sync(emptyCheckout), ({ repository }) =>
			Effect.sync(() => {
				if (repository !== undefined) {
					rmSync(repository.root, { force: true, recursive: true });
				}
			}),
		),
	inspect: ({ answer, commit }) => ({ answer, commit }),
	name: "Quality checkout",
	stages: ["repository", "checkout", "hook"],
	verbs: (engine, story) => checkoutVerbs(engine, story.tell),
});
