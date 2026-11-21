import { Effect, Layer } from "effect";
import { AccountDeletion } from "#server/AccountDeletion.ts";
import { AccountDeletionPolicy } from "#server/better-auth/AccountDeletionPolicy.ts";
import { boundHandOver } from "#server/better-auth/adapters/boundHandOver.ts";
import type { AuthSchemaDeclaration } from "#server/better-auth/define.ts";
import { deleteAccount } from "#server/better-auth/deleteAccount.ts";

export interface AccountDeletionOptions<E, R> {
	readonly handOver?: ((userId: string) => Effect.Effect<void, E, R>) | undefined;
}

export function accountDeletion<E = never, R = never>(auth: Pick<AuthSchemaDeclaration, "options">, options: AccountDeletionOptions<E, R> = {}) {
	return Layer.effect(AccountDeletion)(
		Effect.map(boundHandOver(options.handOver), (handOver) =>
			AccountDeletion.of({ delete: (password) => deleteAccount(password).pipe(Effect.provideService(AccountDeletionPolicy, { auth, handOver })) }),
		),
	);
}
