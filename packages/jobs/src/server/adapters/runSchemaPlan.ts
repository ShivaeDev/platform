import { Effect } from "effect";
import { SchemaConnection } from "#server/SchemaConnection.ts";
import { pendingIndexInserts } from "./schemaIndexBuilds.ts";

export const runSchemaPlan = Effect.fnUntraced(function* (plan: string, upgrade?: { readonly schema: string; readonly version: number }) {
	const connection = yield* SchemaConnection;
	// Native exported plans append concurrent index DDL after the migration transaction.
	const parts = /^\s*BEGIN;(?<body>[\s\S]*)\n {4}COMMIT;(?<concurrent>[\s\S]*)$/u.exec(plan);
	if (parts?.groups === undefined) {
		throw new Error("Unrecognized pg-boss schema plan transaction");
	}
	const { body = "", concurrent = "" } = parts.groups;
	function quote(text: string) {
		return `'${text.replaceAll("'", "''")}'`;
	}
	const commands = concurrent
		.trim()
		.split(/;\s*(?:\n|$)/u)
		.filter((statement) => statement.trim() !== "");
	const pending = upgrade === undefined ? "" : pendingIndexInserts(upgrade.schema, upgrade.version, commands, quote);
	// Effect SQL uses the extended protocol, which accepts one statement per command.
	yield* connection.executeRaw(`DO ${quote(`BEGIN EXECUTE ${quote(`${body}\n${pending}`)}; END`)}`, []);
	if (upgrade === undefined) {
		for (const statement of commands) {
			yield* connection.executeRaw(statement, []);
		}
	}
});
