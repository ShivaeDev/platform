import { CORE, HISTORY, write } from "#test/fixture.ts";
import { workspace } from "#test/workspace.ts";

export const SHELL = "@test/shell";
export const PACKAGE_JSON_ONLY = { "./package.json": "./package.json" };

export function dependencyShell(exports: Readonly<Record<string, string>> = PACKAGE_JSON_ONLY) {
	return workspace.trait(
		"workspace",
		`${SHELL} 0.4.0, a public package exporting ${Object.keys(exports).join(" and ")}, depends on ${CORE} and @test/api`,
		function* ({ root }) {
			yield* write(
				root,
				"packages/shell/package.json",
				JSON.stringify({ dependencies: { "@test/api": "workspace:*", [CORE]: "workspace:*" }, exports, name: SHELL, version: "0.4.0" }),
			);
			yield* write(root, "packages/shell/CHANGELOG.md", HISTORY);
		},
	);
}
