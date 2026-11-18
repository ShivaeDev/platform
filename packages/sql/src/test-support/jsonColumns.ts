import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { json } from "#json.ts";
import { jsonb } from "#jsonb.ts";
import { makeRepository } from "#repository.ts";
import { onPostgres } from "#test/engines.ts";
import { attempt } from "#test/outcome.ts";
import { ownTable, uniqueTable } from "#test/writeTables.ts";

const Message = Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown));
const Call = Schema.NullOr(Schema.Struct({ id: Schema.String, name: Schema.String }));

class Turn extends Model.Class<Turn>("JsonColumnTurn")({
	call: json(Call),
	id: Schema.Int,
	indexed: jsonb(Message),
	message: json(Message),
}) {}

type Written = typeof Message.Type;

const jsonColumnEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = uniqueTable("json_columns");
	yield* ownTable(sql, tableName, sql`id integer primary key, message json, indexed jsonb, call json`);
	const turns = yield* makeRepository(Turn, { idColumn: "id", spanPrefix: "Turn", tableName });
	return { sql, tableName, turns };
});

type JsonColumnEngine = Effect.Success<ReturnType<typeof jsonColumnEngine>>;

function text(value: unknown) {
	return JSON.stringify(value);
}

// A story writes a value as JSON text, because parsing keeps the keys in the order the text has them.
function parsed<TSchema extends Schema.Top>(schema: TSchema, written: string) {
	const value: unknown = JSON.parse(written);
	const accepts: (input: unknown) => input is TSchema["Type"] = Schema.is(schema);
	return accepts(value) ? Effect.succeed(value) : Effect.die(new Error(`${written} does not fit the column's value schema`));
}

export const jsonColumns = storyKit({
	...onPostgres,
	create: jsonColumnEngine,
	inspect: ({ tableName }: JsonColumnEngine) => ({ tableName }),
	name: "PostgreSQL json columns",
	stages: ["rows"],
	verbs: ({ sql, tableName, turns }: JsonColumnEngine, story) => {
		function stored(column: "call" | "message") {
			return Effect.map(
				Effect.orDie(sql<{ readonly text: string | null }>`select ${sql(column)}::text as text from ${sql(tableName)} where id = 1`),
				([row]) => (row === undefined ? "no turn" : (row.text ?? "SQL NULL")),
			);
		}
		return {
			findTurnsByMessage: (message: Written) =>
				Effect.suspend(() => {
					story.tell(`the repository reads the turns whose json message equals ${text(message)}`);
					return attempt(turns.findMany({ select: ["id"], where: { message } }));
				}),
			readIndexed: () =>
				Effect.suspend(() => {
					story.tell("the repository reads turn 1's jsonb message");
					return Effect.map(attempt(turns.findById(1)), (turn) => (typeof turn === "string" ? turn : text(turn.indexed)));
				}),
			readMessage: () =>
				Effect.suspend(() => {
					story.tell("the repository reads turn 1's json message");
					return Effect.map(attempt(turns.findById(1)), (turn) => (typeof turn === "string" ? turn : text(turn.message)));
				}),
			rewriteMessage: () =>
				Effect.suspend(() => {
					story.tell("the repository reads turn 1 and writes back the message it read");
					return turns.findById(1).pipe(
						Effect.flatMap((turn) => turns.updateVoid({ id: turn.id, message: turn.message }, { columns: ["message"] })),
						Effect.orDie,
					);
				}),
			saveCall: (written: string) =>
				Effect.suspend(() => {
					story.tell(`the repository saves turn 1 with the call ${written} in its json column`);
					return Effect.orDie(Effect.flatMap(parsed(Call, written), (call) => turns.insertVoid({ call, id: 1, indexed: null, message: null })));
				}),
			saveTurn: (written: string) =>
				Effect.suspend(() => {
					story.tell(`the repository saves turn 1 with the message ${written} in its json column and its jsonb column`);
					return Effect.orDie(
						Effect.flatMap(parsed(Message, written), (message) => turns.insertVoid({ call: null, id: 1, indexed: message, message })),
					);
				}),
			storedCall: () => stored("call"),
			storedMessage: () => stored("message"),
		};
	},
});

export function storedByAnotherClient(message: string) {
	return jsonColumns.trait("rows", `another client stored turn 1's json message as the text ${message}`, ({ sql, tableName }) =>
		Effect.asVoid(sql`insert into ${sql(tableName)} (id, message) values (1, ${message}::json)`),
	);
}
