import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { ResponseBodyTooLarge } from "@shivaedev/platform/http-client/errors.ts";
import { invalidResponse, jsonResponses, seventeenMiB, unfinishedResponse } from "#test/jsonResponses.ts";

for (const operation of ["read", "list", "write"] as const) {
	jsonResponses.it(`${operation} rejects 3 MiB at the default cap before the response ends`, [unfinishedResponse], function* ({ defaultClient }) {
		expect(yield* defaultClient(operation).pipe(Effect.flip)).toEqual(new ResponseBodyTooLarge({ limit: 1024 * 1024 }));
	});

	jsonResponses.it(`${operation} decodes 3 MiB with a 16 MiB client cap`, [], function* ({ raisedClient }) {
		expect(yield* raisedClient(operation)).toEqual(operation === "list" ? [{ number: 1 }] : { number: 1 });
	});

	jsonResponses.it(`${operation} decodes 3 MiB with a 16 MiB request cap`, [], function* ({ defaultClient }) {
		expect(yield* defaultClient(operation, 16 * 1024 * 1024)).toEqual(operation === "list" ? [{ number: 1 }] : { number: 1 });
	});

	jsonResponses.it(
		`${operation} rejects 17 MiB at the client cap before the response ends`,
		[seventeenMiB, unfinishedResponse],
		function* ({ raisedClient }) {
			expect(yield* raisedClient(operation).pipe(Effect.flip)).toEqual(new ResponseBodyTooLarge({ limit: 16 * 1024 * 1024 }));
		},
	);

	jsonResponses.it(
		`${operation} rejects 17 MiB at the request cap before the response ends`,
		[seventeenMiB, unfinishedResponse],
		function* ({ defaultClient }) {
			expect(yield* defaultClient(operation, 16 * 1024 * 1024).pipe(Effect.flip)).toEqual(new ResponseBodyTooLarge({ limit: 16 * 1024 * 1024 }));
		},
	);

	jsonResponses.it(`${operation} enforces a request cap below the client cap`, [unfinishedResponse], function* ({ raisedClient }) {
		expect(yield* raisedClient(operation, 2 * 1024 * 1024).pipe(Effect.flip)).toEqual(new ResponseBodyTooLarge({ limit: 2 * 1024 * 1024 }));
	});

	jsonResponses.it(`${operation} still Schema-decodes a large response`, [invalidResponse], function* ({ raisedClient }) {
		expect(yield* raisedClient(operation).pipe(Effect.flip)).toBeInstanceOf(Schema.SchemaError);
	});
}
