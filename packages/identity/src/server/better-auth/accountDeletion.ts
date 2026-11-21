import { type Context, Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { Store } from "@shivaedev/rate-limit/Store.ts";
import { AccountDeletion } from "#server/AccountDeletion.ts";
import { AccountDeletionPolicy } from "#server/better-auth/AccountDeletionPolicy.ts";
import type { AuthSchemaDeclaration } from "#server/better-auth/define.ts";
import { deleteAccount } from "#server/better-auth/deleteAccount.ts";

export interface AccountHandOver<E> {
	readonly handOver: (userId: string) => Effect.Effect<void, E>;
}

export interface AccountDeletionOptions<TIdentifier, E> {
	readonly handOver?: Context.Service<TIdentifier, AccountHandOver<E>> | undefined;
}

// A hand-over's failure is the application's to fix, so it is reported rather than answered to the person.
export function accountDeletion<TIdentifier = never, E = never>(
	auth: Pick<AuthSchemaDeclaration, "options">,
	options: AccountDeletionOptions<TIdentifier, E> = {},
) {
	return Layer.effect(AccountDeletion)(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const reactivity = yield* Reactivity.Reactivity;
			const store = yield* Store;
			const service = options.handOver === undefined ? undefined : yield* options.handOver;
			const policy = {
				auth,
				handOver: (userId: string) => (service === undefined ? Effect.void : Effect.orDie(service.handOver(userId))),
			};
			return AccountDeletion.of({
				delete: (password) =>
					deleteAccount(password).pipe(
						Effect.provideService(AccountDeletionPolicy, policy),
						Effect.provideService(SqlClient.SqlClient, sql),
						Effect.provideService(Reactivity.Reactivity, reactivity),
						Effect.provideService(Store, store),
					),
			});
		}),
	);
}
