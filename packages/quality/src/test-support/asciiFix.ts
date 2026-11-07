import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, type Scope } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type Run, runQuality } from "#testing/adapters/cli.ts";
import { qualityTree } from "#testing/adapters/qualityTree.ts";
import { config, removeSeededTrees } from "#testing/adapters/tree.ts";

interface AsciiFixStory {
	answer: Run | undefined;
	readonly root: string;
}

export const asciiFix = storyKit({
	create: (): Effect.Effect<AsciiFixStory, never, Scope.Scope> =>
		Effect.gen(function* () {
			yield* Effect.addFinalizer(() => Effect.sync(removeSeededTrees));
			const root = qualityTree([
				config(
					'{ sources: ["."], rules: { "files/ascii": { options: { files: ["text.txt"], forbidden: [{ codePoint: 0x20_1c, replacement: \'"\' }, { codePoint: 0x20_1d, replacement: \'"\' }, { codePoint: 0x20_26, replacement: "..." }, { range: [0x20_0b, 0x20_0b], replacement: "" }, { range: [0xfe_ff, 0xfe_ff], replacement: "" }, { codePoint: 0x20_14, message: "Reword this without an em dash." }] } } } }',
				),
				{ content: "\uFEFF\u201Chello\u201D \u2026 hidden\u200B keep \u2192 Caf\u00e9 \u2014\n", path: "text.txt" },
			]);
			return { answer: undefined, root };
		}),
	inspect: ({ answer }) => ({ answer }),
	name: "Quality ASCII fix",
	stages: ["repository"],
	verbs: (engine, story) => ({
		fix: () =>
			Effect.gen(function* () {
				story.tell("the author runs quality fix --rule files/ascii");
				const result = yield* runQuality(engine.root, "fix", "--rule", "files/ascii");
				engine.answer = result;
			}),
		message: () => Effect.succeed(engine.answer?.stdout ?? "quality has not run"),
		outcome: () =>
			Effect.sync(() => {
				if (engine.answer?.status === 0) {
					return "passed";
				}
				if (engine.answer?.status === 1) {
					return "rejected";
				}
				return "not run";
			}),
		source: () => Effect.sync(() => readFileSync(join(engine.root, "text.txt"), "utf8")),
	}),
});
