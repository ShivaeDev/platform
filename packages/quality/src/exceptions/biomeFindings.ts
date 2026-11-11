import { Effect } from "effect";
import { needsScanner } from "#biome/scannerRules.ts";
import { keyOf, type Violation } from "#engine/violation.ts";
import type { StaleRegistryEntry } from "#exceptions/registry.ts";
import type { FilesystemFailure } from "#inventory/filesystem.ts";
import type { Finding, RuleInputs } from "#rule.ts";

// The biome rule reports excepted diagnostics at any severity; the session drops them and names each exception that none matched.
export const biomeExceptions = Effect.fn("Exceptions.biomeExceptions")(function* (
	violations: readonly Violation[],
	inputs: Pick<RuleInputs, "configFile" | "exceptions" | "readText">,
	skippedHalves: ReadonlySet<string>,
) {
	const declared = (inputs.exceptions ?? []).flatMap(({ files, reason, rules }) =>
		rules.filter((rule) => /^biome\/(?:lint|assist)\//u.test(rule)).flatMap((rule) => files.map((file) => ({ file, reason, rule }))),
	);
	const excepted = new Set(declared.map(({ file, rule }) => keyOf(rule, file)));
	const reported = new Set(violations.map((violation) => keyOf(violation.rule, violation.file)));
	const texts = yield* Effect.forEach(declared, ({ file }) => inputs.readText(file), { concurrency: "unbounded" });
	const judged = declared.filter(
		(entry, index) => texts[index] !== undefined && !(skippedHalves.has("biome") && needsScanner(entry.rule.slice("biome/".length))),
	);
	return {
		kept: violations.filter((violation) => !excepted.has(keyOf(violation.rule, violation.file))),
		stale: judged
			.filter(({ file, rule }) => !reported.has(keyOf(rule, file)))
			.map(
				(entry): StaleRegistryEntry => ({
					entry,
					problem: `matches no finding. Remove this file/rule pair from exceptions in ${inputs.configFile ?? "quality.config.ts"}`,
				}),
			),
	};
});

const missingBiomeFile = Effect.fn("Exceptions.missingBiomeFile")(function* (
	inputs: RuleInputs,
	file: string,
): Effect.fn.Return<readonly Finding[], FilesystemFailure> {
	const text = yield* inputs.readText(file);
	return text === undefined
		? [{ file, message: `This Biome exception names a missing file. Remove it from exceptions in ${inputs.configFile ?? "quality.config.ts"}.` }]
		: [];
});

export const missingBiomeFiles = Effect.fn("Exceptions.missingBiomeFiles")(function* (inputs: RuleInputs) {
	const paths = (inputs.exceptions ?? [])
		.filter((entry) => entry.rules.some((rule) => rule.startsWith("biome/") && rule !== "biome/files/includes"))
		.flatMap((entry) => entry.files);
	const checked = yield* Effect.forEach([...new Set(paths)], (file) => missingBiomeFile(inputs, file), { concurrency: "unbounded" });
	return checked.flat();
});

export function biomeExceptionHint(files: readonly string[], rule: string, config = "quality.config.ts"): string {
	const entry = { files, reason: "Explain why this exception is permanent.", rules: [`biome/${rule}`] };
	return ` Move this setting into exceptions in ${config}: ${JSON.stringify(entry)}, and remove the setting from the Biome config.`;
}
