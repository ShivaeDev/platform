import { Context, type Effect } from "effect";
import type { AuthSchemaDeclaration } from "#server/better-auth/define.ts";

export class AccountDeletionPolicy extends Context.Service<
	AccountDeletionPolicy,
	{
		readonly auth: Pick<AuthSchemaDeclaration, "options">;
		readonly handOver: (userId: string) => Effect.Effect<void>;
	}
>()("@shivaedev/identity/AccountDeletionPolicy") {}
