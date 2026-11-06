import { expect } from "vitest";
import { corsResponse, siblingOrigins } from "#test/app-host/siblingOrigins.ts";
import { host } from "#test/app-host/story.ts";

const siblings = ["https://app.example.com", "https://www.example.com"] as const;

for (const origin of siblings) {
	host.it(`${origin} receives its exact credentialed CORS origin on an RPC response`, [siblingOrigins(siblings)], function* ({ request }) {
		const response = yield* request("/rpc", {
			body: `${JSON.stringify({ _tag: "Request", headers: [], id: "0", payload: {}, tag: "ping" })}\n`,
			headers: { "content-type": "application/ndjson", origin },
			method: "POST",
		});

		expect(corsResponse(response)).toMatchObject({ credentials: "true", origin, status: 200 });
	});
}

for (const path of ["/rpc", "/custom-rpc"]) {
	host.it(
		`a declared sibling's preflight passes at ${path} with credentials and the requested headers`,
		[siblingOrigins(siblings, path === "/custom-rpc" ? path : "/rpc")],
		function* ({ request }) {
			const response = yield* request(path, {
				headers: { "access-control-request-headers": "authorization, content-type", "access-control-request-method": "POST", origin: siblings[0] },
				method: "OPTIONS",
			});

			expect(corsResponse(response)).toEqual({
				credentials: "true",
				headers: "Authorization,Content-Type",
				methods: "POST",
				origin: siblings[0],
				status: 204,
			});
		},
	);
}

for (const method of ["POST", "OPTIONS"]) {
	host.it(`an undeclared origin receives no credentialed CORS for ${method}`, [siblingOrigins(siblings)], function* ({ request }) {
		const response = yield* request("/rpc", {
			headers: { "access-control-request-method": "POST", "content-type": "application/ndjson", origin: "https://elsewhere.example" },
			method,
		});

		expect(corsResponse(response)).toMatchObject({ credentials: null, origin: null, status: 403 });
	});
}

for (const pattern of ["*", "https://*.example.com"]) {
	host.it(`identity's literal ${pattern} does not grant a sibling credentialed CORS`, [siblingOrigins([pattern])], function* ({ request }) {
		const response = yield* request("/rpc", {
			headers: { "access-control-request-method": "POST", origin: siblings[0] },
			method: "OPTIONS",
		});

		expect(corsResponse(response)).toMatchObject({ credentials: null, origin: null, status: 403 });
	});
}
