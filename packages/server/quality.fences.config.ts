import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anyOf, external, folders, modules, scopes } from "@shivaedev/quality/imports/fences/selectors.ts";
import serverManifest from "./package.json" with { type: "json" };

const SERVER_OPTIONAL_PEERS = Object.entries(serverManifest.peerDependenciesMeta)
	.filter(([, meta]) => meta.optional)
	.map(([name]) => name);

export default [
	fence("server-core-needs-no-optional-peer")
		.because(
			"The node-http, rpc-server and runtime modules of @shivaedev/server work with only effect installed: nothing they reach, as a value or a type, is an optional peer of the package, as its peerDependenciesMeta lists them, or a @better-auth/* package.",
		)
		.from(folders("packages/server/src/node-http", "packages/server/src/rpc-server", "packages/server/src/runtime"))
		.mayNotReach(anyOf(modules(...SERVER_OPTIONAL_PEERS), scopes("@better-auth")))
		.demonstratedBy({
			illegal: ["packages/server/src/runtime/makePlatform.ts", external("better-auth")],
			legal: ["packages/server/src/runtime/makePlatform.ts", external("effect")],
		}),
];
