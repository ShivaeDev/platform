import { DateTime, Effect, Result } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { raceWithLock } from "@shivaedev/test-sql/server/raceWithLock.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { UpsertFilter, UpsertResult } from "#conditionalUpsert.ts";
import { makeRepository } from "#repository.ts";
import { onPostgres } from "./engines.ts";
import { attempt, failureOf } from "./outcome.ts";
import { PullRequest, revision } from "./revisionModels.ts";
import { ownTable, readEndings, recorded, records, uniqueTable } from "./writeTables.ts";

export type RevisionCondition = UpsertFilter<typeof PullRequest>;

const whenNewer = {
	updateColumns: ["title", "updatedAt"],
	updateWhere: { updatedAt: { lt: { excluded: "updatedAt" } } },
} as const;

const revisionEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const table = uniqueTable("pull_revisions");
	yield* ownTable(sql, table, sql`id integer primary key check (id > 0), title text not null, "updatedAt" timestamptz not null`);
	const announced: string[] = [];
	return {
		announced,
		pulls: yield* makeRepository(PullRequest, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "PullRequest", tableName: table }),
		records: records(),
		table,
	};
});

type RevisionEngine = Effect.Success<ReturnType<typeof revisionEngine>>;

function revisionText({ title, updatedAt }: PullRequest) {
	return `${title} at ${DateTime.formatIso(updatedAt).slice(11, 16)}`;
}

function reported(result: UpsertResult<PullRequest>) {
	return "row" in result ? `${result.inserted ? "inserted" : "updated"} ${revisionText(result.row)}` : "unchanged";
}

function revisionVerbs({ announced, pulls, records: log }: RevisionEngine, tell: (line: string) => void) {
	function record<E, R>(write: Effect.Effect<string, E, R>) {
		return recorded(
			log,
			Effect.catch(write, (error) => Effect.succeed(`failed with ${failureOf(error)}`)),
		);
	}
	return {
		announcedChanges: () => Effect.sync(() => [...announced]),
		endings: () => readEndings(log),
		pull: (id = 1) => Effect.map(attempt(pulls.findById(id)), (row) => (typeof row === "string" ? row : revisionText(row))),
		pulls: () =>
			Effect.map(pulls.findMany({ orderBy: { direction: "asc", field: "id" } }), (rows) => rows.map((row) => `${row.id}: ${revisionText(row)}`)),
		syncPull: (hour: number) =>
			Effect.suspend(() => {
				tell(`a revision at ${hour}:00 of pull request 1 is synced, replacing only an older stored revision`);
				return record(Effect.map(pulls.upsert(revision(hour), whenNewer), reported));
			}),
		syncPulls: (synced: readonly (readonly [hour: number, id: number])[]) =>
			Effect.suspend(() => {
				tell(`a batch syncs revisions ${synced.map(([hour, id]) => `${hour}:00 of pull request ${id}`).join(", ")}`);
				return record(
					Effect.map(
						pulls.upsertMany(
							synced.map(([hour, id]) => revision(hour, id)),
							whenNewer,
						),
						(results) => results.map(reported).join("; "),
					),
				);
			}),
		syncPullWhere: (hour: number, updateWhere: RevisionCondition) =>
			Effect.suspend(() => {
				tell(`a revision at ${hour}:00 of pull request 1 is upserted, updating updatedAt only where ${JSON.stringify(updateWhere)}`);
				return record(Effect.map(pulls.upsert(revision(hour), { updateColumns: ["updatedAt"], updateWhere }), reported));
			}),
		syncPullWhileNewerRevisionLocked: (hour: number, lockedHour: number) =>
			Effect.gen(function* () {
				tell(`a transaction syncs a revision at ${lockedHour}:00 and holds its row lock while a writer syncs a revision at ${hour}:00, then commits`);
				const [waiting] = yield* raceWithLock({
					effects: [pulls.upsert(revision(hour), whenNewer)],
					lock: pulls.upsert(revision(lockedHour), whenNewer),
					release: "commit",
				});
				log.endings.push(
					waiting === undefined
						? "never ran"
						: Result.match(waiting, { onFailure: (error) => `failed with ${failureOf(error)}`, onSuccess: reported }),
				);
			}),
	};
}

export const revisions = storyKit({
	...onPostgres,
	create: revisionEngine,
	name: "PostgreSQL conditional upserts",
	stages: ["rows"],
	verbs: (engine, story) => revisionVerbs(engine, story.tell),
});

export function pullsStored(rows: readonly (readonly [hour: number, id: number])[]) {
	return revisions.trait(
		"rows",
		`the store holds ${rows.map(([hour, id]) => `pull request ${id} at its ${hour}:00 revision`).join(", ")}`,
		({ pulls }) => pulls.insertMany(rows.map(([hour, id]) => revision(hour, id))),
	);
}

export function changesWatched() {
	return revisions.trait("rows", "a subscriber watches the pull request table for announced changes", function* ({ announced, table }) {
		const reactivity = yield* Reactivity.Reactivity;
		const cancel = reactivity.registerUnsafe([table], () => announced.push(table));
		yield* Effect.addFinalizer(() => Effect.sync(cancel));
	});
}
