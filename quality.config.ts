import platformManifest from "./packages/platform/package.json" with { type: "json" };
import { defineConfig } from "./packages/quality/src/config.ts";
import { fence } from "./packages/quality/src/imports/fences/dsl.ts";
import type { Fence } from "./packages/quality/src/imports/fences/model.ts";
import { anyOf, anything, external, files, folders, modules, packages, scopes, workspace } from "./packages/quality/src/imports/fences/selectors.ts";

const LEAVES: Readonly<Record<string, { readonly allowed: readonly string[]; readonly module: string }>> = {
	"effect-changes": { allowed: [], module: "channel" },
	"effect-changes-prisma": { allowed: ["effect-changes", "types"], module: "changes" },
	"effect-contract": { allowed: ["types"], module: "contract" },
	"effect-form": { allowed: [], module: "form" },
	"effect-pg-boss": { allowed: [], module: "service" },
	"effect-service": { allowed: [], module: "define-service" },
	"effect-sql": { allowed: ["effect-changes"], module: "repository" },
	"effect-test": { allowed: [], module: "vitest" },
	"effect-test-sql": { allowed: ["effect-sql", "effect-test"], module: "postgres" },
	"heavy-lock": { allowed: [], module: "acquire" },
	"local-postgres": { allowed: [], module: "localPostgres" },
	"pr-watch": { allowed: ["effect-service"], module: "Watcher" },
	quality: { allowed: ["types"], module: "config" },
	skills: { allowed: [], module: "syncSkills" },
	"test-story": { allowed: ["effect-test"], module: "storyKit" },
	types: { allowed: [], module: "bivariant" },
	"work-board": { allowed: ["effect-contract", "effect-form", "effect-react", "effect-service", "platform"], module: "board" },
	"work-fleet": { allowed: ["work-board", "effect-contract", "effect-service", "effect-sql", "platform"], module: "fleet" },
};
const TYPE_ONLY = "@shivaedev/types ships only types, such as Bivariant, so importing it adds no runtime code to the package.";
const BROWSER = ["effect-changes", "effect-contract", "effect-form", "effect-react"];
const SERVER = [
	"effect-changes-prisma",
	"effect-pg-boss",
	"effect-prisma",
	"effect-sql",
	"effect-test-sql",
	"effect-trpc",
	"local-postgres",
	"pr-watch",
	"platform",
	"work-board",
	"work-fleet",
];
const BROWSER_FOLDERS = [
	"packages/effect-trpc/src/client",
	"packages/platform/src/errors",
	"packages/platform/src/rpc",
	"packages/work-board/src/browser",
	"packages/work-board/src/path",
];
const BROWSER_FILES = [
	"packages/work-board/src/attention/RequestReceipt.ts",
	"packages/work-board/src/metadata/schema.ts",
	"packages/work-board/src/render/callouts.ts",
	"packages/work-board/src/render/code.ts",
	"packages/work-board/src/render/documentHeadings.ts",
	"packages/work-board/src/render/documentLinks.ts",
	"packages/work-board/src/render/documentPlugins.ts",
	"packages/work-board/src/render/failed.ts",
	"packages/work-board/src/render/footnotes.ts",
	"packages/work-board/src/render/questionnaireDocuments.ts",
	"packages/work-board/src/render/textContent.ts",
	"packages/work-board/src/render/visual.ts",
	"packages/work-board/src/render/visualDocuments.ts",
	"packages/work-board/src/render/visualFields.ts",
	"packages/work-board/src/files/url.ts",
	"packages/work-board/src/rpc/contract.ts",
	"packages/work-board/src/rpc/responseContract.ts",
	"packages/work-board/src/rpc/handoffContract.ts",
	"packages/work-board/src/rpc/keys.ts",
	"packages/work-board/src/rpc/pageKeys.ts",
	"packages/work-board/src/history/schema.ts",
];
const BROWSER_CODE = anyOf(folders(...BROWSER_FOLDERS), files(...BROWSER_FILES));
const MARKDOWN_CODE = anyOf(folders("packages/work-board/src/browser/document"), files(...BROWSER_FILES.filter((file) => file.includes("/render/"))));
const MARKDOWN_MODULES = modules(
	"react",
	"react-markdown",
	"rehype-raw",
	"remark-directive",
	"remark-gfm",
	"unified",
	"unist-util-visit",
	"shiki",
	"mermaid",
	"hast",
	"mdast",
	"mdast-util-directive",
);
const PLATFORM_CORE_FOLDERS = ["errors", "node-http", "rpc", "rpc-server", "runtime"].map((folder) => `packages/platform/src/${folder}`);
const WORKSPACE_SCOPE = "@shivaedev/";
const PLATFORM_OPTIONAL_PEERS = Object.entries(platformManifest.peerDependenciesMeta)
	.filter(([, meta]) => meta.optional)
	.map(([name]) => name);

