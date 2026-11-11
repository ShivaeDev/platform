import { rmSync } from "node:fs";
import { Effect } from "effect";
import type ts from "typescript";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#adapters/runMain.ts";
import { storyProgram } from "#adapters/storyProgram.ts";
import { loadConfig } from "#config/load.ts";
import { resolveRules } from "#config/resolve.ts";
import { validOrFail } from "#decoded.ts";
import type { ActiveRule } from "#engine/runRule.ts";
import { scan } from "#engine/session.ts";
import { importGraph } from "#imports/graph.ts";
import { defineRule, type RuleCheck, type RuleInputs } from "#rule.ts";
import { seedTree } from "#testing/adapters/tree.ts";

interface StoryProgramState {
	inputs: RuleInputs | undefined;
	readonly read: ts.Program[];
}

const RULES = ["tests/global-retries", "tests/story-specs"];

function programRead(inputs: RuleInputs): Effect.Effect<ts.Program, unknown, Effect.Services<ReturnType<typeof importGraph>>> {
	return Effect.map(importGraph(inputs), (graph) => storyProgram(inputs, graph));
}

function recorded(state: StoryProgramState, inputs: RuleInputs) {
	return Effect.map(programRead(inputs), (program) => {
		state.inputs = inputs;
		state.read.push(program);
	});
}

// Deep rules run after the fast ones, so this reader shares the story rules' program only when the engine groups it by its declared need.
function storyReader(state: StoryProgramState) {
	return defineRule({
		check: (inputs) => Effect.as(recorded(state, inputs), []),
		depth: "deep",
		description: "Reads the story program.",
		id: "local/story-reader",
		needs: "story-program",
	});
}

function recordingReads(rule: ActiveRule, state: StoryProgramState): RuleCheck {
	return (inputs) =>
		Effect.tap(rule.check(inputs), () => {
			const scanned = inputs.typeScript === undefined ? undefined : { ...inputs, typeScript: inputs.typeScript };
			if (scanned === undefined) {
				return Effect.die(new Error("A scan hands rules its TypeScript program"));
			}
			return recorded(state, scanned);
		});
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
		const local = yield* validOrFail("local rules", yield* resolveRules({ local: [storyReader(state)] }));
		const reader = local.active.filter((rule) => rule.id === "local/story-reader");
		const active = config.active.filter((rule) => RULES.includes(rule.id)).map((rule) => ({ ...rule, check: recordingReads(rule, state) }));
		return { check: scan({ ...config, active: [...active, ...reader] }), state };
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
			story.tell(`quality runs ${RULES.join(" and ")} and a deep local rule that declares it needs the story program`);
			return Effect.asVoid(check);
		},
	}),
});
