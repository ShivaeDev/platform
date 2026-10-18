import { Effect, Option } from "effect";
import { Forbidden, Unauthorized } from "#errors/taxonomy.ts";
import { SessionUser, type SessionUserValue } from "./identity.ts";

export const requireAdmin: Effect.Effect<SessionUserValue, Unauthorized | Forbidden> = Effect.gen(function* () {
	const user = yield* Effect.serviceOption(SessionUser);
	if (Option.isNone(user)) {
		return yield* new Unauthorized({ message: "Authentication required" });
	}
	if (!user.value.role?.split(",").includes("admin")) {
		return yield* new Forbidden({ message: "Administrator role required" });
	}
	return user.value;
});
