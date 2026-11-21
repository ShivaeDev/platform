import { defineRule } from "#rule.ts";
import { serviceFolderFindings } from "#serviceFolderFindings.ts";

export const serviceFolders = defineRule({
	check: serviceFolderFindings,
	description:
		"Every folder containing a defineService declaration, and each services/<name> folder, has service.ts, and its service.ts exports one named const initialized by defineService. The service-definition-assembly rule checks its operation inventory.",
	id: "effect/service-folders",
	registrable: false,
});
