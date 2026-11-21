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

export const lostSessionList = accountDeletion.trait(
	"data",
	"the secondary storage has lost the list of alice's sessions, so only Better Auth's revoked-before time can end hers",
	function* (setup) {
		const storage = setup.host?.auth.options.secondaryStorage;
		const alice = setup.people.get("alice");
		if (storage === undefined || alice === undefined) {
			return yield* Effect.die("The trait needs a host with secondary storage and alice's account");
		}
		yield* Effect.promise(async () => await storage.delete(`active-sessions-${alice.id}`));
	},
);
