import type { PgBoss } from "pg-boss";

const BUILD_PREFIX = "effect-pg-boss-schema:";

function indexName(command: string): string {
	const match =
		/^\s*(?:CREATE (?:UNIQUE )?INDEX CONCURRENTLY IF NOT EXISTS |DROP INDEX CONCURRENTLY IF EXISTS (?:(?:"[^"]+"|\w+)\.))(?<name>\w+)/mu.exec(
			command,
		);
	const name = match?.groups?.name;
	if (name === undefined) {
		throw new Error("Unrecognized pg-boss concurrent index command");
	}
	return name;
}

export function pendingIndexInserts(schema: string, version: number, commands: readonly string[], quote: (text: string) => string): string {
	return commands
		.map((command, position) => {
			const table = indexName(command).replace(/_i\d+$/u, "");
			const name = `${BUILD_PREFIX}${String(position).padStart(6, "0")}`;
			return `INSERT INTO ${schema}.bam (name, version, table_name, command) VALUES (${quote(name)}, ${version}, ${quote(table)}, ${quote(command)});`;
		})
		.join("\n");
}

export async function resumeSchemaIndexes(client: PgBoss, schema: string): Promise<void> {
	const db = client.getDb();
	const { rows } = await db.executeSql(
		`SELECT id, command FROM ${schema}.bam WHERE starts_with(name, $1) AND status <> 'completed' ORDER BY created_on, name`,
		[BUILD_PREFIX],
	);
	for (const row of rows) {
		const name = indexName(row.command);
		if (/^\s*CREATE /mu.test(row.command)) {
			const probe = await db.executeSql("SELECT NOT indisvalid AS invalid FROM pg_index WHERE indexrelid = to_regclass($1)", [`${schema}.${name}`]);
			if (probe.rows[0]?.invalid === true) {
				await db.executeSql(`DROP INDEX CONCURRENTLY IF EXISTS ${schema}."${name}"`);
			}
		}
		await db.executeSql(row.command);
		await db.executeSql(`UPDATE ${schema}.bam SET status = 'completed', completed_on = clock_timestamp() WHERE id = $1`, [row.id]);
	}
}
