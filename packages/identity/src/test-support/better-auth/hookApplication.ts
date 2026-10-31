import { Context, Data, Effect } from "effect";
import type { BetterAuthDatabaseHooks } from "#server/better-auth/databaseHooks.ts";
import { policyProbe } from "#test/sign-in-policy/requestWork.ts";

class AdmissionRefused extends Data.TaggedError("AdmissionRefused")<{
	readonly code: string;
	readonly message: string;
}> {}

export class Admission extends Context.Service<Admission, { readonly check: (userId: string) => Effect.Effect<void, AdmissionRefused> }>()(
	"identity/test/Admission",
) {}

export const hookApplication = Effect.gen(function* () {
	const probe = yield* policyProbe;
	const users = new Map<string, string>();
	const state = { defective: false, nativeRefuses: false, policyRefuses: false, userHooks: false, userTransforms: true };
	function admission(allowed: string) {
		return {
			check: (userId: string) =>
				probe.check(
					Effect.gen(function* () {
						if (state.defective) {
							return yield* Effect.die(new Error("Application session hook broke"));
						}
						if (users.get(userId) !== allowed) {
							return yield* Effect.fail(new AdmissionRefused({ code: "MEMBERS_ONLY", message: "Membership is required" }));
						}
						yield* Effect.logInfo("Application session admitted");
					}).pipe(Effect.withSpan("application.session-hook")),
				),
		};
	}
	const hooks: BetterAuthDatabaseHooks<Admission> = {
		session: { create: { before: (session) => Effect.flatMap(Admission, ({ check }) => check(session.userId)) } },
	};
	return { admission, hooks, probe, state, users };
});

export type HookApplication = Effect.Success<typeof hookApplication>;

export function userCreationHooks(transform: boolean): BetterAuthDatabaseHooks {
	return {
		user: {
			create: {
				after: (user) => Effect.logInfo("Application user created", user.name),
				before: (user) => Effect.succeed(transform ? { data: { ...user, name: `${user.name} admitted` } } : true),
			},
		},
	};
}
