import { Effect, Schema } from "effect";
import type { Fence } from "../../imports/fences/model.ts";
import { compilePolicy } from "../../imports/fences/policy.ts";
import { importGraph } from "../../imports/graph.ts";
import { defineRule } from "../../rule.ts";

function isFence(value: unknown): value is Fence {
	return typeof value === "object" && value !== null && "_tag" in value && value._tag === "Fence";
}

const FencesOptions = Schema.Struct({
	fences: Schema.Array(Schema.declare(isFence, { expected: "a fence made with fence()" })).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

export const importFences = defineRule({
	check: async ({ options, ...inputs }) => {
		if (options.fences.length === 0) {
			return [];
		}
		const graph = await importGraph(inputs);
		const policy = compilePolicy(options.fences, { files: inputs.files, packages: graph.packages });
		return policy.flatMap((compiled) => compiled.evaluate(graph));
	},
	description: "Imports respect the fences the repository declares. Move the code to the side of the fence its imports belong to.",
	id: "imports/fences",
	options: Schema.toStandardSchemaV1(FencesOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
