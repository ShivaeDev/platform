import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect } from "effect";
import { permission } from "@shivaedev/access/permission.ts";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";
import { ORIGIN } from "./harness.ts";

export const ReadDocuments = permission("documents.read");
export const DocumentRoles = roleSet(role("reader", [ReadDocuments]), role("guest", []), role("editor", [ReadDocuments]));

export const liveSubscriptionProvider = Effect.gen(function* () {
	const mounted = yield* betterAuthMount(
		{
			"baseURL": ORIGIN,
			database: yield* betterAuthDatabase(),
			plugins: [testUtils()],
			secret: "live-policy-story-secret-at-least-32-characters",
			session: { cookieCache: { enabled: false } },
		},
		{ defaultRole: "reader", roles: DocumentRoles },
	).pipe(Effect.provide(memoryStore), Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))));
	const context = yield* Effect.promise(() => mounted.auth.$context);
	yield* Effect.promise(() => context.runMigrations());
	return mounted;
});
