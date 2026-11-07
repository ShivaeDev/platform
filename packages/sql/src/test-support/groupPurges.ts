import { Effect, Queue } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { PurgeLimits } from "#batchedDelete.ts";
import { deleteGroupsBatched } from "#deleteGroupsBatched.ts";
import { onPostgres } from "#test/engines.ts";
import { type GroupRows, groupRows } from "#test/groupRows.ts";
import { failureOf } from "#test/outcome.ts";
import { ChangeObserver } from "#transact.ts";

export const groupPurgeEngine = Effect.fnUntraced(function* () {
	const rows = yield* groupRows();
	const commits = yield* Queue.unbounded<void>();
	const batches: { readonly keys: readonly unknown[]; readonly stored: readonly { readonly id: number; readonly children: number }[] }[] = [];
	function purge(limits: PurgeLimits) {
		return deleteGroupsBatched({ ...limits, delete: rows.remove, select: rows.select, tableName: rows.tableName }).pipe(
			Effect.provideService(ChangeObserver, (event) =>
				event._tag === "Published"
					? Effect.gen(function* () {
							batches.push({ keys: event.changes, stored: yield* rows.stored() });
							yield* Queue.offer(commits, undefined);
						})
					: Effect.void,
			),
		);
	}
	return { ...rows, batches, commits, purge };
});

export const groupPurges = storyKit({
	...onPostgres,
	create: groupPurgeEngine,
	name: "PostgreSQL whole-group retention",
	stages: ["rows", "constraints"],
	verbs: (rows, story) => ({
		committedGroups: () => Effect.sync(() => rows.batches.map((batch) => batch.stored)),
		publications: () => Effect.sync(() => rows.batches.map((batch) => batch.keys)),
		purge: (batchSize: number, maxRows: number) => {
			story.tell(`retention removes whole runs with a ${batchSize}-row batch budget and ${maxRows}-row total budget`);
			return rows.purge({ batchSize, maxRows, pause: 0 });
		},
		purgeFailure: (batchSize: number, maxRows: number) => {
			story.tell("retention attempts to delete the runs and their children");
			return rows.purge({ batchSize, maxRows, pause: 0 }).pipe(
				Effect.as("succeeded"),
				Effect.catchTag("SqlError", (error) => Effect.succeed(failureOf(error))),
			);
		},
		storedGroups: rows.stored,
	}),
});

export const seedGroups = Effect.fnUntraced(function* ({ runs, children }: GroupRows) {
	for (const [id, count, owner] of [
		[1, 2, "alice"],
		[2, 1, "alice"],
		[3, 3, "alice"],
		[4, 1, "bob"],
	] as const) {
		yield* runs.insert({ id, owner });
		for (let index = 1; index <= count; index += 1) {
			yield* children.insert({ id: id * 10 + index, owner, runId: id });
		}
	}
});

export const rejectSecondGroup = Effect.fnUntraced(function* ({ sql, tableName }: GroupRows) {
	const trigger = `${tableName}_reject`;
	yield* Effect.acquireRelease(
		sql`create function ${sql(trigger)}() returns trigger language plpgsql as ${sql.literal(`$body$begin
			if old.id = 2 then raise exception 'run retained' using errcode = '23514'; end if;
			return old;
		end$body$`)}`,
		() => Effect.orDie(sql`drop function ${sql(trigger)}() cascade`),
	);
	yield* sql`create trigger refuse_run before delete on ${sql(tableName)} for each row execute function ${sql(trigger)}()`;
});

export function existingGroups() {
	return groupPurges.trait("rows", "alice has runs of 3, 2 and 4 rows; bob has a private two-row run", seedGroups);
}
export function secondGroupRejectsDeletion() {
	return groupPurges.trait("constraints", "a database trigger refuses the second run after its children are deleted", rejectSecondGroup);
}
