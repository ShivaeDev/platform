import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { command } from "#package-check/io.ts";
import { bins, decodeVersions, effectPackage, type Package } from "#package-check/model.ts";
import type { Scenario } from "#package-check/scenarios.ts";
import { withTarballOverrides } from "#withTarballOverrides.ts";

const HOIST = /^publicHoistPattern:.*\n/mu;

const HOIST_PIECES = 'publicHoistPattern: ["@shivaedev/*"]\n';

export const consumerWorkspace = Effect.fn("Packed.consumerWorkspace")(function* (
	root: string,
	pkg: Package,
	tarballs: Readonly<Record<string, string>>,
	shell?: Scenario["shell"],
) {
	const fs = yield* FileSystem.FileSystem;
	// Packed consumers must resolve built exports rather than the workspace's source condition.
	let workspace = (yield* fs.readFileString(join(root, "pnpm-workspace.yaml"))).replace(/^nodeOptions:.*\n/mu, "").replace(HOIST, "");
	// Only an application on the platform shell relies on hoisting; every other consumer resolves its declared dependencies alone.
	if (shell === "hoisted") {
		workspace = `${HOIST_PIECES}${workspace}`;
	}
	if (Object.keys(bins(pkg.manifest)).length > 0) {
		const overrides = decodeVersions(yield* command(root, "pnpm", ["config", "get", "overrides", "--json"]));
		const retained = Object.entries(overrides)
			.filter(([name]) => !effectOverride(name))
			.map(([name, version]) => `  ${JSON.stringify(name)}: ${JSON.stringify(version)}\n`)
			.join("");
		workspace = workspace.replace(/^overrides:[ \t]*\n(?:(?:[ \t].*)?\n)*/mu, "");
		if (retained !== "") {
			workspace = `${workspace.trimEnd()}\n\noverrides:\n${retained}`;
		}
	}
	return withTarballOverrides(workspace, tarballs);
});

function effectOverride(selector: string): boolean {
	const target = selector.split(">").at(-1) ?? selector;
	return effectPackage(target) || target.startsWith("effect@");
}
