import { defineRule } from "#rule.ts";
import { packageFindings } from "#rules/packageFindings.ts";

export const sqlTransact = defineRule({
	check: (inputs) => packageFindings(inputs, "effect/sql-transact"),
	description:
		"Repository writes and change announcements use transact for their outer transaction instead of native sql.withTransaction. Native transactions containing only reads or raw SQL remain supported.",
	id: "effect/sql-transact",
	registrable: false,
});
