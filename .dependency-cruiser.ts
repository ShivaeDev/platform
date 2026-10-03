import type { IConfiguration, IForbiddenRuleType } from "dependency-cruiser";
import platformManifest from "./packages/platform/package.json" with { type: "json" };

const alternatives = (names: readonly string[]) => `(?:${names.join("|")})`;

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
const BROWSER_ENTRIES = ["effect-trpc/src/client", "platform/src/errors", "platform/src/rpc"];
const BROWSER_ENTRY_IMPORTS = ["effect"];
const PLATFORM_CORE_ENTRIES = ["errors", "node-http", "rpc", "rpc-server", "runtime"];
const PLATFORM_OPTIONAL_PEERS = Object.entries(platformManifest.peerDependenciesMeta)
	.filter(([, meta]) => meta.optional)
	.map(([name]) => name);
const WORKSPACE_SCOPE = "@shivaedev/";

const sourceOf = (names: readonly string[]) => `^packages/${alternatives(names)}/src/`;
const entryOf = (entries: readonly string[]) => `^packages/${alternatives(entries)}`;
const packageOf = (name: string) => `^packages/${name}/`;

export default {
	forbidden: [
		...Object.entries(LEAVES).map<IForbiddenRuleType>(([name, allowed]) => ({
			comment: `@shivaedev/${name} is a leaf package: its source imports no other @shivaedev package${allowed.map((other) => ` but @shivaedev/${other}`).join("")}.`,
			from: { path: `${packageOf(name)}src/` },
			name: `leaf-${name}`,
			severity: "error",
			to: { path: "^packages/", pathNot: `^packages/${alternatives([name, ...allowed])}/` },
		})),
		{
			comment: "Browser packages ship to browsers and never import a server package.",
			from: { path: sourceOf(BROWSER) },
			name: "browser-never-imports-server",
			severity: "error",
			to: { path: `^packages/${alternatives(SERVER)}/` },
		},
		{
			comment:
				"A browser entry of a server package ships to browsers: everything it reaches is its own module or folder, or an allowed browser package, never @trpc/server, Node or other server code.",
			from: { path: `${entryOf(BROWSER_ENTRIES)}\\.ts$` },
			name: "browser-entry-stays-browser-safe",
			severity: "error",
			to: {
				pathNot: [`${entryOf(BROWSER_ENTRIES)}(\\.ts$|/)`, `(^|/)node_modules/${alternatives(BROWSER_ENTRY_IMPORTS)}/`],
				reachable: true,
			},
		},
		{
			comment:
				"The errors, node-http, rpc, rpc-server and runtime entries of @shivaedev/platform work with only effect installed: nothing they reach, as a value or a type, is an optional peer of the package, as its peerDependenciesMeta lists them, or a @better-auth/* package.",
			from: { path: `^packages/platform/src/${alternatives(PLATFORM_CORE_ENTRIES)}(\\.ts$|/)` },
			name: "platform-core-needs-no-optional-peer",
			severity: "error",
			to: {
				path: [
					...PLATFORM_OPTIONAL_PEERS.filter((name) => name.startsWith(WORKSPACE_SCOPE)).map((name) => packageOf(name.slice(WORKSPACE_SCOPE.length))),
					`(^|/)node_modules/${alternatives([...PLATFORM_OPTIONAL_PEERS, "@better-auth/[^/]+"])}/`,
				],
				reachable: true,
			},
		},
		{
			comment: "Every import in package source resolves, so no boundary goes unchecked.",
			from: { path: "^packages/[^/]+/src/" },
			name: "resolvable",
			severity: "error",
			to: { couldNotResolve: true },
		},
	],
	options: {
		doNotFollow: { path: ["node_modules", "(^|/)dist/"] },
		enhancedResolveOptions: {
			conditionNames: ["source", "import"],
			exportsFields: ["exports"],
			extensions: [".ts", ".tsx", ".js", ".d.ts"],
		},
		exclude: { path: "(^|/)(coverage|generated)(/|$)" },
		tsPreCompilationDeps: true,
	},
} satisfies IConfiguration;
