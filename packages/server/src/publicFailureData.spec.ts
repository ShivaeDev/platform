import { Result } from "effect";
import { expect } from "vitest";
import { publicFailures } from "#test/app-host/publicFailures.ts";
import { host } from "#test/app-host/story.ts";

host.it("native clients receive every item and field of public failure collections", [publicFailures], function* ({ publicFailure, postNdjson }) {
	const payload = {
		items: Array.from({ length: 51 }, (_, index) => index),
		nested: null,
		note: "public detail",
		wide: Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`field${index}`, `public value ${index}`])),
	};
	const response = yield* postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload, tag: "publicFailure" })}\n`, false);
	expect(response.body).toContain(JSON.stringify(payload));
	const received = yield* publicFailure(payload);
	expect(received).toEqual(Result.fail(payload));
});

host.it("native clients receive deep public failure values intact", [publicFailures], function* ({ publicFailure, postNdjson }) {
	let nested: unknown = { value: "public leaf" };
	for (let depth = 0; depth < 10; depth += 1) {
		nested = { child: nested };
	}
	const payload = { items: [1], nested, note: "public detail", wide: {} };
	const response = yield* postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload, tag: "publicFailure" })}\n`, false);
	expect(response.body).toContain(JSON.stringify(payload));
	const received = yield* publicFailure(payload);
	expect(received).toEqual(Result.fail(payload));
});

host.it("native clients receive long public failure text intact", [publicFailures], function* ({ publicFailure, postNdjson }) {
	const payload = { items: [1], nested: null, note: "public detail ".repeat(300), wide: {} };
	const response = yield* postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload, tag: "publicFailure" })}\n`, false);
	expect(response.body).toContain(JSON.stringify(payload));
	const received = yield* publicFailure(payload);
	expect(received).toEqual(Result.fail(payload));
});
