import { Result, Schema } from "effect";
import { LockTimeoutError, SqlError, UniqueViolation } from "effect/sql/SqlError";
import { expect, it } from "vitest";
import { infrastructureRejection } from "#infrastructure.ts";
import { ServiceUnavailable } from "#taxonomy.ts";

it("a retryable failure becomes ServiceUnavailable that keeps the failure as its cause off the wire", () => {
	const failure = new SqlError({ reason: new LockTimeoutError({ cause: new Error("lock timeout") }) });

	const rejection = infrastructureRejection(failure);

	expect(rejection).toBeInstanceOf(ServiceUnavailable);
	expect(rejection?.cause).toBe(failure);
	expect(JSON.parse(JSON.stringify(rejection))).toEqual({ _tag: "ServiceUnavailable", message: "The service is unavailable. Try again later." });
});

it("a unique violation, which states it is not retryable, has no infrastructure rejection", () => {
	const failure = new SqlError({ reason: new UniqueViolation({ cause: new Error("duplicate key"), constraint: "notes_title_key" }) });

	expect(infrastructureRejection(failure)).toBeUndefined();
});

it("a schema failure has no infrastructure rejection", () => {
	const decoded = Schema.decodeUnknownResult(Schema.Number)("not a number");

	expect(Result.match(decoded, { onFailure: infrastructureRejection, onSuccess: () => "decoded" })).toBeUndefined();
});

for (const [name, failure] of [
	["an error without isRetryable", new Error("disk full")],
	["a string", "disk full"],
	["null", null],
	["a truthy isRetryable that is not true", { isRetryable: "yes" }],
] as const) {
	it(`${name} has no infrastructure rejection`, () => {
		expect(infrastructureRejection(failure)).toBeUndefined();
	});
}
