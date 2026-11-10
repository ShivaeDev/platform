import { expect, it } from "vitest";
import { infrastructureRejection } from "@shivaedev/errors/infrastructure.ts";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { StoreError } from "#Store.ts";

it("a store failure is a retryable infrastructure failure that answers ServiceUnavailable", () => {
	const failure = new StoreError({ cause: new Error("connection reset") });

	const rejection = infrastructureRejection(failure);

	expect(rejection).toBeInstanceOf(ServiceUnavailable);
	expect(rejection?.cause).toBe(failure);
});
