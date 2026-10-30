import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { development } from "#test/development.ts";

for (const path of ["/health?probe=dev", "/api/auth/session", "/rpc"]) {
	development.it(`serves ${path} through the application host`, [], function* ({ request, origin }) {
		const response = yield* request(path);
		expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
		expect(JSON.parse(response.body)).toEqual({ host: new URL(origin()).host, path });
	});
}
