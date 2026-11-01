import { DateTime, Effect } from "effect";
import { signInAgain } from "@shivaedev/identity/server/better-auth/testing.ts";
import { admittedMcp } from "./mcp.ts";

export function admittedUser(name: string) {
	return admittedMcp.trait("people", `${name} has an account admitted by the sign-in rule`, function* (engine) {
		const { adapter, internalAdapter } = yield* Effect.promise(() => engine.auth.$context);
		const now = DateTime.toDateUtc(yield* DateTime.now);
		const user = yield* Effect.promise(() =>
			adapter.create<{ readonly id: string }>({
				data: { createdAt: now, email: `${name}@mcp.test`, emailVerified: true, name, role: "user", updatedAt: now },
				model: "user",
			}),
		);
		yield* Effect.promise(() => internalAdapter.createAccount({ accountId: name, providerId: "story", userId: user.id }));
		const session = yield* signInAgain(engine.auth, user.id);
		engine.people.set(name, { cookie: session.headers.get("cookie") ?? "", id: user.id });
	});
}
