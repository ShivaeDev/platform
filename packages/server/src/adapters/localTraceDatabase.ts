import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Cause, Data, Effect } from "effect";
import { type LocalTraceRow, traceJson } from "#localTraceRow.ts";

const SQLITE_BUSY = 5;

export class TraceStoreBusy extends Data.TaggedError("TraceStoreBusy") {}

function isBusy(error: unknown) {
	return error instanceof Error && "errcode" in error && typeof error.errcode === "number" && (error.errcode & 0xff) === SQLITE_BUSY;
}

function attempt(run: () => void): Effect.Effect<void, TraceStoreBusy> {
	return Effect.suspend(() => {
		try {
			run();
			return Effect.void;
		} catch (error) {
			return isBusy(error) ? Effect.fail(new TraceStoreBusy()) : Effect.die(error);
		}
	});
}

export function localTraceDatabase(path: string, retainedRuns: number, indexedAttributes: readonly string[], startedAtMillis: number) {
	return Effect.try({
		catch: (error) => (isBusy(error) ? new TraceStoreBusy() : new Cause.UnknownError(error)),
		try: () => open(path, retainedRuns, indexedAttributes, startedAtMillis),
	});
}

function open(path: string, retainedRuns: number, indexedAttributes: readonly string[], startedAtMillis: number) {
	mkdirSync(dirname(path), { recursive: true });
	// No busy timeout: the recorder waits for another process's write on its own maintenance clock.
	const db = new DatabaseSync(path, { timeout: 0 });
	try {
		db.exec(`
			PRAGMA journal_mode = WAL;
			PRAGMA foreign_keys = ON;
			CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, started_at_millis INTEGER NOT NULL, completed INTEGER NOT NULL DEFAULT 0);
			CREATE TABLE IF NOT EXISTS spans (
				run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
				span_id TEXT PRIMARY KEY, trace_id TEXT NOT NULL, parent_span_id TEXT,
				name TEXT NOT NULL, started_at_millis INTEGER NOT NULL, data TEXT NOT NULL
			);
			CREATE INDEX IF NOT EXISTS spans_trace ON spans(trace_id, started_at_millis);
			CREATE TABLE IF NOT EXISTS span_attributes (
				span_id TEXT NOT NULL REFERENCES spans(span_id) ON DELETE CASCADE,
				key TEXT NOT NULL, value TEXT NOT NULL
			);
			CREATE INDEX IF NOT EXISTS span_attributes_lookup ON span_attributes(key, value, span_id);
			CREATE INDEX IF NOT EXISTS span_attributes_span ON span_attributes(span_id);
			CREATE VIEW IF NOT EXISTS logs AS
				SELECT run_id, trace_id, parent_span_id AS span_id, started_at_millis AS at_millis,
					json_extract(data, '$.events[0].attributes') AS data FROM spans WHERE name = 'effect.log';
		`);
		const runId = randomUUID();
		db.prepare("INSERT INTO runs(id, started_at_millis) VALUES (?, ?)").run(runId, startedAtMillis);
		const complete = db.prepare("UPDATE runs SET completed = (SELECT coalesce(max(completed), 0) + 1 FROM runs) WHERE id = ?");
		const prune = db.prepare(
			"DELETE FROM runs WHERE completed > 0 AND id NOT IN (SELECT id FROM runs WHERE completed > 0 ORDER BY completed DESC LIMIT ?)",
		);
		const insert = db.prepare("INSERT INTO spans VALUES (?, ?, ?, ?, ?, ?, ?)");
		const index = db.prepare("INSERT INTO span_attributes VALUES (?, ?, ?)");
		const indexed = new Set(indexedAttributes);
		function append(row: LocalTraceRow) {
			insert.run(runId, row.spanId, row.traceId, row.parentSpanId, row.name, row.startedAtMillis, traceJson(row));
			for (const key of indexed) {
				const value = row.attributes[key];
				if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
					index.run(row.spanId, key, String(value));
				}
			}
		}
		function transaction(rows: readonly LocalTraceRow[], finished: boolean) {
			db.exec("BEGIN");
			try {
				for (const row of rows) {
					append(row);
				}
				if (finished) {
					complete.run(runId);
					prune.run(retainedRuns);
				}
				db.exec("COMMIT");
			} catch (error) {
				db.exec("ROLLBACK");
				throw error;
			}
		}
		return {
			close: Effect.sync(() => db.close()),
			finish: (rows: readonly LocalTraceRow[]) => attempt(() => transaction(rows, true)),
			write: (rows: readonly LocalTraceRow[]) => attempt(() => transaction(rows, false)),
		};
	} catch (error) {
		db.close();
		throw error;
	}
}
