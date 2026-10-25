import { expect } from "vitest";
import { publicHttpApp } from "#test/fakeHttpApp.ts";

publicHttpApp.it("routes and decodes one or more trailing path segments", [], function* ({ probe, recordedRequests }) {
	for (const path of ["a%20b", "a%20b/c%2Fd/package.json"]) {
		const client = yield* probe(`/repos/o/r/contents/${path}`);
		expect(yield* client.headers).toMatchObject({ status: 200 });
		expect(yield* client.finished).toEqual({
			bytes: Buffer.from(path === "a%20b" ? '{"owner":"o","repo":"r","path":"a b"}' : '{"owner":"o","repo":"r","path":"a b/c/d/package.json"}'),
			kind: "complete",
		});
	}
	expect(recordedRequests()).toEqual(["GET /repos/o/r/contents/a%20b 200", "GET /repos/o/r/contents/a%20b/c%2Fd/package.json 200"]);
});

publicHttpApp.it("requires a rest segment, keeps plain params singular and refuses nonfinal rest params", [], function* ({ probe }) {
	for (const path of ["/repos/o/r/contents", "/repos/o/r/contents/", "/users/a/b", "/invalid/a/tail"]) {
		const client = yield* probe(path);
		expect(yield* client.headers).toMatchObject({ status: 404 });
	}
	const user = yield* probe("/users/a%2Fb");
	expect(yield* user.finished).toEqual({ bytes: Buffer.from('{"id":"a/b"}'), kind: "complete" });
	const malformed = yield* probe("/repos/o/r/contents/a/%ZZ");
	expect(yield* malformed.headers).toMatchObject({ status: 400 });
});
