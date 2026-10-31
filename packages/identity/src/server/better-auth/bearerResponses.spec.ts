import { expect } from "vitest";
import { bearerResponses, providerResponds } from "#test/better-auth/bearerResponses.ts";

for (const { name, body, contentType, status } of [
	{ body: '{ "token": "redirect-body" }', contentType: "application/json", name: "a redirect with a JSON body", status: 302 },
	{ body: "", contentType: "application/json", name: "an empty JSON body", status: 200 },
	{ body: " \n", contentType: "application/json", name: "a whitespace-only JSON body", status: 200 },
	{ body: '{ "message": "unfinished"', contentType: "application/json", name: "malformed JSON", status: 200 },
	{ body: '{ "token": "plain-text" }', contentType: "text/plain", name: "a body without a JSON content type", status: 200 },
	{ body: null, contentType: "application/json", name: "a bodyless response with a JSON content type", status: 204 },
]) {
	bearerResponses.it(`preserves ${name} and its response metadata`, [providerResponds(body, contentType, status)], function* ({ request }) {
		const response = yield* request();

		expect(response).toEqual({ body: body ?? "", contentType, cookie: "application-cookie=value; HttpOnly", location: "/callback", status });
	});
}
