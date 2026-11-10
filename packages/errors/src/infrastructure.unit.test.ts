import { Data, Result, Schema } from "effect";
import { expect, it } from "vitest";
import { infrastructureRejection } from "#infrastructure.ts";
import { ServiceUnavailable } from "#taxonomy.ts";

class LostConnection extends Data.TaggedError("LostConnection")<{ readonly message: string }> {
	get isRetryable(): boolean {
		return true;
	}
}

class DuplicateTitle extends Data.TaggedError("DuplicateTitle")<{ readonly message: string }> {
	get isRetryable(): boolean {
		return false;
	}
}

it("a retryable failure becomes ServiceUnavailable that keeps the failure as its cause off the wire", () => {
	const failure = new LostConnection({ message: "connection reset" });

	const rejection = infrastructureRejection(failure);

	expect(rejection).toBeInstanceOf(ServiceUnavailable);
	expect(rejection?.cause).toBe(failure);
	expect(JSON.parse(JSON.stringify(rejection))).toEqual({ _tag: "ServiceUnavailable", message: "The service is unavailable. Try again later." });
});

it("a failure that states it is not retryable has no infrastructure rejection", () => {
	expect(infrastructureRejection(new DuplicateTitle({ message: "duplicate key" }))).toBeUndefined();
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
