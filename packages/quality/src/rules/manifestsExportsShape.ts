import { posix } from "node:path";
import { Effect } from "effect";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { workspacePackages } from "#imports/workspace.ts";
import { defineRule, type Finding } from "#rule.ts";

const PATTERN = "./*.ts";

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

function isMap(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function standardPattern(key: string, value: unknown): boolean {
	if (!(key.startsWith("./") && key.endsWith(".ts")) || key.split("*").length !== 2 || !isMap(value)) {
		return false;
	}
	const subpath = key.slice("./".length);
	const stem = subpath.slice(0, -".ts".length);
	const conditions = { default: `./dist/${stem}.js`, source: `./src/${subpath}`, types: `./dist/${stem}.d.ts` };
	return (
		Object.keys(value).length === Object.keys(conditions).length
		&& Object.entries(conditions).every(([condition, target]) => value[condition] === target)
	);
}

function exactAsset(key: string, value: unknown): boolean {
	const extension = posix.extname(key);
	return key.startsWith("./") && !key.includes("*") && value === key && extension !== "" && !CODE_EXTENSIONS.has(extension);
}

function finding(file: string, subject: string, reason: string): Finding {
	return {
		file,
		message: `${reason} Import the module at its file path through the single "${PATTERN}" wildcard (for example, "./server/better-auth/mount.ts" for "./src/server/better-auth/mount.ts"). Map it to source "./src/*.ts", types "./dist/*.d.ts" and default "./dist/*.js"; remove aliases and per-file module exports. Non-code assets must use their exact file paths.`,
		subject,
	};
}

function findingsIn(file: string, exports: unknown): readonly Finding[] {
	if (exports === undefined) {
		return [];
	}
	if (!isMap(exports)) {
		return [finding(file, "exports", "The exports field must be a subpath map.")];
	}
	const entries = Object.entries(exports);
	const patterns = entries.filter(([key, value]) => key.includes("*") && value !== null);
	const exportsModules = entries.some(([key, value]) => value !== null && !exactAsset(key, value));
	const count =
		patterns.length === 1 || (patterns.length === 0 && !exportsModules)
			? []
			: [finding(file, "exports", `The exports field needs exactly one non-null wildcard; found ${patterns.length}.`)];
	return [
		...count,
		...entries.flatMap(([key, value]) => {
			if (value === null) {
				return [finding(file, key, `Export "${key}" blocks module imports with null. Remove the null entry so callers can import each module.`)];
			}
			return key === "." || exactAsset(key, value) || standardPattern(key, value)
				? []
				: [finding(file, key, `Export "${key}" does not preserve the module's file path.`)];
		}),
	];
}

function importFindings(file: string, imports: Readonly<Record<string, unknown>> = {}): readonly Finding[] {
	return Object.entries(imports).flatMap(([key, value]) => {
		if (key === "#*.ts" && value !== "./src/*.ts" && !standardPattern(PATTERN, value)) {
			return [
				{
					file,
					message:
						'Import "#*.ts" must preserve the path from the source root. Map it to "./src/*.ts", or to source "./src/*.ts", types "./dist/*.d.ts" and default "./dist/*.js". Include subfolders in import specifiers, for example "#server/module.ts".',
					subject: key,
				},
			];
		}
		if (key === "#test/*" && value !== "./src/test-support/*") {
			return [
				{
					file,
					message: 'Import "#test/*" must map to "./src/test-support/*". Keep test helpers under the source root’s test-support folder.',
					subject: key,
				},
			];
		}
		return [];
	});
}

export const manifestsExportsShape = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const packages = yield* Effect.promise(() => workspacePackages(inputs));
			const files = ["package.json", ...packages.map((owner) => posix.join(owner.directory, "package.json"))];
			const findings = yield* Effect.forEach(
				files,
				(file) =>
					Effect.gen(function* () {
						const manifest = yield* Effect.promise(() => readPackageManifest(inputs.readText, file));
						if (file === "package.json" && manifest === undefined) {
							return [];
						}
						return [...findingsIn(file, manifest?.exports), ...importFindings(file, manifest?.imports)];
					}),
				{ concurrency: "unbounded" },
			);
			return findings.flat();
		}),
	description:
		"Packages export modules through one file-preserving wildcard without null blocks; declared #*.ts and #test/* imports preserve the source and test-support roots.",
	id: "manifests/exports-shape",
	registrable: false,
});
