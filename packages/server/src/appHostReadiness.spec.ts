import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { constructionHeldIn, readiness } from "#test/readiness.ts";

for (const held of ["services", "handlers", "routes"] as const) {
	readiness.it(
		`a host refuses TCP connections while its ${held} are constructed and answers its first request once they finish`,
		[constructionHeldIn(held)],
		function* ({ connectionAttempt, constructionFinishes, firstResponse }) {
			expect(yield* connectionAttempt()).toBe("refused");

			yield* constructionFinishes();

			expect(yield* firstResponse()).toEqual({ body: "Ready", status: HttpStatus.fromLiteral("OK") });
		},
	);
}
