import { expect } from "vitest";
import { publicHttpApp } from "#test/fakeHttpApp.ts";

for (const [reply, method, path, contentType] of [
	["an empty 204 reply carries no content type", "DELETE", "/roles/7", undefined],
	["an empty reply keeps the content type its route names", "DELETE", "/receipts/7", "text/plain"],
	["a body defaults to the JSON content type", "GET", "/users/7", "application/json"],
	["streamed chunks default to the JSON content type", "GET", "/feed", "application/json"],
] as const) {
	publicHttpApp.it(reply, [], function* ({ header, sends }) {
		yield* sends("client", path, { method });

		expect(yield* header("client", "content-type")).toBe(contentType);
	});
}
