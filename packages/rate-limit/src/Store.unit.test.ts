import { expect, it } from "vitest";
import { infrastructureRejection } from "@shivaedev/errors/infrastructure.ts";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { StoreError } from "#Store.ts";

for (const [name, cause] of [
	["a retryable cause", { isRetryable: true, message: "connection reset" }],
	["a cause that does not state whether a retry helps", new Error("connection reset")],
] as const) {
	it(`a store failure over ${name} answers ServiceUnavailable that keeps the failure as its cause`, () => {
		const failure = new StoreError({ cause });

		const rejection = infrastructureRejection(failure);

		expect(rejection).toBeInstanceOf(ServiceUnavailable);
		expect(rejection?.cause).toBe(failure);
	});
}

it("a store failure over a cause that states it is not retryable has no infrastructure rejection", () => {
	const failure = new StoreError({ cause: { isRetryable: false, message: "relation rate_limit_windows does not exist" } });

	expect(infrastructureRejection(failure)).toBeUndefined();
});
