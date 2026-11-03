import { serviceIdFindings } from "#adapters/serviceIdFindings.ts";
import { defineRule } from "#rule.ts";

export const serviceIds = defineRule({
	check: serviceIdFindings,
	description:
		"Literal Context.Service, Context.Reference, defineService and RPC middleware ids in workspace packages under packages/ start with the owning manifest's name and a slash. Prefix the id and update its references. Includes adapters and tests; computed ids, files without a named workspace owner and files outside packages/ are not checked. No config exceptions or inline suppressions.",
	id: "effect/service-ids",
	registrable: false,
});
