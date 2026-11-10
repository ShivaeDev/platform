import { Cause, Deferred, Effect, ErrorReporter, Layer, Logger, Predicate, Redacted, Schema } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { rpcBoundaryHandlers } from "#rpcBoundaryHandlers.ts";
import { Conflict, InternalServerError, ServiceUnavailable } from "#taxonomy.ts";
import { recordingReporter } from "#test/errorObservations.ts";

const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");

const notes = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table notes (id integer primary key, title text not null unique)`;
	yield* sql`insert into notes (id, title) values (1, 'Shopping'), (2, 'Errands')`;
});

const database = makePostgresTestLayer({
	...clientOptions({ url: Redacted.make(url ?? "postgresql://integration-tests-disabled") }),
	maxConnections: 3,
	migrations: { loader: Migrator.fromRecord({ "1_notes": notes }), lockTimeout: "5 seconds" },
});

const rename = {
	error: Schema.Union([Conflict, ServiceUnavailable, InternalServerError]),
	payload: { title: Schema.String },
	success: Schema.Void,
};
const Notes = RpcGroup.make(
	Rpc.make("RenameShopping", rename),
	Rpc.make("RenameShoppingOrConflict", rename),
	Rpc.make("RenameShoppingDuringMaintenance", rename),
);

const renameShopping = Effect.fn("NotesTest.renameShopping")(function* (title: string) {
	const sql = yield* SqlClient.SqlClient;
	yield* sql.withTransaction(sql`set local lock_timeout = '50ms'`.pipe(Effect.andThen(sql`update notes set title = ${title} where id = 1`)));
});

const handlers = Notes.toLayer(
	rpcBoundaryHandlers(
		Notes,
		{ unexpected: (message) => new InternalServerError({ message }) },
		{
			RenameShopping: ({ title }) => renameShopping(title),
			RenameShoppingDuringMaintenance: () => Effect.fail(new ServiceUnavailable({ message: "Notes are read-only during maintenance" })),
			RenameShoppingOrConflict: ({ title }) =>
				renameShopping(title).pipe(
					Effect.catchReason("SqlError", "UniqueViolation", () => Effect.fail(new Conflict({ field: "title", message: "Title is taken" }))),
				),
		},
	),
);

export const postgresBoundary = storyKit({
	around: withIsolatedDatabase,
	*create() {
		const recording = recordingReporter();
		const sql = yield* SqlClient.SqlClient;
		const warnings: { readonly message: string; readonly failures: readonly string[] }[] = [];
		const logger = Logger.make(({ cause, logLevel, message }) => {
			if (logLevel === "Warn") {
				warnings.push({
					failures: cause.reasons.flatMap((reason) =>
						Cause.isFailReason(reason) && Predicate.hasProperty(reason.error, "_tag") ? [String(reason.error._tag)] : [],
					),
					message: [message].flat().join(" "),
				});
			}
		});
		const observed = Layer.mergeAll(ErrorReporter.layer([recording.reporter]), Logger.layer([logger]));
		const client = yield* RpcTest.makeClient(Notes).pipe(Effect.provide(handlers.pipe(Layer.provide(observed))));
		const answers: unknown[] = [];
		return { answers, client, reports: recording.reports, sql, warnings };
	},
	layer: database,
	name: "RPC boundary on PostgreSQL",
	runIf: configured,
	stages: ["rows"],
	verbs: ({ answers, client, reports, warnings }, story) => {
		function call(request: Effect.Effect<void, unknown>) {
			return request.pipe(
				Effect.match({ onFailure: (rejection) => rejection, onSuccess: () => "renamed" }),
				Effect.andThen((answer) => Effect.sync(() => answers.push(answer))),
				Effect.asVoid,
			);
		}
		return {
			answer: () => Effect.sync(() => answers.at(-1)),
			loggedWarnings: () => Effect.sync(() => [...warnings]),
			recordedReports: () => Effect.sync(() => [...reports]),
			renameShopping: (title: string) => {
				story.tell(`the client renames Shopping to ${title}`);
				return call(client.RenameShopping({ title }));
			},
			renameShoppingDuringMaintenance: (title: string) => {
				story.tell(`the client renames Shopping to ${title} while the operation answers its own ServiceUnavailable for maintenance`);
				return call(client.RenameShoppingDuringMaintenance({ title }));
			},
			renameShoppingOrConflict: (title: string) => {
				story.tell(`the client renames Shopping to ${title} through the RPC that declares a taken title as Conflict`);
				return call(client.RenameShoppingOrConflict({ title }));
			},
		};
	},
});

export function shoppingLockedElsewhere() {
	return postgresBoundary.trait("rows", "another connection holds the row lock on Shopping in an open transaction", ({ sql }) =>
		Effect.gen(function* () {
			const held = yield* Deferred.make<void>();
			yield* Effect.forkScoped(
				sql.withTransaction(
					sql`select id from notes where id = 1 for update`.pipe(Effect.andThen(Deferred.succeed(held, undefined)), Effect.andThen(Effect.never)),
				),
			);
			yield* Deferred.await(held);
		}),
	);
}
