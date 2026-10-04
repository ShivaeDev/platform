import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { Effect } from "effect";
import { manifestsIn, sortingOf } from "../manifests/sorted.ts";
import { defineRule, type Finding } from "../rule.ts";

const MESSAGES = {
	Invalid: "Is not valid JSON.",
	Unsorted: "Keys are not in sort-package-json order. Run `quality fix`.",
} as const;

export const manifestsSorted = defineRule({
	check: async ({ readText, root }) => {
		const manifests = await Effect.runPromise(manifestsIn(root).pipe(Effect.provide(NodeFileSystem.layer)));
		const texts = await Promise.all(manifests.map(async (path) => ({ path, text: (await readText(path)) ?? "" })));
		return texts.flatMap(({ path, text }): readonly Finding[] => {
			const sorting = sortingOf(text);
			return sorting._tag === "Sorted" ? [] : [{ file: path, message: MESSAGES[sorting._tag] }];
		});
	},
	description: "Every package.json in the repository keeps its keys in sort-package-json order. `quality fix` sorts them.",
	id: "manifests/sorted",
	registrable: false,
});
