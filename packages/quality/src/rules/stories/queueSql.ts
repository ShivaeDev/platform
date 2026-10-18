import { defineRule } from "#rule.ts";
import { sqlTexts } from "./sqlText.ts";

const QUEUE_SCHEMA = /\bpgboss\b"?\s*\./iu;

export const queueSql = defineRule({
	check: async (inputs) =>
		(await sqlTexts(inputs))
			.filter((query) => QUEUE_SCHEMA.test(query.text))
			.map((query) => ({
				file: query.file,
				line: query.line,
				message:
					"SQL mentions pgboss. Use the app's public queue definitions and let workers process jobs; apps never edit or purge queue tables, and there is no queue-purge API by design.",
			})),
	description: "Apps never read, edit or purge pg-boss's private queue schema.",
	id: "boundaries/queue-sql",
});
