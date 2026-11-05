import { serviceModelFindings } from "#adapters/serviceModelFindings.ts";
import { defineRule } from "#rule.ts";

export const serviceModel = defineRule({
	check: serviceModelFindings,
	description:
		"defineService initializer state owns lifetime state, never dependencies. Every inventoried operation, including factory returns and piped bodies, is a sibling Effect.fn export with its Service.operation span. Dependencies and the caller come from the environment; the Layer registration chooses lifetime.",
	id: "effect/service-model",
	registrable: false,
});
