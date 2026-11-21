import pgBossPackage from "pg-boss/package.json" with { type: "json" };

export function pgBossSchemaStatus(schema: string, installed: number | undefined): string | undefined {
	const required = pgBossPackage.pgboss.schema;
	if (installed === undefined || installed < required) {
		return `schema ${schema}, installed version ${installed ?? "missing"}, required version ${required}`;
	}
	return undefined;
}
