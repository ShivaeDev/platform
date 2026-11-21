import type { BetterAuthOptions } from "better-auth";
import { Effect } from "effect";
import { PreconditionFailed } from "@shivaedev/errors/taxonomy.ts";

// Better Auth answers a session kept in secondary storage with the user it cached there, and only the mounted instance's internal
// adapter can revoke it, so a deletion there would leave the person's sessions acting for an id that no longer exists.
export const revocableSessions = Effect.fn("Identity.revocableSessions")(function* (options: Omit<BetterAuthOptions, "database">) {
	if (options.secondaryStorage !== undefined) {
		return yield* new PreconditionFailed({ message: "This app cannot delete accounts. Ask its operator to delete yours." });
	}
});
