import { expect } from "vitest";
import { rootDefect, rootEncoding } from "#test/app-host/rootEncoding.ts";
import { host } from "#test/app-host/story.ts";

for (const source of ["schema", "host"] as const) {
	for (const shape of ["scalar", "record"] as const) {
		host.it(`masks a sensitive ${source} failure encoded as a root ${shape}`, [rootEncoding(source, shape)], function* ({ postNdjson }) {
			const contact = "private root contact";
			const requests = [
				{ id: "1", payload: { contact, slot: "runtimeChosenField" }, tag: "hidden" },
				{ id: "2", payload: { detail: "public rejection" }, tag: "visibleFailure" },
				{ id: "3", payload: { contact: "successful application value" }, tag: "succeed" },
			];
			const response = yield* postNdjson(
				`${requests.map((request) => JSON.stringify({ _tag: "Request", headers: [], ...request })).join("\n")}\n`,
				false,
			);
			expect(response.status).toBe(200);
			expect(response.body).toContain('"_tag":"Fail","error":"<redacted>"');
			expect(response.body).not.toContain(contact);
			expect(response.body).toContain('"detail":"public rejection"');
			expect(response.body).toContain('"_tag":"Success","value":"successful application value"');
		});
	}
}

for (const interrupt of [false, true]) {
	host.it(`masks a sensitive defect root in ${interrupt ? "an exit cause" : "a connection defect"}`, [rootDefect], function* ({ postNdjson }) {
		const value = "private root defect";
		const response = yield* postNdjson(
			`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: { interrupt, value }, tag: "hiddenDefect" })}\n`,
			false,
		);
		expect(response.status).toBe(200);
		expect(response.body).toContain(`"_tag":"${interrupt ? "Die" : "Defect"}","defect":"<redacted>"`);
		expect(response.body).not.toContain(value);
	});
}

host.it("a repeated request ID cannot replace a sensitive failure's schema policy", [rootEncoding("schema", "scalar")], function* ({ postNdjson }) {
	const contact = "private repeated request contact";
	const requests = [
		{ payload: { contact, slot: "unused" }, tag: "hidden" },
		{ payload: { detail: "public rejection" }, tag: "visibleFailure" },
	];
	const response = yield* postNdjson(
		`${requests.map((request) => JSON.stringify({ _tag: "Request", headers: [], id: "1", ...request })).join("\n")}\n`,
		false,
	);
	expect(response.status).toBe(200);
	expect(response.body).toContain('"_tag":"Fail","error":"<redacted>"');
	expect(response.body).not.toContain(contact);
});

host.it("native numeric request IDs retain their sensitive root policy", [rootEncoding("schema", "scalar")], function* ({ postNdjson }) {
	const contact = "private numeric request contact";
	const response = yield* postNdjson(
		`${JSON.stringify({ _tag: "Request", headers: [], id: 1, payload: { contact, slot: "unused" }, tag: "hidden" })}\n`,
		false,
	);
	expect(response.body).toContain('"_tag":"Fail","error":"<redacted>"');
	expect(response.body).not.toContain(contact);
});
