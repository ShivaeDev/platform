import { Effect, Option, Predicate } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { transact } from "#transact.ts";
import type { Body, Step } from "./body.ts";
import { onPostgres } from "./engines.ts";
import { endingOf, failureOf } from "./outcome.ts";
import { CodedRow, Document, OwnedRow } from "./versionModels.ts";
import { ownTable, readEndings, recorded, records, uniqueTable } from "./writeTables.ts";

export interface OwnedKey {
	readonly id: number;
	readonly ownerId: number;
}

type Write = "update" | "updateVoid";

interface Race {
	readonly endings: string[];
	winner?: string;
}

const versionEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tables = { documents: uniqueTable("versioned_documents"), owned: uniqueTable("versioned_owned") };
	yield* ownTable(
		sql,
		tables.documents,
		sql`id integer generated always as identity primary key, name text not null unique, "lockVersion" integer not null`,
	);
	yield* ownTable(sql, tables.owned, sql`id text primary key, "ownerId" text not null, name text not null, "lockVersion" integer not null`);
	yield* sql`create unique index ${sql(`${tables.owned}_active`)} on ${sql(tables.owned)} ("ownerId") where name = 'Active'`;
	const owned = { idColumn: ["id", "ownerId"], tableName: tables.owned, versionColumn: "lockVersion" } as const;
	const race: Race = { endings: [] };
	return {
		active: yield* makeRepository(OwnedRow, { ...owned, conflictColumns: ["ownerId"], conflictWhere: { name: "Active" }, spanPrefix: "ActiveRow" }),
		coded: yield* makeRepository(CodedRow, { ...owned, spanPrefix: "CodedRow" }),
		documents: yield* makeRepository(Document, {
			conflictColumns: ["name"],
			idColumn: "id",
			spanPrefix: "Document",
			tableName: tables.documents,
			versionColumn: "lockVersion",
		}),
		owned: yield* makeRepository(OwnedRow, { ...owned, conflictColumns: ["id"], spanPrefix: "OwnedRow" }),
		race,
		records: records(),
		sql,
		tables,
	};
});

type VersionEngine = Effect.Success<ReturnType<typeof versionEngine>>;

function saved<A, E, R>(write: Effect.Effect<A, E, R>) {
	return Effect.match(write, {
		onFailure: (error) => `failed with ${failureOf(error)}`,
		onSuccess: (row) => (Predicate.hasProperty(row, "lockVersion") ? `saved at version ${String(row.lockVersion)}` : "saved"),
	});
}

function insertedVoid<A, E, R>(write: Effect.Effect<A, E, R>) {
	return Effect.match(write, { onFailure: (error) => `failed with ${failureOf(error)}`, onSuccess: () => "inserted" });
}

function stored<E, R>(read: Effect.Effect<{ readonly lockVersion: number; readonly name: string }, E, R>) {
	return Effect.match(read, { onFailure: failureOf, onSuccess: ({ lockVersion, name }) => ({ lockVersion, name }) });
}

function inserted<A extends { readonly lockVersion: number }, E, R>(write: Effect.Effect<Option.Option<A>, E, R>) {
	return Effect.match(write, {
		onFailure: (error) => `failed with ${failureOf(error)}`,
		onSuccess: Option.match({ onNone: () => "ignored", onSome: ({ lockVersion }) => `inserted at version ${lockVersion}` }),
	});
}

function owner({ id, ownerId }: OwnedKey) {
	return `owner ${ownerId}'s row ${id}`;
}

