import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#cli/runMain.ts";
import type { Findings, Rule } from "#rule.ts";
import { inputsOf } from "./inputs.ts";
import { locationOf } from "./ruleStory.ts";

interface ListedEngine {
	findings: Findings | undefined;
	readonly paths: string[];
}

function checked(engine: ListedEngine): Findings {
	if (engine.findings === undefined) {
		throw new Error("Check a rule before reading its findings");
	}
	return engine.findings;
}

// macOS and Windows cannot write two paths that differ only by case, so the checkout is the path list a case-sensitive
// filesystem such as Linux gives quality, not files on this disk.
export const listedCheckout = storyKit({
	create: (): ListedEngine => ({ findings: undefined, paths: [] }),
	inspect: ({ findings, paths }) => ({ findings, paths }),
	layer: services,
	name: "Quality case-sensitive checkout",
	stages: ["checkout"],
	verbs: (engine, story) => ({
		check: Effect.fn("ListedCheckout.check")(function* (rule: Rule<string, undefined>) {
			story.tell(`quality checks ${rule.id}`);
			const configured = yield* Effect.promise(() => rule.configure(undefined));
			if (configured._tag === "Invalid") {
				return yield* Effect.die(new Error(`${rule.id} refused its options: ${configured.issues.join("; ")}`));
			}
			engine.findings = yield* configured.check(inputsOf({ files: engine.paths }));
			return engine.findings;
		}),
		locations: () => Effect.sync(() => checked(engine).map(locationOf)),
	}),
});

export function checkoutLists(...paths: readonly string[]) {
	return listedCheckout.trait("checkout", `a case-sensitive checkout holds ${paths.join(", ")}`, (engine) => {
		engine.paths.push(...paths);
	});
}
