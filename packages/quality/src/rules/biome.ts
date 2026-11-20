import { Effect } from "effect";
import { fileExclusions } from "#biome/exceptionConfig.ts";
import { biomeReport, type Diagnostic, FAILING } from "#biome/report.ts";
import { PRESET, rootConfig } from "#biome/rootConfig.ts";
import { needsScanner, SCANNER_RULES } from "#biome/scannerRules.ts";
import { withoutEntryPointImports } from "#biome/withoutEntryPointImports.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { inAdapters, inTestSupport } from "#naming/unsafeFolders.ts";
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

function excepted(exceptions: readonly ExceptionDeclaration[], diagnostic: Diagnostic): boolean {
	const path = diagnostic.location.path;
	return path !== undefined && exceptions.some((entry) => entry.rules.includes(`biome/${diagnostic.category}`) && entry.files.includes(path));
}

// An excepted diagnostic reaches the session at any severity, which drops it and judges each exception by whether one arrived.
const halfFindings = Effect.fn("Biome.halfFindings")(function* (
	inputs: Pick<RuleInputs, "exceptions" | "readText">,
	diagnostics: readonly Diagnostic[],
	scanned: boolean,
) {
	const reported = diagnostics.filter(
		(diagnostic) =>
			needsScanner(diagnostic.category) === scanned && (FAILING.has(diagnostic.severity) || excepted(inputs.exceptions ?? [], diagnostic)),
	);
	return (yield* withoutEntryPointImports(inputs, reported)).map(findingOf);
});

const presetFinding = Effect.fn("Biome.presetFinding")(function* (inputs: Pick<RuleInputs, "readText">) {
	const { extendsPreset, path } = yield* rootConfig(inputs.readText);
	return extendsPreset ? [] : [{ file: path, message: `Extend "${PRESET}" from the root Biome config.`, subject: "preset" }];
});

const WITHOUT_SCANNER: readonly ExceptionDeclaration[] = [...SCANNER_RULES].map(
	(category): ExceptionDeclaration => ({
		files: ["**"],
		reason: "The scanner half checks the rules that need Biome's project scanner.",
		rules: [`biome/${category}`],
	}),
);

const PLUGGED = /\.[cm]?[jt]sx?$/u;

function located(diagnostic: Diagnostic): string {
	const { end, path, start } = diagnostic.location;
	return JSON.stringify([path, start, end, diagnostic.message]);
}

// What the ambient-runtime plugin reports in adapters/ only once its folder exemption is lifted is evidence that a module belongs there; the unconditional bans fire in both passes and cancel out.
const adapterEvidence = Effect.fn("Biome.adapterEvidence")(function* ({
	collectsEvidence,
	exceptions = [],
	nonEffectFolders,
	sources,
	root,
}: RuleInputs) {
	if (collectsEvidence !== true) {
		return [];
	}
	const adapters = sources.map((source) => source.path).filter((path) => inAdapters(path) && !inTestSupport(path) && PLUGGED.test(path));
	if (adapters.length === 0) {
		return [];
	}
	function pass(liftAdapters: boolean) {
		return biomeReport(
			root,
			["lint", "--only=plugin", "--no-errors-on-unmatched"],
			fileExclusions(exceptions),
			adapters,
			nonEffectFolders,
			liftAdapters,
		);
	}
	const [kept, lifted] = yield* Effect.all([pass(false), pass(true)], { concurrency: "unbounded" });
	const left = new Map<string, number>();
	for (const diagnostic of kept.diagnostics) {
		left.set(located(diagnostic), (left.get(located(diagnostic)) ?? 0) + 1);
	}
	return lifted.diagnostics.flatMap((diagnostic): readonly Finding[] => {
		const count = left.get(located(diagnostic)) ?? 0;
		left.set(located(diagnostic), count - 1);
		return count > 0 ? [] : [{ ...findingOf(diagnostic), unsafe: true }];
	});
});

const bridge = defineRule({
	check: ({ exceptions = [], nonEffectFolders, readText, root }) =>
		Effect.gen(function* () {
			const [preset, report] = yield* Effect.all(
				[presetFinding({ readText }), biomeReport(root, ["check"], [...fileExclusions(exceptions), ...WITHOUT_SCANNER], ["."], nonEffectFolders)],
				{ concurrency: "unbounded" },
			);
			return [...preset, ...(yield* halfFindings({ exceptions, readText }, report.diagnostics, false))];
		}),
	deepHalf: {
		check: (inputs) =>
			Effect.gen(function* () {
				const { exceptions = [], nonEffectFolders, readText, root } = inputs;
				const [report, evidence] = yield* Effect.all(
					[biomeReport(root, ["lint", "--skip=plugin"], fileExclusions(exceptions), ["."], nonEffectFolders), adapterEvidence(inputs)],
					{ concurrency: "unbounded" },
				);
				return [...(yield* halfFindings({ exceptions, readText }, report.diagnostics, true)), ...evidence];
			}),
		name: "scanner half",
	},
	description:
		"Biome's lint, format and assist findings under the shared preset, except undeclared-dependency findings for a piece that an application's entry point brings. The rules that need Biome's project scanner (its project and types domains) run as the scanner half, in CI and with `quality lint --full`; that half also runs the ambient-runtime plugin over adapters/ without its folder exemption, as evidence for effect/adapter-bridges. `quality fix` applies Biome's lint fixes, unsafe ones included, its assist actions and formatting.",
	id: "biome",
	needs: "child-process",
	registrable: false,
});

export const biome: Rule<"biome", undefined> = { ...bridge, family: true };
