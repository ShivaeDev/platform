import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anyOf, external, files, folders, modules, scopes } from "@shivaedev/quality/imports/fences/selectors.ts";
import serverManifest from "#manifest" with { type: "json" };

const SERVER_OPTIONAL_PEERS = Object.entries(serverManifest.peerDependenciesMeta)
	.filter(([, meta]) => meta.optional)
	.map(([name]) => name);

export default [
	fence("server-core-needs-no-optional-peer")
		.because(
			"The Node runtime and subscription adapters and the node-http, rpc-server and runtime modules of @shivaedev/server work with only effect installed: nothing they reach, as a value or a type, is an optional peer of the package, as its peerDependenciesMeta lists them, or a @better-auth/* package.",
		)
		.from(
			anyOf(
				folders("packages/server/src/node-http", "packages/server/src/rpc-server", "packages/server/src/runtime"),
				files("packages/server/src/adapters/makePlatformRuntime.ts", "packages/server/src/adapters/subscriptionSignal.ts"),
			),
		)
		.mayNotReach(anyOf(modules(...SERVER_OPTIONAL_PEERS), scopes("@better-auth")))
		.demonstratedBy({
			illegal: ["packages/server/src/adapters/makePlatformRuntime.ts", external("better-auth")],
			legal: ["packages/server/src/adapters/makePlatformRuntime.ts", external("effect")],
		}),
];
