import { Effect } from "effect";
import { Forbidden } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { hasRole } from "./hasRole.ts";
import { SessionUser, type SessionUserValue } from "./identity.ts";

export const requireAdmin: Effect.Effect<SessionUserValue, Forbidden, SessionUser> = Effect.gen(function* () {
	const user = yield* SessionUser;
	if (!hasRole(user, "admin")) {
		return yield* new Forbidden({ message: "Administrator role required" });
	}
	return user;
});
