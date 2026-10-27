import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anyOf, anything, external, files, folders, modules, packages, scopes } from "@shivaedev/quality/imports/fences/selectors.ts";
import identityManifest from "./package.json" with { type: "json" };

const IDENTITY_OPTIONAL_PEERS = Object.entries(identityManifest.peerDependenciesMeta)
	.filter(([, meta]) => meta.optional)
	.map(([name]) => name);

const browserCode = files("packages/identity/src/identity.ts", "packages/identity/src/middleware.ts", "packages/identity/src/permission.ts");

export default [
	fence("identity-client-stays-browser-safe")
		.because("The identity, middleware and permission modules ship to browsers inside shared RPC declarations and reach only browser-safe code.")
		.from(browserCode)
		.mayNotReach(anything.except(browserCode, files("packages/access/src/permission.ts"), packages("errors"), modules("effect")))
		.demonstratedBy({
			illegal: ["packages/identity/src/identity.ts", external("node:fs")],
			legal: ["packages/identity/src/identity.ts", external("effect")],
		}),
	fence("identity-core-needs-no-optional-peer")
		.because(
			"Everything in @shivaedev/identity outside server/better-auth/ works with only effect installed: nothing it reaches, as a value or a type, is an optional peer of the package, as its peerDependenciesMeta lists them, or a @better-auth/* package.",
		)
		.from(folders("packages/identity/src").except(folders("packages/identity/src/server/better-auth", "packages/identity/src/test-support")))
		.mayNotReach(anyOf(modules(...IDENTITY_OPTIONAL_PEERS), scopes("@better-auth")))
		.demonstratedBy({
			illegal: ["packages/identity/src/server/session.ts", external("better-auth")],
			legal: ["packages/identity/src/server/session.ts", external("effect")],
		}),
];
