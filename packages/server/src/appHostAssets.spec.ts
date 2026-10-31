import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { staticFiles } from "#test/app-host/staticFiles.ts";
import { host } from "#test/app-host/story.ts";

for (const path of ["/assets/app-a1b2c3d4.js", "/assets/app-DiwrgTda.css?version=2"]) {
	host.it(`${path} receives immutable caching without document frame headers`, [staticFiles()], function* ({ request }) {
		const response = yield* request(path);

		expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
		expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
		expect(response.headers.get("content-security-policy")).toBeNull();
		expect(response.headers.get("x-frame-options")).toBeNull();
	});
}

for (const path of ["/", "/index.html", "/sign-in", "/release-a1b2c3d4.html"]) {
	host.it(`${path} receives no-store caching and denies framing`, [staticFiles()], function* ({ request }) {
		const response = yield* request(path, { headers: { accept: "text/html" } });

		expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
		expect(response.headers.get("x-frame-options")).toBe("DENY");
	});
}

host.it("unversioned assets require revalidation", [staticFiles()], function* ({ request }) {
	const response = yield* request("/service-worker.js");

	expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
	expect(response.headers.get("cache-control")).toBe("no-cache");
});

for (const path of ["/assets/app-a1b2c3d4.js", "/index.html"]) {
	host.it(`${path} keeps its cache and frame policy on a conditional response`, [staticFiles()], function* ({ request }) {
		const initial = yield* request(path);

		const response = yield* request(path, { headers: { "if-none-match": initial.headers.get("etag") ?? "missing" } });

		expect(response.status).toBe(HttpStatus.fromLiteral("NotModified"));
		for (const header of ["cache-control", "content-security-policy", "x-frame-options"]) {
			expect(response.headers.get(header)).toBe(initial.headers.get(header));
		}
	});
}

host.it(
	"custom MIME types and index filenames receive document policy",
	[staticFiles({ index: "shell.page", mimeTypes: { page: "text/html" } })],
	function* ({ request }) {
		const response = yield* request("/");

		expect(response.body).toBe("<main>Custom shell</main>");
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
	},
);

host.it("the assets directory shorthand receives document defaults", [staticFiles({}, true)], function* ({ request }) {
	const response = yield* request("/");

	expect(response.body).toBe("<main>Hosted app</main>");
	expect(response.headers.get("cache-control")).toBe("no-store");
	expect(response.headers.get("x-frame-options")).toBe("DENY");
});

host.it("a partial document retains no-store and frame protection", [staticFiles()], function* ({ request }) {
	const response = yield* request("/index.html", { headers: { range: "bytes=0-5" } });

	expect(response.status).toBe(HttpStatus.fromLiteral("PartialContent"));
	expect(response.headers.get("cache-control")).toBe("no-store");
	expect(response.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
	expect(response.headers.get("x-frame-options")).toBe("DENY");
});

host.it("HEAD documents retain no-store and frame protection", [staticFiles()], function* ({ request }) {
	const response = yield* request("/index.html", { method: "HEAD" });

	expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
	expect(response.headers.get("cache-control")).toBe("no-store");
	expect(response.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
	expect(response.headers.get("x-frame-options")).toBe("DENY");
});
