import { Effect } from "effect";
import { PRESET, rootConfig } from "#adapters/biome/rootConfig.ts";
import { biomeReport, type Diagnostic, FAILING } from "#biome/report.ts";
import { withoutEntryPointImports } from "#biome/withoutEntryPointImports.ts";
import { defineRule, type Finding, type Rule, type RuleInputs } from "#rule.ts";

function messageOf(diagnostic: Diagnostic): string {
	if (diagnostic.category === "lint/correctness/noProcessGlobal") {
		return "Uses the process global. In Effect code, use an adapters/ module with explicit imports that exposes Effect values: import process from node:process there. Read environment variables with Config instead of process.env, including in adapters/.";
	}
	return diagnostic.category === "format" && diagnostic.message.startsWith("Formatter would have printed")
		? "Is not formatted. Run `quality fix`."
		: diagnostic.message;
}

function findingOf(diagnostic: Diagnostic): Finding {
	const line = diagnostic.location.start?.line ?? 0;
	return {
		file: diagnostic.location.path ?? ".",
		line: line > 0 ? line : undefined,
		message: messageOf(diagnostic),
		subject: diagnostic.category ?? "internal",
	};
}

export const failingFindings = Effect.fn("Biome.failingFindings")(function* (
	inputs: Pick<RuleInputs, "readText">,
	diagnostics: readonly Diagnostic[],
) {
	const failing = diagnostics.filter((diagnostic) => FAILING.has(diagnostic.severity));
	return (yield* withoutEntryPointImports(inputs, failing)).map(findingOf);
});

const presetFinding = Effect.fn("Biome.presetFinding")(function* (inputs: Pick<RuleInputs, "readText">) {
	const { extendsPreset, path } = yield* rootConfig(inputs.readText);
	return extendsPreset ? [] : [{ file: path, message: `Extend "${PRESET}" from the root Biome config.`, subject: "preset" }];
});

const bridge = defineRule({
	check: ({ exceptions, nonEffectFolders, readText, root }) =>
		Effect.gen(function* () {
			const [preset, report] = yield* Effect.all([presetFinding({ readText }), biomeReport(root, ["check"], exceptions, ["."], nonEffectFolders)], {
				concurrency: "unbounded",
			});
			return [...preset, ...(yield* failingFindings({ readText }, report.diagnostics))];
		}),
	description:
		"Biome's lint, format and assist findings under the shared preset, except undeclared-dependency findings for a piece that an application's entry point brings. `quality fix` applies Biome's lint fixes, unsafe ones included, its assist actions and formatting.",
	id: "biome",
	needs: "child-process",
	registrable: false,
});

export const biome: Rule<"biome", undefined> = { ...bridge, family: true };