function versionVerbs(engine: VersionEngine, tell: (line: string) => void) {
	const { active, coded, documents, owned, race } = engine;
	function record<R>(ending: Effect.Effect<string, never, R>) {
		return recorded(engine.records, ending);
	}
	function raceWrite(read: Document, name: string) {
		return Effect.map(saved(documents.update({ ...read, name })), (ending) => {
			race.endings.push(ending);
			if (ending.startsWith("saved")) {
				race.winner = name;
			}
		});
	}
	return {
		codedRow: (key: OwnedKey) => stored(coded.findById(key)),
		deleteCoded: (key: OwnedKey, version: number) =>
			Effect.suspend(() => {
				tell(`${owner(key)} is deleted through the doubling version codec at decoded version ${version}`);
				return record(endingOf(coded.delete(key, version)));
			}),
		deleteDocument: (version: number) =>
			Effect.suspend(() => {
				tell(`the document is deleted at version ${version}`);
				return record(endingOf(documents.delete(1, version)));
			}),
		deleteOwned: (key: OwnedKey, version: number) =>
			Effect.suspend(() => {
				tell(`${owner(key)} is deleted at version ${version}`);
				return record(endingOf(owned.delete(key, version)));
			}),
		document: () => stored(documents.findById(1)),
		documentNames: () =>
			Effect.map(documents.findMany({ orderBy: { direction: "asc", field: "name" }, select: ["name"] }), (rows) => rows.map(({ name }) => name)),
		endings: () => readEndings(engine.records),
		inFailingTransaction: <TStep extends Step, A>(body: Body<TStep, A>) =>
			Effect.suspend(() => {
				tell("a transaction begins, and fails once its body has run");
				return record(endingOf(transact(Effect.andThen(Effect.gen(body), Effect.fail("cancelled")), { onSqlError: (error) => error })));
			}),
		insertActiveOrIgnore: (key: OwnedKey, name: string) =>
			Effect.suspend(() => {
				tell(`insertOrIgnore under the partial Active-per-owner index offers ${owner(key)} named ${name}`);
				return record(inserted(active.insertOrIgnore({ ...key, name })));
			}),
		insertDocument: (name: string, write: "insert" | "insertVoid" | "insertOrIgnore" = "insert") =>
			Effect.suspend(() => {
				tell(`${write} saves the document ${name}`);
				if (write === "insertOrIgnore") {
					return record(inserted(documents.insertOrIgnore({ name })));
				}
				return record(insertedVoid(write === "insert" ? documents.insert({ name }) : documents.insertVoid({ name })));
			}),
		insertOwnedOrIgnore: (key: OwnedKey, name: string) =>
			Effect.suspend(() => {
				tell(`insertOrIgnore offers ${owner(key)} named ${name}`);
				return record(inserted(owned.insertOrIgnore({ ...key, name })));
			}),
		ownedRow: (key: OwnedKey) => stored(owned.findById(key)),
		raceEndings: () => Effect.sync(() => race.endings.toSorted((left, right) => left.localeCompare(right))),
		renameCoded: (key: OwnedKey, version: number, name: string) =>
			Effect.suspend(() => {
				tell(`${owner(key)} is renamed ${name} through the doubling version codec from decoded version ${version}`);
				return record(saved(coded.update({ ...key, lockVersion: version, name })));
			}),
		renameDocument: (version: number, name: string, write: Write = "update") =>
			Effect.suspend(() => {
				tell(`${write} renames the document ${name} from version ${version}`);
				return record(saved(documents[write]({ id: 1, lockVersion: version, name })));
			}),
		renameOwned: (key: OwnedKey, version: number, name: string, write: Write = "update") =>
			Effect.suspend(() => {
				tell(`${write} renames ${owner(key)} ${name} from version ${version}`);
				return record(saved(owned[write]({ ...key, lockVersion: version, name })));
			}),
		storedDocumentWriter: () =>
			Effect.map(stored(documents.findById(1)), (row) => (typeof row !== "string" && row.name === race.winner ? "the winning writer" : row)),
		writersRace: () =>
			Effect.gen(function* () {
				tell("two writers read the document at the same version and rename it concurrently");
				const reads = yield* Effect.all([documents.findById(1), documents.findById(1)], { concurrency: 2 });
				yield* Effect.forEach(reads, (read, index) => raceWrite(read, `Writer ${index === 0 ? "A" : "B"}`), { concurrency: 2 });
			}),
	};
}

export const versions = storyKit({
	...onPostgres,
	create: versionEngine,
	name: "PostgreSQL versioned rows",
	stages: ["rows"],
	verbs: (engine, story) => versionVerbs(engine, story.tell),
});

export function documentSaved(name: string, revisions: readonly string[] = []) {
	const revised = revisions.length === 0 ? "" : ` and renamed ${revisions.join(", then ")}`;
	return versions.trait("rows", `the document ${name} was inserted at version 0${revised}`, function* ({ documents }) {
		let current = yield* documents.insert({ name });
		for (const revision of revisions) {
			current = yield* documents.update({ ...current, name: revision });
		}
	});
}

export function ownedRowSaved(key: OwnedKey, name: string, revisions = 0) {
	return versions.trait(
		"rows",
		`${owner(key)} named ${name} was inserted${revisions === 0 ? "" : ` and updated ${revisions} times`}`,
		function* ({ owned }) {
			let current = yield* owned.insert({ ...key, name });
			for (const _revision of Array.from({ length: revisions })) {
				current = yield* owned.update(current);
			}
		},
	);
}

export function documentDeleted() {
	return versions.trait("rows", "the document was deleted", ({ documents }) =>
		Effect.flatMap(documents.findById(1), (row) => documents.delete(1, row.lockVersion)),
	);
}
