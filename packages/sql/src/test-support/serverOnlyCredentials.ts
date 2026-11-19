import { Cause, Effect, Option, Redacted, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { collection } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import type { RepositoryBuildError } from "#repositoryCollection.ts";
import { serverOnly } from "#serverOnly.ts";
import { onPostgres } from "#test/engines.ts";
import { attempt } from "#test/outcome.ts";
import { RecordedLogs } from "#test/RecordedLogs.ts";
import { ownTable, uniqueTable } from "#test/writeTables.ts";

export class Credential extends Model.Class<Credential>("Credential")({
	digest: serverOnly(Schema.String),
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	owner: Schema.String,
}) {}

const digestAsBucket = Model.Field({
	...serverOnly(Schema.String).schemas,
	select: serverOnly(Schema.String).schemas.select.annotate({ "@shivaedev/changes/bucket": true }),
});

class BucketedCredential extends Model.Class<BucketedCredential>("BucketedCredential")({
	digest: digestAsBucket,
	id: Schema.Number,
	owner: Schema.String,
}) {}

// What a handler holding the field sees: the value opened through Redacted, and how the value prints.
function shown(value: unknown) {
	return Redacted.isRedacted(value) ? { opened: Redacted.value(value), printed: String(value) } : { plain: value };
}

const credentialEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const table = uniqueTable("server_only_credentials");
	yield* ownTable(sql, table, sql`id integer generated always as identity primary key, owner text not null, digest text not null unique`);
	return {
		credentials: yield* makeRepository(Credential, { conflictColumns: ["digest"], idColumn: "id", spanPrefix: "Credential", tableName: table }),
		ids: new Map<string, number>(),
		sql,
		table,
	};
});

type CredentialEngine = Effect.Success<ReturnType<typeof credentialEngine>>;

function idOf(engine: CredentialEngine, owner: string) {
	const id = engine.ids.get(owner);
	return id === undefined ? Effect.die(new Error(`Issue a credential to ${owner} first`)) : Effect.succeed(id);
}

function issue(engine: CredentialEngine, owner: string, digest: string) {
	return Effect.map(engine.credentials.insert({ digest: Redacted.make(digest), owner }), (saved) => {
		engine.ids.set(owner, saved.id);
	});
}

function owners(rows: readonly { readonly owner: string }[]) {
	return rows.map(({ owner }) => owner).sort();
}

const refusals: Record<ServerOnlyRole, () => Effect.Effect<unknown, RepositoryBuildError, SqlClient.SqlClient>> = {
	"a bucket": () =>
		makeRepository(BucketedCredential, {
			collection: collection("refused_credentials", Schema.Number, { digest: Schema.String }),
			idColumn: "id",
			spanPrefix: "Refused",
			tableName: "refused_credentials",
		}),
	"a tuple bucket column": () =>
		makeRepository(Credential, {
			collection: collection("refused_credentials", Schema.Number, {}, { ownerDigest: ["owner", "digest"] }),
			idColumn: "id",
			spanPrefix: "Refused",
			tableName: "refused_credentials",
		}),
	"the ID column": () => makeRepository(Credential, { idColumn: "digest", spanPrefix: "Refused", tableName: "refused_credentials" }),
} as const;

export type ServerOnlyRole = "a bucket" | "a tuple bucket column" | "the ID column";

