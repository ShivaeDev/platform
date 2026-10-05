import { isTestCode } from "@shivaedev/quality/naming/testName.ts";
import { type Inventory, isDeclaration } from "#lint/inventory.ts";
import { specifiersOf } from "#lint/rules/specifiers.ts";
import type { Violation } from "#lint/violation.ts";
import { packageOf, workspacePackages } from "#lint/workspace.ts";

const RULE = "browser-safe";
const ALLOWANCE = "it ships to browsers, so it may not reach Node built-ins or Node-only Effect packages";

const BROWSER_PACKAGES = ["@shivaedev/effect-changes", "@shivaedev/effect-contract", "@shivaedev/effect-form", "@shivaedev/effect-react"];

const REACHING = [
	"@effect/platform-node",
	"@effect/platform-node-shared",
	"@effect/sql-pg",
	"@effect/sql-sqlite-node",
	"@effect/vitest",
	"child_process",
	"cluster",
	"dgram",
	"dns",
	"fs",
	"fs/promises",
	"http",
	"http2",
	"https",
	"net",
	"os",
	"path",
	"process",
	"sqlite",
	"tls",
	"worker_threads",
];

const names = (specifier: string, module: string): boolean => specifier === module || specifier.startsWith(`${module}/`);

const reaching = (specifier: string): boolean => specifier.startsWith("node:") || REACHING.some((module) => names(specifier, module));

export const browserSafeViolations = (inventory: Inventory): readonly Violation[] => {
	const packages = workspacePackages(inventory);
	return inventory.sources
		.filter((file) => !(isDeclaration(file.path) || isTestCode(file.path)))
		.flatMap((file) => {
			const owner = packageOf(packages, file.path);
			if (owner === undefined || !BROWSER_PACKAGES.includes(owner.name) || !file.path.startsWith(`${owner.root}/src/`)) {
				return [];
			}
			return specifiersOf(file)
				.filter((specifier) => reaching(specifier.text))
				.map((specifier) => ({
					file: file.path,
					line: specifier.line,
					message: `${owner.name} may not import ${specifier.text}: ${ALLOWANCE}.`,
					rule: RULE,
				}));
		});
};
