import { defineRule } from "#rule.ts";
import { packageFindings } from "#rules/packageFindings.ts";

export const serviceParameters = defineRule({
	check: (inputs) => packageFindings(inputs, "effect/service-parameters"),
	description:
		"Exported and local functions and public methods take services from Effect's environment, including aliases, constraints, inferred/destructured parameters and factory returns. Service keys/classes, non-empty Contexts and implementation shapes are services; Effect/Stream requirements are computations. Service implementation methods, framework callbacks, module-level React components and their props, owned initializer state, foreign host callbacks in object literals and classes, owned foreign resources, Layer constructors, registries and RPC clients held by plain functions outside Effect bodies, and tags only handed to middleware declarations or Context.pick are accepted. Within Effect code, test-support/ folders are exempt. adapters/ folders still follow this rule and the ambient runtime bans. No config exceptions or inline suppressions; baseline existing debt.",
	id: "effect/service-parameters",
	registrable: false,
});
