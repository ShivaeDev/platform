import { describe, expect } from "@effect/vitest";
import { postgresTests } from "#test/postgres.ts";
import { reportFileFailureCase } from "#test/reportFileFailureCase.ts";

describe("report file failure decisions", () => {
	const test = postgresTests("test");
	for (const [scenario, cause] of [
		["escape", "Attachment path escapes scratch folder"],
		["oversized-payload", "Report payload exceeds size limit"],
		["changed-file", "Attachment changed after validation"],
	] as const) {
		test(`parks ${scenario} with the file and its cause`, function* () {
			const { parked, stored, path, launched } = yield* reportFileFailureCase(scenario);
			expect(parked.stage).toBe("needs-human");
			expect(parked.decision?.reason).toBe(`${path}: ${cause}`);
			expect(stored.decision?.reason).toBe(`${path}: ${cause}`);
			expect(parked.report).toBeUndefined();
			expect(launched).toHaveLength(1);
		});
	}
});
