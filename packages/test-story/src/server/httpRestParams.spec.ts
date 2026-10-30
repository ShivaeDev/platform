import { expect } from "vitest";
import { publicHttpApp } from "#test/fakeHttpApp.ts";

for (const [rule, path, answer] of [
	["decodes a rest parameter of one segment", "/repos/o/r/contents/a%20b", 'HTTP 200 {"owner":"o","repo":"r","path":"a b"}'],
	[
		"decodes every segment of a longer rest parameter",
		"/repos/o/r/contents/a%20b/c%2Fd/package.json",
		'HTTP 200 {"owner":"o","repo":"r","path":"a b/c/d/package.json"}',
	],
	["keeps an encoded slash inside a plain parameter", "/users/a%2Fb", 'HTTP 200 {"id":"a/b"}'],
	["needs a segment for a rest parameter", "/repos/o/r/contents", "HTTP 404"],
	["needs a non-empty segment for a rest parameter", "/repos/o/r/contents/", "HTTP 404"],
	["matches a plain parameter to one segment only", "/users/a/b", "HTTP 404"],
	["refuses a rest parameter that is not last", "/invalid/a/tail", "HTTP 404"],
	["rejects a malformed escape in a rest parameter", "/repos/o/r/contents/a/%ZZ", "HTTP 400"],
] as const) {
	publicHttpApp.it(`${rule}: ${path} answers ${answer}`, [], function* ({ asks }) {
		expect(yield* asks(path)).toBe(answer);
	});
}
