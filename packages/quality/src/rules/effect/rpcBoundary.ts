import { rpcBoundaryFindings } from "#adapters/rpcBoundaryFindings.ts";
import { defineRule } from "#rule.ts";

export const rpcBoundary = defineRule({
	check: rpcBoundaryFindings,
	description:
		"Apply rpcBoundary and rpcBoundaryHandlers only in modules building native RPC handlers; services keep their typed failures. Test-support kits and the handler boundary implementation are accepted. No config exceptions or inline suppressions; baseline existing debt.",
	id: "effect/rpc-boundary",
	registrable: false,
});
