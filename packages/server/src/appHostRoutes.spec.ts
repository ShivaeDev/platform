import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { applicationRoutes } from "#test/app-host/applicationRoutes.ts";
import { host } from "#test/app-host/story.ts";

host.it("an application HTTP route answers from an application service", [applicationRoutes()], function* ({ request }) {
	expect(yield* request("/.well-known/app")).toMatchObject({ body: "Public application metadata", status: HttpStatus.fromLiteral("OK") });
});

host.it("an application route answers a foreign-origin preflight with its own CORS policy", [applicationRoutes()], function* ({ preflight }) {
	expect(yield* preflight("/.well-known/app", "GET")).toEqual({
		allowedMethods: "GET",
		allowedOrigin: "*",
		status: HttpStatus.fromLiteral("NoContent"),
	});
});

for (const [nativeOrigins, listed] of [
	[undefined, "no native origins"],
	[["capacitor://localhost"], "native origins"],
] as const) {
	for (const path of ["/rpc", "/api/auth", "/api/auth/get-session"]) {
		host.it(
			`a foreign-origin preflight to ${path} is forbidden without CORS headers with ${listed} listed`,
			[applicationRoutes(nativeOrigins === undefined ? {} : { nativeOrigins })],
			function* ({ preflight }) {
				expect(yield* preflight(path, "POST")).toEqual({ allowedMethods: null, allowedOrigin: null, status: HttpStatus.fromLiteral("Forbidden") });
			},
		);
	}
}

host.it("a foreign-origin preflight to a configured RPC path is forbidden", [applicationRoutes({ rpcPath: "/api/rpc" })], function* ({ preflight }) {
	expect(yield* preflight("/api/rpc", "POST")).toMatchObject({ status: HttpStatus.fromLiteral("Forbidden") });
});
