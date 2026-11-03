import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { assetAccount, assets } from "#test-support/assets.ts";

for (const pathname of ["/", "/notes", "/admin/users"]) {
	assets.it(
		`${pathname} serves the app document without caching and with frame protections`,
		[assetAccount("operator", "admin")],
		function* ({ request }) {
			const response = yield* request(pathname, "operator");

			expect(response).toEqual({
				body: "<!doctype html><main>Starter app</main>",
				cache: "no-store",
				frameAncestors: "frame-ancestors 'none'",
				frames: "DENY",
				status: HttpStatus.fromLiteral("OK"),
			});
		},
	);
}

for (const [pathname, body, cache] of [
	["/assets/app.12345678.js", 'console.log("Starter app");', "public, max-age=31536000, immutable"],
	["/robots.txt", "User-agent: *", "no-cache"],
] as const) {
	assets.it(`${pathname} serves its content with the shared asset cache policy`, [], function* ({ request }) {
		const response = yield* request(pathname);

		expect(response).toMatchObject({ body, cache, status: HttpStatus.fromLiteral("OK") });
	});
}

for (const [name, status] of [
	["visitor", HttpStatus.fromLiteral("Unauthorized")],
	["reader", HttpStatus.fromLiteral("Forbidden")],
] as const) {
	assets.it(`${name} cannot read an admin document`, [assetAccount("reader", "user")], function* ({ request }) {
		const response = yield* request("/admin/users", name);

		expect(response.status).toBe(status);
	});
}
