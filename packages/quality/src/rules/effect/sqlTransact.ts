import { nativeTransactionFindings } from "#adapters/nativeTransactionFindings.ts";
import { defineRule } from "#rule.ts";

export const sqlTransact = defineRule({
	check: nativeTransactionFindings,
	description:
		"Repository writes and change announcements use transact for their outer transaction instead of native sql.withTransaction. Native transactions containing only reads or raw SQL remain supported.",
	id: "effect/sql-transact",
	registrable: false,
});
