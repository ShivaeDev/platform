import { expect } from "vitest";
import { serverKitImports } from "#quality/serverKitImports.ts";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";

ruleKit.it(
	"server kits report private identity imports through values, types, re-exports and intermediate helpers",
	[
		repositoryHas(
			{ content: "export const fixture = 1; export interface Fixture {}", path: "packages/identity/src/test-support/fixture.ts" },
			{
				content: 'import { fixture } from "../../../identity/src/test-support/fixture.ts";',
				path: "packages/server/src/test-support/direct.ts",
			},
			{
				content: 'import type { Fixture } from "../../../identity/src/test-support/fixture.ts";',
				path: "packages/server/src/test-support/types.ts",
			},
			{
				content: 'export { fixture } from "../../../identity/src/test-support/fixture.ts";',
				path: "packages/server/src/test-support/barrel.ts",
			},
			{ content: 'import { fixture } from "./barrel.ts";', path: "packages/server/src/test-support/indirect.ts" },
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(serverKitImports);

		expect(findings.map(({ file }) => file).sort()).toEqual([
			"packages/server/src/test-support/barrel.ts",
			"packages/server/src/test-support/direct.ts",
			"packages/server/src/test-support/indirect.ts",
			"packages/server/src/test-support/types.ts",
		]);
	},
);

ruleKit.it(
	"server kits can use public identity APIs and shared test-sql plumbing",
	[
		repositoryHas(
			{ content: "export const session = 1;", path: "packages/identity/src/server/session.ts" },
			{ content: "export const disconnectProxy = 1;", path: "packages/test-sql/src/server/disconnectProxy.ts" },
			{
				content: [
					'import { session } from "../../../identity/src/server/session.ts";',
					'import { disconnectProxy } from "../../../test-sql/src/server/disconnectProxy.ts";',
				].join("\n"),
				path: "packages/server/src/test-support/host.ts",
			},
		),
	],
	function* ({ checks }) {
		expect(yield* checks(serverKitImports)).toEqual([]);
	},
);