function leaf([name, { allowed, module }]: readonly [string, { readonly allowed: readonly string[]; readonly module: string }]): Fence {
	const source = `packages/${name}/src/${module}.ts`;
	let illegal = "effect-sql/src/repository.ts";
	if (!allowed.includes("effect-react")) {
		illegal = BROWSER.includes(name) || allowed.includes("platform") ? "effect-react/src/result-state.ts" : "platform/src/runtime/make.ts";
	}
	return fence(`leaf-${name}`)
		.because(
			`@shivaedev/${name} is a leaf package: its source imports no other @shivaedev package${allowed.map((other) => ` but @shivaedev/${other}`).join("")}.${allowed.includes("types") ? ` ${TYPE_ONLY}` : ""}`,
		)
		.from(folders(`packages/${name}/src`))
		.mayNotImport(workspace.except(packages(name, ...allowed)))
		.demonstratedBy({
			illegal: [source, `packages/${illegal}`],
			legal: [source, external("effect")],
		});
}

const fences: readonly Fence[] = [
	...Object.entries(LEAVES).map(leaf),
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
			"The browser folders of a server package ship to browsers: everything their modules reach stays in those folders or is effect or the browser-safe effect-contract, effect-form, effect-react and React UI libraries, never @trpc/server, Node or other server code.",
		)
		.from(BROWSER_CODE.except(MARKDOWN_CODE))
		.mayNotReach(
			anything.except(
				BROWSER_CODE,
				packages("effect-contract", "effect-form", "effect-react", "types"),
				modules(
					"effect",
					"react",
					"react-dom",
					"@effect/atom-react",
					"@tanstack/react-router",
					"clsx",
					"tailwind-merge",
					"class-variance-authority",
					"lucide-react",
				),
			),
		)
		.demonstratedBy({
			illegal: ["packages/effect-trpc/src/client/rejection.ts", external("@trpc/server")],
			legal: ["packages/work-board/src/browser/handoffs/form.ts", "packages/effect-form/src/form.ts"],
		}),
	fence("document-rendering-stays-browser-safe")
		.because(
			"The React document view and its shared Markdown plugins reach only browser-safe Board data, Effect and the existing Markdown libraries.",
		)
		.from(MARKDOWN_CODE)
		.mayNotReach(anything.except(BROWSER_CODE, packages("effect-contract", "effect-form", "types"), modules("effect"), MARKDOWN_MODULES))
		.demonstratedBy({
			illegal: ["packages/work-board/src/browser/document/View.ts", external("node:fs")],
			legal: ["packages/work-board/src/browser/document/View.ts", external("react-markdown")],
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
	preCommit: { run: ["node --conditions=source script/lint.ts", "pnpm changelog:check", "pnpm typecheck"] },
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
							"The bound every test Layer must satisfy. Layer's output slot is contravariant, so the only non-any bound is never, and a never bound contextually types the caller's Layer.succeed so its service infers as never and the harness loses its types. any is the only bound that neither rejects nor rewrites the caller's Layer. effect-test's bound adds a never-output member so it also takes a Layer that provides nothing, such as Layer.empty.",
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
