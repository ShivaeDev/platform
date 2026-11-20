// Operations that return the stored row, or a Redacted in it, each the way an application might by mistake.
export const SERVER_ONLY_PROJECT: Readonly<Record<string, string>> = {
	"src/modules/accounts/accounts.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { ReturnsAccount, ReturnsRow, ReturnsRows, ReturnsSession, ReturnsToken } from "#modules/accounts/operations.ts";

export const Accounts = defineModule({
	name: "accounts",
	operations: [ReturnsRow, ReturnsRows, ReturnsAccount, ReturnsSession, ReturnsToken],
	requires: [],
});
`,
	"src/modules/accounts/holders.ts": `import { Schema } from "effect";
import { Credential } from "#modules/accounts/model.ts";

export class Account extends Schema.Class<Account>("Account")({ credentials: Schema.Array(Credential), name: Schema.String }) {}

export class Session extends Schema.Class<Session>("Session")({ tokens: Schema.Record(Schema.String, Schema.RedactedFromValue(Schema.String)) }) {}
`,
	"src/modules/accounts/operations.ts": `import { Effect, Redacted } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import { Account, Session } from "#modules/accounts/holders.ts";
import { Credential, credentials } from "#modules/accounts/model.ts";

const stored = Effect.succeed(new Credential({ digest: Redacted.make("digest-a"), id: 1, owner: "alice" }));

export const ReturnsRow = query("returnsRow", {
	reads: () => [credentials.list],
	*run() {
		return yield* stored;
	},
});

export const ReturnsRows = query("returnsRows", {
	reads: () => [credentials.list],
	*run() {
		return { owner: "alice", rows: [yield* stored] };
	},
});

export const ReturnsAccount = query("returnsAccount", {
	reads: () => [credentials.list],
	*run() {
		return new Account({ credentials: [yield* stored], name: "alice" });
	},
});

export const ReturnsSession = query("returnsSession", {
	reads: () => [credentials.list],
	*run() {
		const row = yield* stored;
		return new Session({ tokens: { [row.owner]: row.digest } });
	},
});

export const ReturnsToken = query("returnsToken", {
	reads: () => [credentials.list],
	*run() {
		const row = yield* stored;
		return { session: { tokens: [row.digest] } };
	},
});
`,
};
