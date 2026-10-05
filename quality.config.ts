import platformManifest from "./packages/platform/package.json" with { type: "json" };
import { defineConfig } from "./packages/quality/src/config.ts";
import { fence } from "./packages/quality/src/imports/fences/dsl.ts";
import type { Fence } from "./packages/quality/src/imports/fences/model.ts";
import { anyOf, anything, external, folders, modules, packages, scopes, workspace } from "./packages/quality/src/imports/fences/selectors.ts";

const LEAVES: Readonly<Record<string, { readonly allowed: readonly string[]; readonly module: string }>> = {
	"effect-changes": { allowed: [], module: "channel" },
	"effect-changes-prisma": { allowed: ["effect-changes", "types"], module: "changes" },
	"effect-contract": { allowed: ["types"], module: "contract" },
	"effect-form": { allowed: [], module: "form" },
	"effect-pg-boss": { allowed: [], module: "service" },
	"effect-service": { allowed: [], module: "define-service" },
	"effect-sql": { allowed: ["effect-changes"], module: "repository" },
	"effect-test": { allowed: [], module: "vitest" },
	"heavy-lock": { allowed: [], module: "acquire" },
	"local-postgres": { allowed: [], module: "localPostgres" },
	quality: { allowed: ["types"], module: "config" },
	skills: { allowed: [], module: "syncSkills" },
	"test-story": { allowed: [], module: "effect/storyKit" },
	types: { allowed: [], module: "bivariant" },
	"work-board": { allowed: [], module: "board" },
};
const TYPE_ONLY = "@shivaedev/types ships only types, such as Bivariant, so importing it adds no runtime code to the package.";
const BROWSER = ["effect-changes", "effect-contract", "effect-form", "effect-react"];
const SERVER = ["effect-changes-prisma", "effect-pg-boss", "effect-prisma", "effect-sql", "effect-trpc", "local-postgres", "platform", "work-board"];
const BROWSER_FOLDERS = ["packages/effect-trpc/src/client", "packages/platform/src/errors", "packages/platform/src/rpc"];
const PLATFORM_CORE_FOLDERS = ["errors", "node-http", "rpc", "rpc-server", "runtime"].map((folder) => `packages/platform/src/${folder}`);
const WORKSPACE_SCOPE = "@shivaedev/";
const PLATFORM_OPTIONAL_PEERS = Object.entries(platformManifest.peerDependenciesMeta)
	.filter(([, meta]) => meta.optional)
	.map(([name]) => name);

function leaf([name, { allowed, module }]: readonly [string, { readonly allowed: readonly string[]; readonly module: string }]): Fence {
	const source = `packages/${name}/src/${module}.ts`;
	return fence(`leaf-${name}`)
		.because(
			`@shivaedev/${name} is a leaf package: its source imports no other @shivaedev package${allowed.map((other) => ` but @shivaedev/${other}`).join("")}.${allowed.includes("types") ? ` ${TYPE_ONLY}` : ""}`,
		)
		.from(folders(`packages/${name}/src`))
		.mayNotImport(workspace.except(packages(name, ...allowed)))
		.demonstratedBy({
			illegal: [source, `packages/${BROWSER.includes(name) ? "effect-react/src/result-state.ts" : "platform/src/runtime/make.ts"}`],
			legal: [source, external("effect")],
		});
}

const fences: readonly Fence[] = [
	...Object.entries(LEAVES).map(leaf),
	fence("test-story-sync-needs-no-effect")
		.because(
			"effect is an optional peer of @shivaedev/test-story: everything outside its effect folder works with only vitest installed, so nothing it reaches, as a value or a type, is effect.",
		)
		.from(folders("packages/test-story/src").except(folders("packages/test-story/src/effect")))
		.mayNotReach(modules("effect"))
		.demonstratedBy({
			illegal: ["packages/test-story/src/storyKit.ts", external("effect")],
			legal: ["packages/test-story/src/storyKit.ts", external("vitest")],
		}),
	fence("browser-never-imports-server")
		.because("Browser packages ship to browsers and never import a server package.")
		.from(folders(...BROWSER.map((name) => `packages/${name}/src`)))
		.mayNotImport(packages(...SERVER))
		.demonstratedBy({
			illegal: ["packages/effect-react/src/result-state.ts", "packages/effect-sql/src/repository.ts"],
			legal: ["packages/effect-react/src/result-state.ts", "packages/effect-form/src/form.ts"],
		}),
	fence("browser-folder-stays-browser-safe")
		.because(
			"The browser folders of a server package ship to browsers: everything their modules reach stays in those folders or is effect, never @trpc/server, Node or other server code.",
		)
		.from(folders(...BROWSER_FOLDERS))
		.mayNotReach(anything.except(folders(...BROWSER_FOLDERS), modules("effect")))
		.demonstratedBy({
			illegal: ["packages/effect-trpc/src/client/rejection.ts", external("@trpc/server")],
			legal: ["packages/effect-trpc/src/client/rejection.ts", external("effect")],
		}),
	fence("platform-core-needs-no-optional-peer")
		.because(
			"The errors, node-http, rpc, rpc-server and runtime modules of @shivaedev/platform work with only effect installed: nothing they reach, as a value or a type, is an optional peer of the package, as its peerDependenciesMeta lists them, or a @better-auth/* package.",
		)
		.from(folders(...PLATFORM_CORE_FOLDERS))
		.mayNotReach(
			anyOf(
				packages(...PLATFORM_OPTIONAL_PEERS.filter((name) => name.startsWith(WORKSPACE_SCOPE))),
				modules(...PLATFORM_OPTIONAL_PEERS.filter((name) => !name.startsWith(WORKSPACE_SCOPE))),
				scopes("@better-auth"),
			),
		)
		.demonstratedBy({
			illegal: ["packages/platform/src/runtime/make.ts", external("better-auth")],
			legal: ["packages/platform/src/runtime/make.ts", external("effect")],
		}),
];

export default defineConfig({
	rules: {
		"imports/fences": { options: { fences } },
		"imports/resolvable": { options: { generated: ["packages/effect-changes-prisma/src/test-support/generated"] } },
		"suppressions/biome-overrides": {
			options: {
				declared: [
					{
						includes: ["**", "!**/test-support/generated", "!**/test-support/*/generated"],
						reason: "Generated test clients are not source.",
						rule: "files/includes",
					},
					{
						includes: ["packages/effect-test/src/any-test-layer.ts", "packages/effect-trpc/src/testing/any-test-layer.ts"],
						reason:
							"The bound every test Layer must satisfy. Layer's output slot is contravariant, so the only non-any bound is never, and a never bound contextually types the caller's Layer.succeed so its service infers as never and the harness loses its types. any is the only bound that neither rejects nor rewrites the caller's Layer.",
						rule: "lint/suspicious/noExplicitAny",
					},
					{
						includes: ["packages/effect-prisma/src/test-support/controlled-collection.ts"],
						reason:
							"Test doubles for Prisma Next's AsyncIterableResult, a lazy thenable that is also async-iterable. The relation runtime must be exercised against that exact shape, so the doubles define then() and run their query on each consumption.",
						rule: "lint/suspicious/noThenProperty",
					},
					{
						includes: ["packages/effect-test/src/vitest.ts"],
						reason:
							"Vitest parses a fixture's first parameter to discover the fixtures it depends on and throws unless it is an object destructuring pattern. The worker-scoped Layer fixture depends on none, so its pattern is empty.",
						rule: "lint/correctness/noEmptyPattern",
					},
				],
			},
		},
	},
	sources: ["packages", "script"],
});
