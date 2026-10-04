import platformManifest from "./packages/platform/package.json" with { type: "json" };
import {
	anyOf,
	anything,
	defineConfig,
	external,
	type Fence,
	fence,
	files,
	folders,
	modules,
	packages,
	scopes,
	workspace,
} from "./packages/quality/src/index.ts";

const PACKAGE_ENTRIES = [
	"packages/*/src/index.ts",
	"packages/effect-form/src/react.ts",
	"packages/effect-react/src/form.ts",
	"packages/effect-prisma/src/sqlite.ts",
	"packages/effect-prisma/src/testing.ts",
	"packages/effect-trpc/src/client.ts",
	"packages/effect-trpc/src/testing.ts",
	"packages/platform/src/better-auth.ts",
	"packages/platform/src/errors.ts",
	"packages/platform/src/node-http.ts",
	"packages/platform/src/rpc-server.ts",
	"packages/platform/src/rpc.ts",
	"packages/platform/src/runtime.ts",
	"packages/platform/src/testing.ts",
] as const;

const LEAVES: Readonly<Record<string, readonly string[]>> = {
	"effect-changes": [],
	"effect-changes-prisma": ["effect-changes"],
	"effect-contract": [],
	"effect-form": [],
	"effect-pg-boss": [],
	"effect-service": [],
	"effect-sql": ["effect-changes"],
	"effect-test": [],
	"heavy-lock": [],
	"local-postgres": [],
	quality: [],
	"work-board": [],
};
const BROWSER = ["effect-changes", "effect-contract", "effect-form", "effect-react"];
const SERVER = ["effect-changes-prisma", "effect-pg-boss", "effect-prisma", "effect-sql", "effect-trpc", "local-postgres", "platform", "work-board"];
const BROWSER_ENTRIES = ["packages/effect-trpc/src/client", "packages/platform/src/errors", "packages/platform/src/rpc"];
const PLATFORM_CORE_ENTRIES = ["errors", "node-http", "rpc", "rpc-server", "runtime"].map((entry) => `packages/platform/src/${entry}`);
const WORKSPACE_SCOPE = "@shivaedev/";
const PLATFORM_OPTIONAL_PEERS = Object.entries(platformManifest.peerDependenciesMeta)
	.filter(([, meta]) => meta.optional)
	.map(([name]) => name);

function entries(paths: readonly string[]) {
	return anyOf(files(...paths.map((path) => `${path}.ts`)), folders(...paths));
}

function leaf([name, allowed]: readonly [string, readonly string[]]): Fence {
	const index = `packages/${name}/src/index.ts`;
	return fence(`leaf-${name}`)
		.because(
			`@shivaedev/${name} is a leaf package: its source imports no other @shivaedev package${allowed.map((other) => ` but @shivaedev/${other}`).join("")}.`,
		)
		.from(folders(`packages/${name}/src`))
		.mayNotImport(workspace.except(packages(name, ...allowed)))
		.demonstratedBy({
			illegal: [index, `packages/${BROWSER.includes(name) ? "effect-react" : "platform"}/src/index.ts`],
			legal: [index, external("effect")],
		});
}

const fences: readonly Fence[] = [
	...Object.entries(LEAVES).map(leaf),
	fence("browser-never-imports-server")
		.because("Browser packages ship to browsers and never import a server package.")
		.from(folders(...BROWSER.map((name) => `packages/${name}/src`)))
		.mayNotImport(packages(...SERVER))
		.demonstratedBy({
			illegal: ["packages/effect-react/src/index.ts", "packages/effect-sql/src/index.ts"],
			legal: ["packages/effect-react/src/index.ts", "packages/effect-form/src/index.ts"],
		}),
	fence("browser-entry-stays-browser-safe")
		.because(
			"A browser entry of a server package ships to browsers: everything it reaches is its own module or folder, or an allowed browser package, never @trpc/server, Node or other server code.",
		)
		.from(files(...BROWSER_ENTRIES.map((entry) => `${entry}.ts`)))
		.mayNotReach(anything.except(entries(BROWSER_ENTRIES), modules("effect")))
		.demonstratedBy({
			illegal: ["packages/effect-trpc/src/client.ts", external("@trpc/server")],
			legal: ["packages/effect-trpc/src/client.ts", "packages/effect-trpc/src/client/link.ts", external("effect")],
		}),
	fence("platform-core-needs-no-optional-peer")
		.because(
			"The errors, node-http, rpc, rpc-server and runtime entries of @shivaedev/platform work with only effect installed: nothing they reach, as a value or a type, is an optional peer of the package, as its peerDependenciesMeta lists them, or a @better-auth/* package.",
		)
		.from(entries(PLATFORM_CORE_ENTRIES))
		.mayNotReach(
			anyOf(
				packages(...PLATFORM_OPTIONAL_PEERS.filter((name) => name.startsWith(WORKSPACE_SCOPE))),
				modules(...PLATFORM_OPTIONAL_PEERS.filter((name) => !name.startsWith(WORKSPACE_SCOPE))),
				scopes("@better-auth"),
			),
		)
		.demonstratedBy({
			illegal: ["packages/platform/src/runtime.ts", "packages/platform/src/runtime/make.ts", external("better-auth")],
			legal: ["packages/platform/src/runtime.ts", "packages/platform/src/runtime/make.ts", external("effect")],
		}),
];

export default defineConfig({
	adopt: ["biome", "imports/aliased"],
	rules: {
		"imports/fences": { options: { fences } },
		"imports/resolvable": { options: { generated: ["packages/effect-changes-prisma/test/generated"] } },
		"suppressions/biome-overrides": {
			options: {
				declared: [
					{
						includes: ["**", "!**/test/generated", "!**/test/*/generated"],
						reason: "Generated test clients are not source.",
						rule: "files/includes",
					},
					{
						includes: PACKAGE_ENTRIES,
						reason: "Package entry points are the files that re-export a package's public modules.",
						rule: "lint/performance/noBarrelFile",
					},
					{
						includes: PACKAGE_ENTRIES,
						reason: "Package entry points are the files that re-export a package's public modules.",
						rule: "lint/performance/noReExportAll",
					},
					{
						includes: ["packages/effect-test/src/any-test-layer.ts", "packages/effect-trpc/src/testing/any-test-layer.ts"],
						reason:
							"The bound every test Layer must satisfy. Layer's output slot is contravariant, so the only non-any bound is never, and a never bound contextually types the caller's Layer.succeed so its service infers as never and the harness loses its types. any is the only bound that neither rejects nor rewrites the caller's Layer.",
						rule: "lint/suspicious/noExplicitAny",
					},
					{
						includes: ["packages/effect-prisma/test/support/controlled-collection.ts"],
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
