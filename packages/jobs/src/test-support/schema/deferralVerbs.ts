import { Context } from "effect";
import { SqlClient } from "effect/sql";
import type { SchemaState } from "./kit.ts";

export function deferralVerbs(state: SchemaState, tell: (line: string) => void) {
	const sql = Context.get(state.services, SqlClient.SqlClient);
	return {
		removeDeferralArtifact: (schema: string, artifact: "table" | "index" | "function" | "trigger") => {
			tell(`the deferral ${artifact} is removed from ${schema}`);
			const drops = {
				function: sql`DROP FUNCTION ${sql(schema)}.effect_stately_deferral() CASCADE`,
				index: sql`DROP INDEX ${sql(schema)}.effect_job_deferral_keep_until`,
				table: sql`DROP TABLE ${sql(schema)}.effect_job_deferral`,
				trigger: sql`DROP TRIGGER effect_stately_deferral ON ${sql(schema)}.job`,
			};
			return drops[artifact];
		},
		removeInspectionArtifact: (schema: string, artifact: "function" | "trigger") => {
			tell(`the inspection ${artifact} is removed from ${schema}`);
			return artifact === "function"
				? sql`DROP FUNCTION ${sql(schema)}.effect_job_changed() CASCADE`
				: sql`DROP TRIGGER effect_job_changed ON ${sql(schema)}.job`;
		},
	};
}
