import { Effect, Layer } from "effect";
import { DeclarationFiles } from "#adapters/declaration-files/service.ts";
import { sourcesProgram } from "#adapters/typeScriptProgram.ts";
import type { RuleInputs } from "#rule.ts";
import type { PackageCheck } from "#rules/packageFindings.ts";

// The program is rooted at only the files the check reads, and TypeScript loads what they import. Its declarations are parsed into a registry of its own, released with the program when the rule is done.
const findings = Effect.fn("RootedFindings.findings")(function* (inputs: RuleInputs, check: PackageCheck) {
	const roots = inputs.sources.filter(check.checks);
	if (roots.length === 0) {
		return [];
	}
	const typeScript = yield* sourcesProgram(inputs.root, roots);
	return check.findings(roots, typeScript);
});

export function rootedFindings(inputs: RuleInputs, check: PackageCheck) {
	return findings(inputs, check).pipe(Effect.provide(Layer.fresh(DeclarationFiles.layer)));
}
