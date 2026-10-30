import { expect } from "vitest";
import { invalidResponse, jsonResponses, seventeenMiB, unfinishedResponse } from "#test/jsonResponses.ts";

const MEBIBYTE = 1024 * 1024;

for (const operation of ["read", "list", "write"] as const) {
	const decoded = operation === "list" ? [{ number: 1 }] : { number: 1 };

	jsonResponses.it(
		`a ${operation} answered with 3 MiB fails at the default 1 MiB cap before the response ends`,
		[unfinishedResponse],
		function* ({ defaultClient }) {
			expect(yield* defaultClient(operation)).toBe("body over 1 MiB");
		},
	);

	jsonResponses.it(`a ${operation} answered with 3 MiB decodes through a client with a 16 MiB cap`, [], function* ({ raisedClient }) {
		expect(yield* raisedClient(operation)).toEqual(decoded);
	});

	jsonResponses.it(
		`a ${operation} answered with 3 MiB decodes through the default client with a 16 MiB request cap`,
		[],
		function* ({ defaultClient }) {
			expect(yield* defaultClient(operation, 16 * MEBIBYTE)).toEqual(decoded);
		},
	);

	jsonResponses.it(
		`a ${operation} answered with 17 MiB fails at the client's 16 MiB cap before the response ends`,
		[seventeenMiB, unfinishedResponse],
		function* ({ raisedClient }) {
			expect(yield* raisedClient(operation)).toBe("body over 16 MiB");
		},
	);

	jsonResponses.it(
		`a ${operation} answered with 17 MiB fails at a 16 MiB request cap before the response ends`,
		[seventeenMiB, unfinishedResponse],
		function* ({ defaultClient }) {
			expect(yield* defaultClient(operation, 16 * MEBIBYTE)).toBe("body over 16 MiB");
		},
	);

	jsonResponses.it(
		`a ${operation} answered with 3 MiB fails at a 2 MiB request cap below the client's 16 MiB cap before the response ends`,
		[unfinishedResponse],
		function* ({ raisedClient }) {
			expect(yield* raisedClient(operation, 2 * MEBIBYTE)).toBe("body over 2 MiB");
		},
	);

	jsonResponses.it(
		`a ${operation} answered with 3 MiB that breaks the Schema fails as a Schema mismatch under a 16 MiB cap`,
		[invalidResponse],
		function* ({ raisedClient }) {
			expect(yield* raisedClient(operation)).toBe("Schema mismatch");
		},
	);
}
