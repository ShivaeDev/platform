import { DateTime, Effect } from "effect";
import { Model } from "effect/schema";
import { ChangeObserver, transact } from "#transact.ts";
import { attempt } from "./outcome.ts";
import { original, type Profile, printed } from "./partialWriteModels.ts";
import type { PartialWriteEngine } from "./partialWrites.ts";
import { kept, readEndings, readReturned, recording, statementKinds } from "./writeTables.ts";

export function partialWriteVerbs(engine: PartialWriteEngine, tell: (line: string) => void) {
	const { byOwner, profiles, records, log, capture, sql, tableName } = engine;
	function observed<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return recording(log, effect).pipe(Effect.provide(capture.layer(ChangeObserver)));
	}
	function write<A, E, R>(effect: Effect.Effect<A, E, R>, print: (row: A) => unknown = (row) => row) {
		return kept(records, observed(effect), print);
	}
	return {
		endings: () => readEndings(records),
		insertInvalidDetails: () =>
			Effect.suspend(() => {
				tell("the repository receives profile details with a non-finite amount");
				return write(profiles.insert({ ...original, details: { amount: Number.NaN, routes: [] } }), printed);
			}),
		insertProfile: (details: Profile["details"]) =>
			Effect.suspend(() => {
				tell("the repository inserts profile 1 with structured details");
				return write(profiles.insert({ ...original, details }), printed);
			}),
		profile: () => Effect.map(profiles.findById(1), printed),
		profileDetails: () =>
			Effect.map(attempt(profiles.findMany({ select: ["details"] })), (rows) => (typeof rows === "string" ? rows : rows.map((row) => row.details))),
		publications: () =>
			Effect.map(capture.attempted, (batches) => batches.map((keys) => keys.map((key) => String(key).replaceAll(tableName, "profiles")))),
		readProfile: () =>
			Effect.suspend(() => {
				tell("the repository reads profile 1");
				return profiles.findById(1);
			}),
		returned: () => readReturned(records),
		statementKinds: () => statementKinds(log),
		storedDetails: () =>
			Effect.map(sql`select details, details is null as missing from ${sql(tableName)} where id = '1'`, (rows) => ({
				sqlNull: rows[0]?.missing,
				value: rows[0]?.details,
			})),
		updateByOwner: () =>
			Effect.suspend(() => {
				tell("the composite repository updates only the name of alice's profile 1");
				return write(byOwner.update({ id: 1, name: "Composite", owner: "alice" }, { columns: ["name"] }), printed);
			}),
		updateDetails: (details: Profile["details"]) =>
			Effect.suspend(() => {
				tell("the repository updates only profile 1's details");
				return write(profiles.update({ details, id: 1 }, { columns: ["details"] }), printed);
			}),
		updateMissingNote: () =>
			Effect.suspend(() => {
				tell("the repository receives a selected optional note without a supplied value");
				const update: ReturnType<typeof profiles.update> = Reflect.apply(profiles.update, profiles, [{ id: 1 }, { columns: ["note"] }]);
				return write(update, printed);
			}),
		updateName: (id = 1, rollback = false) =>
			Effect.suspend(() => {
				tell(`the repository updates only profile ${id}'s name${rollback ? " in a transaction that fails" : ""}`);
				const update = profiles.update({ id, name: "Published" }, { columns: ["name"], onMissing: "fail" });
				return write(rollback ? transact(Effect.andThen(update, Effect.fail("rejected")), { onSqlError: (error) => error }) : update, printed);
			}),
		updateOwnerVoid: () =>
			Effect.suspend(() => {
				tell("the repository updates only profile 1's owner to bob without returning a row");
				return write(profiles.updateVoid({ id: 1, owner: "bob" }, { columns: ["owner"] }));
			}),
		updateReadBack: (row: Profile) =>
			Effect.suspend(() => {
				tell("the repository receives the read-back profile unchanged as its update input");
				return write(profiles.update(row), printed);
			}),
		updateWithColumns: (columns: readonly string[]) =>
			Effect.suspend(() => {
				tell(`the repository receives update columns ${JSON.stringify(columns)}`);
				const update: ReturnType<typeof profiles.update> = Reflect.apply(profiles.update, profiles, [{ ...original, name: "Rejected" }, { columns }]);
				return write(update, printed);
			}),
		upsertName: () =>
			Effect.suspend(() => {
				tell("the repository upserts a new name and later first-seen time, selecting only name on conflict");
				return write(
					profiles.upsert(
						{
							...original,
							firstSeen: DateTime.makeUnsafe("2026-10-31T00:00:00Z"),
							name: "Imported",
							updatedAt: Model.Override(DateTime.makeUnsafe("2026-10-31T00:00:00Z")),
						},
						{ updateColumns: ["name"] },
					),
					({ inserted, row }) => ({ inserted, row: printed(row) }),
				);
			}),
		writeMalformedDetails: () =>
			Effect.suspend(() => {
				tell("an outside writer stores a JSON object whose amount violates the profile schema");
				return sql`update ${sql(tableName)} set details = '{"amount": "invalid", "routes": []}'::jsonb where id = '1'`;
			}),
	};
}
