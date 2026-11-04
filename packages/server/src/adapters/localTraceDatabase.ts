import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { type LocalTraceRow, traceJson } from "#localTraceRow.ts";

export function localTraceDatabase(path: string, retainedRuns: number, indexedAttributes: readonly string[], startedAtMillis: number) {
	mkdirSync(dirname(path), { recursive: true });
	const db = new DatabaseSync(path, { timeout: 1000 });
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
			CREATE VIEW IF NOT EXISTS logs AS
				SELECT run_id, trace_id, parent_span_id AS span_id, started_at_millis AS at_millis,
					json_extract(data, '$.events[0].attributes') AS data FROM spans WHERE name = 'effect.log';
		`);
		const runId = randomUUID();
		db.prepare("INSERT INTO runs(id, started_at_millis) VALUES (?, ?)").run(runId, startedAtMillis);
		const complete = db.prepare("UPDATE runs SET completed = 1 WHERE id = ?");
		const prune = db.prepare(
			"DELETE FROM runs WHERE completed = 1 AND id NOT IN (SELECT id FROM runs WHERE completed = 1 ORDER BY rowid DESC LIMIT ?)",
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
		return {
			close: () => {
				try {
					complete.run(runId);
					prune.run(retainedRuns);
				} finally {
					db.close();
				}
			},
			write: (rows: readonly LocalTraceRow[]) => {
				db.exec("BEGIN");
				try {
					for (const row of rows) {
						append(row);
					}
					db.exec("COMMIT");
				} catch (error) {
					db.exec("ROLLBACK");
					throw error;
				}
			},
		};
	} catch (error) {
		db.close();
		throw error;
	}
}