export const serverOnlyCredentials = storyKit({
	...onPostgres,
	create: credentialEngine,
	name: "PostgreSQL server-only credentials",
	stages: ["credentials"],
	verbs: (engine, story) => {
		const { credentials, sql, table } = engine;
		return {
			credential: (owner: string) =>
				Effect.flatMap(idOf(engine, owner), (id) =>
					attempt(Effect.map(credentials.findById(id), (row) => ({ digest: shown(row.digest), owner: row.owner }))),
				),
			issue: (owner: string, digest: string) =>
				Effect.suspend(() => {
					story.tell(`${owner} is issued a credential whose digest is ${digest}`);
					return attempt(issue(engine, owner, digest));
				}),
			latestPerOwner: () =>
				attempt(
					Effect.map(credentials.latestPerGroup({ limit: 1, orderBy: [{ direction: "desc", field: "id" }], partitionBy: ["owner"] }), (rows) =>
						rows.map((row) => ({ digest: shown(row.digest), owner: row.owner })),
					),
				),
			loggedCredential: (owner: string) =>
				Effect.gen(function* () {
					story.tell(`${owner}'s credential row is logged, and a defect carries it`);
					const row = yield* credentials.findById(yield* idOf(engine, owner));
					yield* Effect.logWarning(row);
					const logs = yield* RecordedLogs;
					return { defect: Cause.pretty(Cause.die(row)), logged: JSON.stringify(logs.at(-1)?.message) };
				}),
			ownersWithDigest: (digest: string) => attempt(Effect.map(credentials.findMany({ where: { digest: Redacted.make(digest) } }), owners)),
			ownersWithDigestIn: (digests: readonly string[]) =>
				attempt(Effect.map(credentials.findMany({ where: { digest: { in: digests.map((digest) => Redacted.make(digest)) } } }), owners)),
			projected: (owner: string) =>
				attempt(Effect.map(credentials.findMany({ select: ["digest"], where: { owner } }), (rows) => rows.map((row) => shown(row.digest)))),
			register: (role: ServerOnlyRole) =>
				Effect.suspend(() => {
					story.tell(`a repository is built with the server-only digest as ${role}`);
					return refusals[role]().pipe(Effect.match({ onFailure: (error) => `${error._tag}: ${error.message}`, onSuccess: () => "built" }));
				}),
			reissueIgnoringTaken: (owner: string, digest: string) =>
				Effect.suspend(() => {
					story.tell(`${owner} is issued the digest ${digest} unless another credential already holds it`);
					return attempt(
						Effect.map(credentials.insertOrIgnore({ digest: Redacted.make(digest), owner }), (row) => (Option.isSome(row) ? "inserted" : "ignored")),
					);
				}),
			revokeBatched: (digest: string) =>
				Effect.suspend(() => {
					story.tell(`credentials with the digest ${digest} are revoked in batches`);
					return attempt(credentials.deleteBatched({ batchSize: 10, maxRows: 10, pause: 0, where: { digest: Redacted.make(digest) } }));
				}),
			rotate: (owner: string, digest: string) =>
				Effect.suspend(() => {
					story.tell(`${owner}'s credential is rotated to the digest ${digest}`);
					return attempt(
						Effect.gen(function* () {
							const current = yield* credentials.findById(yield* idOf(engine, owner));
							const saved = yield* credentials.update({ ...current, digest: Redacted.make(digest) });
							return shown(saved.digest);
						}),
					);
				}),
			storedDigests: () =>
				Effect.map(sql<{ readonly owner: string; readonly digest: unknown }>`select owner, digest from ${sql(table)} order by owner`, (rows) =>
					rows.map(({ digest, owner }) => [owner, digest]),
				),
			transferByDigest: (owner: string, digest: string) =>
				Effect.suspend(() => {
					story.tell(`the credential with the digest ${digest} is upserted for ${owner}`);
					return attempt(
						Effect.map(credentials.upsert({ digest: Redacted.make(digest), owner }, { updateColumns: ["owner"] }), ({ inserted, row }) => ({
							digest: shown(row.digest),
							inserted,
							owner: row.owner,
						})),
					);
				}),
		};
	},
});

export function credentialsIssued(credentials: Readonly<Record<string, string>>) {
	const listed = Object.entries(credentials).map(([owner, digest]) => `${owner} (${digest})`);
	return serverOnlyCredentials.trait("credentials", `the repository has issued credentials to ${listed.join(", ")}`, (engine) =>
		Effect.forEach(Object.entries(credentials), ([owner, digest]) => issue(engine, owner, digest), { discard: true }),
	);
}
