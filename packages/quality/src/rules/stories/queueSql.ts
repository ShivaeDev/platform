import { Effect } from "effect";
import { defineRule } from "#rule.ts";
import { sqlTexts } from "#rules/stories/sqlText.ts";

const QUEUE_SCHEMA = /\bpgboss\b"?\s*\./iu;

export const queueSql = defineRule({
	check: (inputs) =>
		Effect.map(sqlTexts(inputs), (queries) =>
			queries
				.filter((query) => QUEUE_SCHEMA.test(query.text))
				.map((query) => ({
					file: query.file,
					line: query.line,
					message:
						"SQL mentions pgboss. Use the app's public queue definitions and let workers process jobs; apps never edit or purge queue tables, and there is no queue-purge API by design.",
				})),
		),
	description: "Apps never read, edit or purge pg-boss's private queue schema.",
	id: "boundaries/queue-sql",
});
