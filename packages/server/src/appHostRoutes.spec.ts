import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { applicationRoutes } from "#test/app-host/applicationRoutes.ts";
import { host } from "#test/app-host/story.ts";

host.it("serves an HTTP route using an application service", [applicationRoutes()], function* ({ request }) {
	const response = yield* request("/.well-known/app");
	expect(response).toMatchObject({ body: "Public application metadata", status: HttpStatus.fromLiteral("OK") });
});

host.it("lets an application route answer a foreign-origin preflight with native CORS", [applicationRoutes()], function* ({ request }) {
	const response = yield* request("/.well-known/app", {
		headers: { "access-control-request-method": "GET", origin: "https://reader.example" },
		method: "OPTIONS",
	});
	expect(response.status).toBe(HttpStatus.fromLiteral("NoContent"));
	expect(response.headers.get("access-control-allow-origin")).toBe("*");
	expect(response.headers.get("access-control-allow-methods")).toBe("GET");
});

for (const nativeOrigins of [undefined, ["capacitor://localhost"]]) {
	for (const path of ["/rpc", "/api/auth", "/api/auth/get-session"]) {
		host.it(
			`refuses foreign-origin preflight on ${path} with ${nativeOrigins ? "native origins" : "no native origins"}`,
			[applicationRoutes(nativeOrigins === undefined ? {} : { nativeOrigins })],
			function* ({ request }) {
				const response = yield* request(path, {
					headers: { "access-control-request-method": "POST", origin: "https://reader.example" },
					method: "OPTIONS",
				});
				expect(response.status).toBe(HttpStatus.fromLiteral("Forbidden"));
				expect(response.headers.get("access-control-allow-origin")).toBeNull();
			},
		);
	}
}

host.it("protects a configured RPC path", [applicationRoutes({ rpcPath: "/api/rpc" })], function* ({ request }) {
	const response = yield* request("/api/rpc", {
		headers: { "access-control-request-method": "POST", origin: "https://reader.example" },
		method: "OPTIONS",
	});
	expect(response.status).toBe(HttpStatus.fromLiteral("Forbidden"));
});
