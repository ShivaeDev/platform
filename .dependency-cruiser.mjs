import platformManifest from "./packages/platform/package.json" with { type: "json" };

const alternatives = (names) => `(?:${names.join("|")})`;

const LEAVES = {
	"effect-changes": [],
	"effect-changes-prisma": ["effect-changes"],
	"effect-contract": [],
	"effect-form": [],
	"effect-pg-boss": [],
	"effect-service": [],
	"effect-sql": ["effect-changes"],
	"effect-test": [],
	"heavy-lock": [],
	quality: [],
	"work-board": [],
};
const BROWSER = ["effect-changes", "effect-contract", "effect-form", "effect-react"];
const SERVER = ["effect-changes-prisma", "effect-pg-boss", "effect-prisma", "effect-sql", "effect-trpc", "platform", "work-board"];
const BROWSER_ENTRIES = ["effect-trpc/src/client", "platform/src/errors", "platform/src/rpc"];
const BROWSER_ENTRY_IMPORTS = ["effect"];
const PLATFORM_CORE_ENTRIES = ["errors", "node-http", "rpc", "rpc-server", "runtime"];
const PLATFORM_OPTIONAL_PEERS = Object.entries(platformManifest.peerDependenciesMeta)
	.filter(([, meta]) => meta.optional)
	.map(([name]) => name);
const WORKSPACE_SCOPE = "@shivaedev/";

const sourceOf = (names) => `^packages/${alternatives(names)}/src/`;
const entryOf = (entries) => `^packages/${alternatives(entries)}`;
const packageOf = (name) => `^packages/${name}/`;

export default {
	forbidden: [
		...Object.entries(LEAVES).map(([name, allowed]) => ({
			name: `leaf-${name}`,
			comment: `@shivaedev/${name} is a leaf package: its source imports no other @shivaedev package${allowed.map((other) => ` but @shivaedev/${other}`).join("")}.`,
			severity: "error",
			from: { path: `${packageOf(name)}src/` },
			to: { path: "^packages/", pathNot: `^packages/${alternatives([name, ...allowed])}/` },
		})),
		{
			name: "browser-never-imports-server",
			comment: "Browser packages ship to browsers and never import a server package.",
			severity: "error",
			from: { path: sourceOf(BROWSER) },
			to: { path: `^packages/${alternatives(SERVER)}/` },
		},
		{
			name: "browser-entry-stays-browser-safe",
			comment:
				"A browser entry of a server package ships to browsers: everything it reaches is its own module or folder, or an allowed browser package, never @trpc/server, Node or other server code.",
			severity: "error",
			from: { path: `${entryOf(BROWSER_ENTRIES)}\\.ts$` },
			to: {
				reachable: true,
				pathNot: [`${entryOf(BROWSER_ENTRIES)}(\\.ts$|/)`, `(^|/)node_modules/${alternatives(BROWSER_ENTRY_IMPORTS)}/`],
			},
		},
		{
			name: "platform-core-needs-no-optional-peer",
			comment:
				"The errors, node-http, rpc, rpc-server and runtime entries of @shivaedev/platform work with only effect installed: nothing they reach, as a value or a type, is an optional peer of the package, as its peerDependenciesMeta lists them, or a @better-auth/* package.",
			severity: "error",
			from: { path: `^packages/platform/src/${alternatives(PLATFORM_CORE_ENTRIES)}(\\.ts$|/)` },
			to: {
				reachable: true,
				path: [
					...PLATFORM_OPTIONAL_PEERS.filter((name) => name.startsWith(WORKSPACE_SCOPE)).map((name) => packageOf(name.slice(WORKSPACE_SCOPE.length))),
					`(^|/)node_modules/${alternatives([...PLATFORM_OPTIONAL_PEERS, "@better-auth/[^/]+"])}/`,
				],
			},
		},
		{
			name: "resolvable",
			comment: "Every import in package source resolves, so no boundary goes unchecked.",
			severity: "error",
			from: { path: "^packages/[^/]+/src/" },
			to: { couldNotResolve: true },
		},
	],
	options: {
		doNotFollow: { path: ["node_modules", "(^|/)dist/"] },
		exclude: { path: "(^|/)(coverage|generated)(/|$)" },
		enhancedResolveOptions: {
			conditionNames: ["source", "import"],
			exportsFields: ["exports"],
			extensions: [".ts", ".tsx", ".js", ".d.ts"],
		},
		tsPreCompilationDeps: true,
	},
};
