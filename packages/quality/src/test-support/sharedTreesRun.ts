import { rmSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import type ts from "typescript";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#adapters/runMain.ts";
import { loadConfig } from "#config/load.ts";
import { resolveRules } from "#config/resolve.ts";
import { validOrFail } from "#decoded.ts";
import { scan } from "#engine/session.ts";
import { importGraph } from "#imports/graph.ts";
import { defineRule, type Need, type RuleInputs } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { storyProgram } from "#storyProgram.ts";
import { seedTree } from "#testing/adapters/tree.ts";

const FILE = "src/total.ts";

interface SharedTreesState {
	inputs: RuleInputs | undefined;
	readonly trees: Map<string, ts.SourceFile | undefined>;
}

function sourceOf(inputs: RuleInputs) {
	return inputs.sources.find((file) => file.path === FILE);
}

function treeReader(state: SharedTreesState, id: string, needs?: Need) {
	return defineRule({
		check: (inputs) =>
			Effect.sync(() => {
				const file = sourceOf(inputs);
				state.inputs = inputs;
				state.trees.set(id, file === undefined ? undefined : parse(file));
				return [];
			}),
		description: "Reads the tree of one source.",
		id: `local/${id}`,
		...(needs === undefined ? {} : { needs }),
	});
}

function storyReader(state: SharedTreesState) {
	return defineRule({
		check: (inputs) =>
			Effect.map(importGraph(inputs), (graph) => {
				state.trees.set("story", storyProgram(inputs, graph).getSourceFile(join(inputs.root, FILE)));
				return [];
			}),
		description: "Reads the story program's tree of one source.",
		id: "local/story-reader",
		needs: "story-program",
	});
}

function sameTree(state: SharedTreesState, reader: string): string {
	const shared = state.trees.get("syntax");
	return shared !== undefined && state.trees.get(reader) === shared ? "the syntax rules' tree" : "a tree of its own";
}

export const sharedTreesRun = storyKit({
	*create() {
		const root = seedTree([
			{ content: '{"name":"app","version":"1.0.0","type":"module"}\n', path: "package.json" },
			{ content: "export function total(values: readonly number[]) {\n\treturn values.length;\n}\n", path: FILE },
		]);
		yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(root, { force: true, recursive: true })));
		const config = yield* loadConfig(root, undefined);
		const state: SharedTreesState = { inputs: undefined, trees: new Map() };
		const local = yield* validOrFail(
			"local rules",
			yield* resolveRules({ local: [treeReader(state, "syntax"), treeReader(state, "typed", "type-checker"), storyReader(state)] }),
		);
		return { check: scan({ ...config, active: local.active }), state };
	},
	inspect: ({ state }) => ({ trees: state.trees.size }),
	layer: services,
	name: "Quality shared trees run",
	stages: [],
	verbs: ({ check, state }, story) => ({
		runs: () => {
			story.tell("quality runs a syntax rule, a rule that declares it needs a type checker and a rule that reads the story program");
			return Effect.asVoid(check);
		},
		storyTree: () => Effect.sync(() => sameTree(state, "story")),
		treeAfterRun: () =>
			Effect.sync(() => {
				const file = state.inputs === undefined ? undefined : sourceOf(state.inputs);
				return file !== undefined && parse(file) === state.trees.get("syntax") ? "the run's tree" : "a new tree";
			}),
		typedTree: () => Effect.sync(() => sameTree(state, "typed")),
	}),
});
