import { rmSync } from "node:fs";
import { Effect } from "effect";
import type ts from "typescript";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#adapters/runMain.ts";
import { STORY_PROGRAM_RULES, storyProgram } from "#adapters/storyProgram.ts";
import { loadConfig } from "#config/load.ts";
import { scan } from "#engine/session.ts";
import { importGraph } from "#imports/graph.ts";
import type { RuleCheck, RuleInputs } from "#rule.ts";
import { seedTree } from "#testing/adapters/tree.ts";

interface StoryProgramState {
	inputs: RuleInputs | undefined;
	readonly read: ts.Program[];
}

const RULES = ["tests/global-retries", "tests/story-specs"];

function programRead(inputs: RuleInputs): Effect.Effect<ts.Program, unknown, Effect.Services<ReturnType<typeof importGraph>>> {
	return Effect.map(importGraph(inputs), (graph) => storyProgram(inputs, graph));
}

export const storyProgramRun = storyKit({
	*create() {
		const root = seedTree([
			{ content: '{"name":"app","version":"1.0.0","type":"module"}\n', path: "package.json" },
			{ content: "export function total(values: readonly number[]) {\n\treturn values.length;\n}\n", path: "src/total.ts" },
		]);
		yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(root, { force: true, recursive: true })));
		const config = yield* loadConfig(root, undefined);
		const state: StoryProgramState = { inputs: undefined, read: [] };
		const active = config.active
			.filter((rule) => RULES.includes(rule.id) && STORY_PROGRAM_RULES.has(rule.id))
			.map((rule) => ({
				...rule,
				check: ((inputs) =>
					Effect.tap(rule.check(inputs), () => {
						const scanned = inputs.typeScript === undefined ? undefined : { ...inputs, typeScript: inputs.typeScript };
						return scanned === undefined
							? Effect.die(new Error("A scan hands rules its TypeScript program"))
							: Effect.map(programRead(scanned), (program) => {
									state.inputs = scanned;
									state.read.push(program);
								});
					})) satisfies RuleCheck,
			}));
		return { check: scan({ ...config, active }), state };
	},
	inspect: ({ state }) => ({ reads: state.read.length }),
	layer: services,
	name: "Quality story program run",
	stages: [],
	verbs: ({ check, state }, story) => ({
		programAfterRun: Effect.fn("StoryProgramRun.programAfterRun")(function* () {
			if (state.inputs === undefined || state.read[0] === undefined) {
				return yield* Effect.die(new Error("Run the story rules before reading their program"));
			}
			const after = yield* programRead(state.inputs);
			return after === state.read[0] ? "the program the story rules read" : "a new program";
		}),
		programsDuringRun: () => Effect.sync(() => (new Set(state.read).size === 1 ? "one program" : "a program per rule")),
		runs: () => {
			story.tell(`quality runs ${RULES.join(" and ")}, which read the story program`);
			return Effect.asVoid(check);
		},
	}),
});
