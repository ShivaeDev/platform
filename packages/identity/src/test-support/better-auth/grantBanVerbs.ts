import type { AuthContext } from "better-auth";
import { Clock, Effect } from "effect";
import * as TestClock from "effect/testing/TestClock";

export function grantBanVerbs(
	auth: { readonly $context: Promise<Pick<AuthContext, "internalAdapter">> },
	userId: (name: "alice" | "bob") => string,
	tell: (line: string) => void,
) {
	return {
		ban: (name: "alice" | "bob", temporary: boolean) =>
			Effect.gen(function* () {
				tell(`${name} has a ${temporary ? "temporary" : "permanent"} ban`);
				const now = yield* Clock.currentTimeMillis;
				const { internalAdapter } = yield* Effect.promise(() => auth.$context);
				yield* Effect.promise(() =>
					internalAdapter.updateUser(userId(name), { banExpires: temporary ? new Date(now + 3_600_000) : null, banned: true }),
				);
			}),
		timePasses: (milliseconds: number) => {
			tell(`${milliseconds} milliseconds pass on the Effect clock`);
			return TestClock.adjust(milliseconds);
		},
	};
}
