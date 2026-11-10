import { defineRule } from "#rule.ts";
import { packageFindings } from "#rules/packageFindings.ts";

export const importedChangeKeys = defineRule({
	check: (inputs) => packageFindings(inputs, "boundaries/imported-change-keys"),
	description:
		"Change collection and bucket names in Reactivity invalidation and mutation, SQL invalidateOnCommit and changes key encoders come from their owner's imported declaration. Replace literal array keys, record keys and typed key collection/field names; IDs and bucket values remain application data.",
	id: "boundaries/imported-change-keys",
	registrable: false,
});
