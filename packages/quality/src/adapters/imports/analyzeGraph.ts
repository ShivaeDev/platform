import { realpathSync } from "node:fs";
import { Effect } from "effect";
import type { RuleInputs } from "#rule.ts";
import { analysisFailure } from "./analysisFailure.ts";
import { graph } from "./graph.ts";

export const analyzeGraph = Effect.fn("ImportCompiler.analyzeGraph")((inputs: RuleInputs) =>
	Effect.try({ catch: (cause) => analysisFailure(inputs.root, cause), try: () => graph(inputs, realpathSync(inputs.root)) }),
);
