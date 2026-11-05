import { databaseUrlFindings } from "#adapters/databaseUrlFindings.ts";
import { defineRule } from "#rule.ts";

export const databaseUrl = defineRule({
	check: databaseUrlFindings,
	description: "Test-support reads PostgreSQL test URLs through postgresTestUrl so CI cannot silently skip PostgreSQL coverage.",
	id: "tests/database-url",
});
