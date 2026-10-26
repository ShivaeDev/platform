import { describe, expect } from "vitest";
import { compilerStory } from "#test/compilerFixtures.ts";

const COMPILER_TIMEOUT = 60_000;

describe("service definition compiler fixtures", { timeout: COMPILER_TIMEOUT }, () => {
	compilerStory.it("emits only the initialized public service surface", [], function* ({ declarations }) {
		const declaration = yield* declarations();
		expect(declaration).toContain("...arguments_: number[]");
		expect(declaration).toContain("Effect.Effect<number, MethodFailure, never>");
		expect(declaration).toContain("Scope.Scope");
		expect(declaration).toContain('Layer<"fixture/Ordinary", InitializationFailure, Declared | Residual>');
		expect(declaration).toContain("preserve: <TSuccess, TFailure, TRequirements>");
		expect(declaration).toContain("readonly value: TSuccess;\n    }, TFailure | GenericFailure, TRequirements>");
		expect(declaration).toContain('Layer<"fixture/Generic", never, never>');
		expect(declaration).not.toContain("PrivateState");
		expect(declaration).not.toContain("initialize");
		expect(declaration).not.toContain("methods");
	});

	const invalidFixtures = {
		callerRequirement: "missing the following properties from type 'Scope'",
		fake: "second",
		generic: "GenericOrStructurallyOverloadedMethodsAreUnsupported",
		genericDeclaredRequirement: "GenericMethodWithDeclaredRequirementsIsUnsupported",
		genericMarkerOverloaded: "GenericOrStructurallyOverloadedMethodsAreUnsupported",
		initializerRequirement: "InitializerHasUndeclaredServiceRequirements",
		methodRequirement: "MethodHasUndeclaredServiceRequirements",
		methodValue: "not assignable",
		overloaded: "GenericOrStructurallyOverloadedMethodsAreUnsupported",
		overloadedHiddenRequirement: "GenericOrStructurallyOverloadedMethodsAreUnsupported",
		privateState: "Property 'secret' does not exist",
		requirementFreeOrdinaryRequirement: "MethodHasUndeclaredServiceRequirements",
		scopeRequirement: "ScopeCannotBeDeclaredAsServiceRequirement",
	} as const;

	compilerStory.it("rejects each invalid service definition", [], function* ({ invalid }) {
		const result = yield* invalid(Object.keys(invalidFixtures));
		expect(result.status).not.toBe(0);
		for (const [fixture, expectedDiagnostic] of Object.entries(invalidFixtures)) {
			expect(result.diagnostics[fixture], fixture).toContain(expectedDiagnostic);
		}
	});
});
