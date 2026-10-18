import { describe, expect, it } from "vitest";
import { compiler } from "#test/compiler.ts";

const COMPILER_TIMEOUT = 60_000;

const invalidFixtures = {
	commandQuery: "Property 'query' does not exist",
	duplicateCommand: "Operation names must be unique; duplicated: save",
	duplicateName: "Operation names must be unique; duplicated: same",
	duplicateQuery: "Operation names must be unique; duplicated: get",
	fieldRejection: `Type '"body"' is not assignable to type '"title"'`,
	handlerMismatch: "missing the following properties from type 'Note': body, title",
	"incompatibleClient": "is not assignable",
	"incompatibleErrors": "is not assignable",
	"incompleteClient": "is not assignable",
	inlineReject: "Property 'Anything' does not exist",
	inlineSuccess: "Type 'number' is not assignable to type 'void",
	invalidatesResult: "Property 'missing' does not exist on type 'Note'",
	keyId: "Argument of type 'string' is not assignable to parameter of type 'number'",
	readsPayload: "Property 'slug' does not exist on type '{ readonly id: number; }'",
	rejectionTag: "must have that _tag",
	undeclaredRejection: "Property 'id' is missing in type 'Other' but required in type 'NoteMissing'",
	unknownReject: "Property 'Other' does not exist",
	wrongPayload: "Type 'string' is not assignable to type 'number'",
	zeroRejections: "Property 'members' does not exist on type 'Never'",
} as const;

describe("contract compiler fixtures", { timeout: COMPILER_TIMEOUT }, () => {
	it("accepts the valid contract, binding and handlers", () => {
		const { result, declaration } = compiler.declarations();
		expect(result.stderr || result.stdout).toBe("");
		expect(result.status).toBe(0);
		expect(declaration).toContain('Rpc<"notes.rename"');
	});

	it("rejects each invalid use with a specific diagnostic", () => {
		const result = compiler.invalid(Object.keys(invalidFixtures));
		const diagnostics = (result.stderr || result.stdout).split(/(?=^src\/test-support\/fixtures\/invalid\/)/mu);
		expect(result.status).not.toBe(0);
		for (const [fixture, expected] of Object.entries(invalidFixtures)) {
			const found = diagnostics.filter((message) => message.startsWith(`src/test-support/fixtures/invalid/${fixture}.ts(`)).join("\n");
			expect(found, fixture).toContain(expected);
		}
	});
});
