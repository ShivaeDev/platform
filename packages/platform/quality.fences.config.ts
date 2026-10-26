import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anyOf, anything, external, files, folders, modules, packages, scopes } from "@shivaedev/quality/imports/fences/selectors.ts";
import platformManifest from "./package.json" with { type: "json" };

const PLATFORM_OPTIONAL_PEERS = Object.entries(platformManifest.peerDependenciesMeta)
	.filter(([, meta]) => meta.optional)
	.map(([name]) => name);

const browserCode = folders("packages/platform/src/rpc");

export default [
	fence("platform-client-stays-browser-safe")
		.because("The rpc modules ship to browsers and reach only browser-safe code.")
		.from(browserCode)
		.mayNotReach(
			anything.except(browserCode, files("packages/access/src/permission.ts"), packages("contract", "form", "react", "types"), modules("effect")),
		)
		.demonstratedBy({
			illegal: ["packages/platform/src/rpc/identity.ts", external("node:fs")],
			legal: ["packages/platform/src/rpc/identity.ts", external("effect")],
		}),
	fence("platform-core-needs-no-optional-peer")
		.because(
			"The rpc, node-http, rpc-server and runtime modules of @shivaedev/platform work with only effect installed: nothing they reach, as a value or a type, is an optional peer of the package, as its peerDependenciesMeta lists them, or a @better-auth/* package.",
		)
		.from(
			folders(
				"packages/platform/src/rpc",
				"packages/platform/src/server/node-http",
				"packages/platform/src/server/rpc-server",
				"packages/platform/src/server/runtime",
			),
		)
		.mayNotReach(anyOf(modules(...PLATFORM_OPTIONAL_PEERS), scopes("@better-auth")))
		.demonstratedBy({
			illegal: ["packages/platform/src/server/runtime/makePlatform.ts", external("better-auth")],
			legal: ["packages/platform/src/server/runtime/makePlatform.ts", external("effect")],
		}),
];
