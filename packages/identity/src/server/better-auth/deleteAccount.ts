import { Effect } from "effect";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { rateLimit } from "@shivaedev/rate-limit/rateLimit.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { SessionUser } from "#identity.ts";
import { AccountDeletionPolicy } from "#server/better-auth/AccountDeletionPolicy.ts";
import { accountData } from "#server/better-auth/accountData.ts";
import { evictCachedAccount } from "#server/better-auth/adapters/evictCachedAccount.ts";
import { confirmPassword } from "#server/better-auth/confirmPassword.ts";
import { deleteUserRows } from "#server/better-auth/deleteUserRows.ts";
import { sessionKeys } from "#signedInSessions.ts";
import { userKeys } from "#users.ts";

// An erase that cannot run is the operator's to fix, so its failure is reported with its tables rather than answered to the person.
// Cached sessions are evicted last inside the transaction, so a failed eviction deletes nothing and a failed commit only signs out.
export const deleteAccount = Effect.fn("Identity.deleteAccount")(function* (password: string) {
	const { id } = yield* SessionUser;
	const { auth, handOver } = yield* AccountDeletionPolicy;
	// Better Auth's own budget for its password-checked routes such as /change-email, kept per person rather than per address.
	yield* rateLimit({ key: `identity.account.delete:${id}`, per: 3, window: "10 seconds" });
	yield* confirmPassword(auth.options, password);
	yield* Effect.gen(function* () {
		yield* handOver(id);
		yield* accountData(auth)
			.eraseOwnedRows(id)
			.pipe(Effect.catchTags({ OwnedModelsUncollected: Effect.die, OwnedTableCycle: Effect.die, UncoveredUserColumns: Effect.die }));
		yield* deleteUserRows(auth.options);
		yield* evictCachedAccount(auth.options, yield* SessionUser);
		yield* invalidateOnCommit(invalidationKeys([userKeys.item(id), sessionKeys.list]));
	}).pipe(transact());
});
