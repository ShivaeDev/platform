import { posix } from "node:path";
import { isTestCode } from "#naming/testName.ts";
import { inAdapters } from "#naming/unsafeFolders.ts";
import { defineRule, type Finding, type RuleInputs } from "#rule.ts";

const SOURCE = /\.[cm]?[jt]sx?$/u;

const DECLARATION = /\.d\.[cm]?ts$/u;

function production(path: string): boolean {
	return inAdapters(path) && SOURCE.test(path) && !DECLARATION.test(path) && !isTestCode(path);
}

// effect/service-model keeps a service's operations beside its service.ts, so the folder stays in adapters/ as one unit.
function unitOf(path: string, paths: ReadonlySet<string>): string {
	const folder = posix.dirname(path);
	return paths.has(`${folder}/service.ts`) ? folder : path;
}

function bridgeFindings({ evidence = new Set(), sources }: RuleInputs): readonly Finding[] {
	const candidates = sources.map((source) => source.path).filter(production);
	const paths = new Set(candidates);
	const bridging = new Set(candidates.filter((path) => evidence.has(path)).map((path) => unitOf(path, paths)));
	return candidates
		.filter((path) => !bridging.has(unitOf(path, paths)))
		.map((file) => ({
			file,
			message:
				"Uses nothing that Quality forbids outside adapters/, so it belongs outside adapters/. Move it to the folder its job belongs in, usually the parent, and update its imports; a service folder stays in adapters/ while any of its modules uses such a thing.",
		}));
}

export const adapterBridges = defineRule({
	check: bridgeFindings,
	depth: "deep",
	description:
		"Each production module in an adapters/ folder uses something that a rule forbids outside adapters/: a finding of effect/boundary (both halves), effect/adapter-imports, effect/context-capture, effect/unsafe-calls, the hidden-cast checks of suppressions/no-double-cast, or the ambient-runtime Biome plugin's runtime and browser I/O bans. A service folder, a service.ts with its operations beside it, is one unit. Tests and test-support/ are not checked. The rule runs in CI and with `quality lint --full`, after every other rule. No config exceptions or inline suppressions; baseline existing debt.",
	id: "effect/adapter-bridges",
	needs: "evidence",
	registrable: false,
});
