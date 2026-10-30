import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { compilerStory, type InvalidFixture } from "#test/compilerFixtures.ts";

compilerStory.it(
	"the compiler accepts the valid definitions and emits each service's method signatures and Layer type without its initializer or private state",
	[],
	function* ({ compileValid, errors, emitted }) {
		yield* compileValid();

		yield* outcomes({
			"compiler errors": [errors(), []],
			"generic's Layer": [emitted.layer("fixture/Generic"), 'Layer.Layer<"fixture/Generic", never, Declared>'],
			"generic's preserve": [
				emitted.method("fixture/Generic", "preserve"),
				"<TSuccess, TFailure, TRequirements>(effect: Effect.Effect<TSuccess, TFailure, TRequirements>) => Effect.Effect<{ readonly value: TSuccess; }, TFailure | GenericFailure, TRequirements>",
			],
			"ordinary's Layer": [emitted.layer("fixture/Ordinary"), 'Layer.Layer<"fixture/Ordinary", InitializationFailure, Declared | Residual>'],
			"ordinary's read": [emitted.method("fixture/Ordinary", "read"), "(...arguments_: number[]) => Effect.Effect<number, MethodFailure, never>"],
			"ordinary's subscribe": [
				emitted.method("fixture/Ordinary", "subscribe"),
				"() => Effect.Effect<PubSub.Subscription<number>, never, Scope.Scope>",
			],
			"private names in the declaration": [emitted.mentions("PrivateState", "initialize", "methods"), []],
		});
	},
);

const rejections: ReadonlyArray<readonly [definition: string, fixture: InvalidFixture, reason: string]> = [
	["an initializer that reads an undeclared service", "initializerRequirement", "InitializerHasUndeclaredServiceRequirements"],
	["a method that reads an undeclared service", "methodRequirement", "MethodHasUndeclaredServiceRequirements"],
	[
		"an ordinary method beside a generic one that reads a service the requirement-free service does not declare",
		"requirementFreeOrdinaryRequirement",
		"MethodHasUndeclaredServiceRequirements",
	],
	["a service that declares Scope.Scope as a requirement", "scopeRequirement", "ScopeCannotBeDeclaredAsServiceRequirement"],
	["a requirements alias whose caller scope is another service", "callerRequirement", "is missing the following properties from type 'Scope'"],
	["an Effect value in place of a method", "methodValue", "ServiceMembersMustBeMethods"],
	["an unmarked generic method", "generic", "GenericOrStructurallyOverloadedMethodsAreUnsupported"],
	["an overloaded method", "overloaded", "GenericOrStructurallyOverloadedMethodsAreUnsupported"],
	[
		"an overloaded method whose first signature hides an undeclared service",
		"overloadedHiddenRequirement",
		"GenericOrStructurallyOverloadedMethodsAreUnsupported",
	],
	["an overloaded function marked as a generic method", "genericMarkerOverloaded", "GenericOrStructurallyOverloadedMethodsAreUnsupported"],
	["a caller reading the private state from the service", "privateState", "Property 'secret' does not exist"],
	["a replacement Layer that leaves out the service's second method", "fake", "Property 'second' is missing"],
];

for (const [definition, fixture, reason] of rejections) {
	compilerStory.it(`the compiler rejects ${definition} with "${reason}"`, [], function* ({ compileInvalid, rejection }) {
		yield* compileInvalid(fixture);

		expect(yield* rejection()).toContain(reason);
	});
}
