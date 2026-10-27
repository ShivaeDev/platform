import { Option } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Key } from "#keys.ts";
import { heard, watchHints } from "#testing.ts";
import { modulePolicyEngine } from "./modulePolicyEngine.ts";

export const modulePolicyStory = storyKit({
	clock: "live",
	create: () => modulePolicyEngine,
	name: "module read policies",
	stages: [],
	verbs: (engine) => ({
		batches: () => engine.batches.map((batch) => batch.map(({ key, space, viewer }) => ({ key, space, viewer }))),
		heard,
		listen: (viewer: string, ids: readonly string[]) =>
			watchHints(engine.client("documents.$changes", { queries: [{ payload: { ids }, query: "read" }] }, { headers: { viewer } })),
		mySpaces: (viewer: string, member: string) => engine.client("documents.mine", { member }, { headers: { viewer } }),
		publish: (keys: readonly Key[]) => engine.publish(keys),
		readDocuments: (viewer: string | undefined, ids: readonly string[]) =>
			engine.client("documents.read", { ids }, { headers: viewer === undefined ? {} : { viewer } }),
		readTasks: (viewer: string, member: string) => engine.client("tasks.read", { member }, { headers: { viewer } }),
		unclaimed: () => engine.client("tasks.unclaimed", undefined, { headers: { viewer: "alice" } }),
		viewers: () => engine.viewers.map(Option.getOrUndefined),
	}),
});
