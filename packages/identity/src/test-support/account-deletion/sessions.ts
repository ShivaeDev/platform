import { Clock, Effect } from "effect";
import type { SessionStorage } from "#test/account-deletion/host.ts";
import { accountDeletion, addressCode } from "#test/account-deletion/story.ts";

export function sessionsIn(storage: SessionStorage) {
	return accountDeletion.trait("hosting", `the auth declaration keeps sessions with ${storage}`, (setup) => {
		setup.storage = storage;
	});
}

export const cachedAddressCodes = accountDeletion.trait(
	"data",
	"Better Auth holds an email verification code for alice's address and one for bob's",
	function* (setup) {
		const host = setup.host;
		if (host === undefined) {
			return yield* Effect.die("The account deletion host has not started");
		}
		const { internalAdapter } = yield* Effect.promise(() => host.auth.$context);
		const now = yield* Clock.currentTimeMillis;
		for (const name of ["alice", "bob"] as const) {
			yield* Effect.promise(() =>
				internalAdapter.createVerificationValue({ expiresAt: new Date(now + 600_000), identifier: addressCode(name), value: "123456:0" }),
			);
		}
	},
);
