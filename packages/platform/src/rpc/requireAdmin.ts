import { Effect } from "effect";
import { Forbidden } from "#errors/taxonomy.ts";
import { SessionUser, type SessionUserValue } from "./identity.ts";

export const requireAdmin: Effect.Effect<SessionUserValue, Forbidden, SessionUser> = Effect.gen(function* () {
	const user = yield* SessionUser;
	if (!user.role?.split(",").includes("admin")) {
		return yield* new Forbidden({ message: "Administrator role required" });
	}
	return user;
});
