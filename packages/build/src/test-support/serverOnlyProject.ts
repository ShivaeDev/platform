// Operations that return the stored row, or a Redacted in it, each the way an application might by mistake.
export const SERVER_ONLY_PROJECT: Readonly<Record<string, string>> = {
	"src/modules/accounts/accounts.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";
import {
	ReturnsAccount,
	ReturnsFolder,
	ReturnsGrant,
	ReturnsMaybeToken,
	ReturnsNullableToken,
	ReturnsRow,
	ReturnsRows,
	ReturnsSession,
	ReturnsSignIn,
	ReturnsToken,
} from "#modules/accounts/operations.ts";

export const Accounts = defineModule({
	name: "accounts",
	operations: [
		ReturnsRow,
		ReturnsRows,
		ReturnsAccount,
		ReturnsSession,
		ReturnsToken,
		ReturnsMaybeToken,
		ReturnsNullableToken,
		ReturnsSignIn,
		ReturnsGrant,
		ReturnsFolder,
	],
	requires: [],
	wire: {},
});
`,
	"src/modules/accounts/holders.ts": `import { Schema } from "effect";
import { Credential } from "#modules/accounts/model.ts";

export class Account extends Schema.Class<Account>("Account")({ credentials: Schema.Array(Credential), name: Schema.String }) {}

export class Session extends Schema.Class<Session>("Session")({ tokens: Schema.Record(Schema.String, Schema.RedactedFromValue(Schema.String)) }) {}

export class Grant extends Schema.Class<Grant>("Grant")({
	refresh: Schema.Option(Schema.RedactedFromValue(Schema.String)),
	scope: Schema.String,
}) {}

interface FolderEncoded {
	readonly children: readonly FolderEncoded[];
	readonly key: string;
	readonly name: string;
}

// A folder holds folders of its own kind, so its fields lead back to itself before they reach the key.
export class Folder extends Schema.Class<Folder>("Folder")({
	children: Schema.Array(Schema.suspend((): Schema.Codec<Folder, FolderEncoded> => Folder)),
	key: Schema.RedactedFromValue(Schema.String),
	name: Schema.String,
}) {}
`,
	"src/modules/accounts/operations.ts": `import { Effect, Option, Redacted } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import { Account, Folder, Grant, Session } from "#modules/accounts/holders.ts";
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

export const ReturnsMaybeToken = query("returnsMaybeToken", {
	reads: () => [credentials.list],
	*run() {
		const row = yield* stored;
		return { token: Option.some(row.digest) };
	},
});

export const ReturnsNullableToken = query("returnsNullableToken", {
	reads: () => [credentials.list],
	*run() {
		const row = yield* stored;
		return { token: row.owner === "alice" ? row.digest : null };
	},
});

export const ReturnsSignIn = query("returnsSignIn", {
	reads: () => [credentials.list],
	*run() {
		const row = yield* stored;
		return row.owner === "alice"
			? ({ _tag: "Signed", token: row.digest } as const)
			: ({ _tag: "Refused", reason: "unknown owner" } as const);
	},
});

export const ReturnsGrant = query("returnsGrant", {
	reads: () => [credentials.list],
	*run() {
		const row = yield* stored;
		return new Grant({ refresh: Option.some(row.digest), scope: "read" });
	},
});

export const ReturnsFolder = query("returnsFolder", {
	reads: () => [credentials.list],
	*run() {
		const row = yield* stored;
		return new Folder({ children: [], key: row.digest, name: row.owner });
	},
});
`,
};
