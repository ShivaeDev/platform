import { dirname, join, relative, sep } from "node:path";
import { Effect } from "effect";
import type { RuleInputs } from "#rule.ts";

export const catalogWorkspace = Effect.fn("Manifests.catalogWorkspace")(function* ({ readText, root }: Pick<RuleInputs, "readText" | "root">) {
	let directory = root;
	for (;;) {
		const file = relative(root, join(directory, "pnpm-workspace.yaml")).split(sep).join("/");
		const text = yield* readText(file);
		if (text !== undefined) {
			return { file, text };
		}
		const parent = dirname(directory);
		if (parent === directory) {
			return { file: "pnpm-workspace.yaml", text: "" };
		}
		directory = parent;
	}
});
