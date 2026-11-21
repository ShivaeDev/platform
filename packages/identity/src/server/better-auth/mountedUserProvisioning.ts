import { Effect, Layer } from "effect";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { betterAuthUserProvisioning } from "#server/better-auth/adapters/userProvisioning.ts";
import type { AuthDeclaration } from "#server/better-auth/define.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";

export function mountedUserProvisioning(auth: AuthDeclaration) {
	return Layer.unwrap(
		betterAuthMount({ ...auth, options: { emailAndPassword: { enabled: true }, ...auth.options } }).pipe(
			Effect.map((mounted) => betterAuthUserProvisioning(mounted.auth)),
			Effect.provide(memoryStore),
		),
	);
}
