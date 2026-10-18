import type { Effect } from "effect";
import type { Connection } from "effect/sql/SqlConnection";

export async function runSchemaPlan(connection: Connection, plan: string, run: <A, E>(effect: Effect.Effect<A, E>) => Promise<A>): Promise<void> {
	// Native exported plans append concurrent index DDL after the migration transaction.
	const parts = /^\s*BEGIN;(?<body>[\s\S]*)\n {4}COMMIT;(?<concurrent>[\s\S]*)$/u.exec(plan);
	if (parts?.groups === undefined) {
		throw new Error("Unrecognized pg-boss schema plan transaction");
	}
	const { body = "", concurrent = "" } = parts.groups;
	function quote(text: string) {
		return `'${text.replaceAll("'", "''")}'`;
	}
	// Effect SQL uses the extended protocol, which accepts one statement per command.
	await run(connection.executeRaw(`DO ${quote(`BEGIN EXECUTE ${quote(body)}; END`)}`, []));
	for (const statement of concurrent.trim().split(/;\s*(?:\n|$)/u)) {
		if (statement.trim() !== "") {
			await run(connection.executeRaw(statement, []));
		}
	}
}
