import { posix } from "node:path";
import { Effect } from "effect";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { workspacePackages } from "#imports/workspace.ts";
import { defineRule, type Finding } from "#rule.ts";
import { exportImportFindings } from "#rules/exportImportFindings.ts";

const PATTERN = "./*.ts";

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

function isMap(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function standardPattern(key: string, value: unknown, sourceOnly = false): boolean {
	if (sourceOnly && key === "./*" && value === "./src/*") {
		return true;
	}
	if (!(key.startsWith("./") && key.endsWith(".ts")) || key.split("*").length !== 2) {
		return false;
	}
	const subpath = key.slice("./".length);
	if (sourceOnly && value === `./src/${subpath}`) {
		return true;
	}
	if (!isMap(value)) {
		return false;
	}
	const stem = subpath.slice(0, -".ts".length);
	const source = "@shivaedev/source" in value ? "@shivaedev/source" : "source";
	const conditions = { default: `./dist/${stem}.js`, [source]: `./src/${subpath}`, types: `./dist/${stem}.d.ts` };
	return (
		Object.keys(value).length === Object.keys(conditions).length
		&& Object.entries(conditions).every(([condition, target]) => value[condition] === target)
	);
}

function exactAsset(key: string, value: unknown): boolean {
	const extension = posix.extname(key);
	return key.startsWith("./") && !key.includes("*") && value === key && extension !== "" && !CODE_EXTENSIONS.has(extension);
}

function finding(file: string, subject: string, reason: string, isPrivate: boolean): Finding {
	const sourceOnly = isPrivate
		? ' For a private package, mapping "./*.ts" directly to "./src/*.ts", or "./*" to "./src/*" to preserve both .ts and .tsx extensions, is also accepted.'
		: "";
	return {
		file,
		message: `${reason} Import the module at its file path through the single "${PATTERN}" wildcard (for example, "./server/better-auth/mount.ts" for "./src/server/better-auth/mount.ts"). Map it to source "./src/*.ts", types "./dist/*.d.ts" and default "./dist/*.js"; remove aliases and per-file module exports. Non-code assets must use their exact file paths.${sourceOnly}`,
		subject,
	};
}

function findingsIn(file: string, exports: unknown, isPrivate: boolean): readonly Finding[] {
	if (exports === undefined) {
		return [];
	}
	if (!isMap(exports)) {
		return [finding(file, "exports", "The exports field must be a subpath map.", isPrivate)];
	}
	const entries = Object.entries(exports);
	const patterns = entries.filter(([key, value]) => key.includes("*") && value !== null);
	const exportsModules = entries.some(([key, value]) => value !== null && !exactAsset(key, value));
	const count =
		patterns.length === 1 || (patterns.length === 0 && !exportsModules)
			? []
			: [finding(file, "exports", `The exports field needs exactly one non-null wildcard; found ${patterns.length}.`, isPrivate)];
	return [
		...count,
		...entries.flatMap(([key, value]) => {
			if (value === null) {
				return [
					finding(file, key, `Export "${key}" blocks module imports with null. Remove the null entry so callers can import each module.`, isPrivate),
				];
			}
			return key === "." || exactAsset(key, value) || standardPattern(key, value, isPrivate)
				? []
				: [finding(file, key, `Export "${key}" does not preserve the module's file path.`, isPrivate)];
		}),
	];
}

export const manifestsExportsShape = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const packages = yield* workspacePackages(inputs);
			const files = ["package.json", ...packages.map((owner) => posix.join(owner.directory, "package.json"))];
			const findings = yield* Effect.forEach(
				files,
				(file) =>
					Effect.gen(function* () {
						const manifest = yield* readPackageManifest(inputs.readText, file);
						if (file === "package.json" && manifest === undefined) {
							return [];
						}
						return [
							...findingsIn(file, manifest?.exports, manifest?.private === true),
							...exportImportFindings(file, manifest?.imports, manifest?.private === true),
						];
					}),
				{ concurrency: "unbounded" },
			);
			return findings.flat();
		}),
	description:
		"Packages export modules through one file-preserving wildcard without null blocks; declared #*.ts and #test/* imports preserve the source and test-support roots. Private packages may export ./src/* through ./* and map #test/* into their own test tree.",
	id: "manifests/exports-shape",
	registrable: false,
});
