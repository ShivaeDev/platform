import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { app, behindHttpsProxy, signedIn } from "#modules/notes/test-support/application.ts";

for (const publicUrl of ["with PUBLIC_URL", "without PUBLIC_URL"] as const) {
	app.it(`behind an HTTPS proxy ${publicUrl}, alice creates a note`, [behindHttpsProxy(publicUrl), signedIn("alice")], function* ({ notesOf }) {
		expect(yield* notesOf("alice").list()).toEqual([]);

		const note = yield* notesOf("alice").create("A note behind TLS");

		expect(yield* notesOf("alice").list()).toEqual([note]);
	});

	app.it(
		`behind an HTTPS proxy ${publicUrl}, a page on a foreign origin is forbidden to use alice's cookie`,
		[behindHttpsProxy(publicUrl), signedIn("alice")],
		function* ({ foreignOriginCalls }) {
			const status = yield* foreignOriginCalls("alice");

			expect(status).toBe(HttpStatus.fromLiteral("Forbidden"));
		},
	);
}
