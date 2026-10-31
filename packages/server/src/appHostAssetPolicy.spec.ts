import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { staticFiles } from "#test/app-host/staticFiles.ts";
import { host } from "#test/app-host/story.ts";

host.it(
	"a per-path cache override uses the public pathname and falls back to defaults",
	[
		staticFiles({
			cacheControl: (pathname) => (pathname === "/app/sign-in" ? "private, max-age=60" : undefined),
			prefix: "/app",
		}),
	],
	function* ({ request }) {
		const override = yield* request("/app/sign-in?next=home", { headers: { accept: "text/html" } });

		expect(override.status).toBe(HttpStatus.fromLiteral("OK"));
		expect(override.headers.get("cache-control")).toBe("private, max-age=60");
		expect(override.headers.get("x-frame-options")).toBe("DENY");

		const defaults = yield* request("/app/assets/app-a1b2c3d4.js");

		expect(defaults.status).toBe(HttpStatus.fromLiteral("OK"));
		expect(defaults.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
	},
);

host.it(
	"a string cache policy still applies to documents and assets",
	[staticFiles({ cacheControl: "private, max-age=30" })],
	function* ({ request }) {
		for (const path of ["/index.html", "/assets/app-a1b2c3d4.js"]) {
			const response = yield* request(path);

			expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
			expect(response.headers.get("cache-control")).toBe("private, max-age=30");
		}
	},
);

host.it(
	"document frame policy can allow same-origin embedding",
	[
		staticFiles({
			documentHeaders: { frameAncestors: "'self'", xFrameOptions: "SAMEORIGIN" },
		}),
	],
	function* ({ request }) {
		const response = yield* request("/index.html");

		expect(response.body).toBe("<main>Hosted app</main>");
		expect(response.headers.get("content-security-policy")).toBe("frame-ancestors 'self'");
		expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
	},
);

host.it(
	"document frame headers can be disabled explicitly",
	[
		staticFiles({
			documentHeaders: { frameAncestors: false, xFrameOptions: false },
		}),
	],
	function* ({ request }) {
		const response = yield* request("/index.html");

		expect(response.body).toBe("<main>Hosted app</main>");
		expect(response.headers.get("content-security-policy")).toBeNull();
		expect(response.headers.get("x-frame-options")).toBeNull();
	},
);
