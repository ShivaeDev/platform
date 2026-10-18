import { expect } from "vitest";
import { generatedDeclarations, normalizerStory } from "#test/normalizerStory.ts";

for (const arguments_ of [[], ["first.d.ts", "second.d.ts"]]) {
	normalizerStory.it(`reports the invocation syntax for ${arguments_.length} arguments`, [], ({ invoke }) => {
		const result = invoke(arguments_);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("Usage: effect-prisma-normalize <generated-contract.d.ts>");
	});
}

normalizerStory.it(
	"normalizes generated timestamps, preserves other fields and can run twice",
	[
		generatedDeclarations(
			[
				"readonly createdAt: Timestamp<6>;",
				"readonly verifiedAt: Timestamptz<3> | null;",
				"readonly deletedAt: Timestamp<undefined>;",
				"readonly output: CodecTypes['pg/timestamp@1']['output'];",
				"readonly input: CodecTypes['pg/timestamptz@1']['input'];",
				"readonly email: string;",
			].join("\n"),
		),
	],
	({ normalize }) => {
		const expected = [
			"readonly createdAt: Date;",
			"readonly verifiedAt: Date | null;",
			"readonly deletedAt: Date;",
			"readonly output: Date;",
			"readonly input: Date;",
			"readonly email: string;",
		].join("\n");
		for (let run = 0; run < 2; run += 1) {
			const result = normalize();
			expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: "" });
			expect(result.contents).toBe(expected);
		}
	},
);

normalizerStory.it(
	"refuses unsupported timestamp declarations without overwriting the generated file",
	[generatedDeclarations("readonly createdAt: Timestamp<Precision>;")],
	({ normalize }) => {
		const result = normalize();
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("Unsupported Prisma Next timestamp declaration");
		expect(result.contents).toBe("readonly createdAt: Timestamp<Precision>;");
	},
);
