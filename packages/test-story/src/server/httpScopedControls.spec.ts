import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { scopedHttpApp } from "#test/scopedHttpApp.ts";

scopedHttpApp.it("consumes a scoped failure only when every decoded path parameter matches", [], function* ({ failOnce, request }) {
	yield* failOnce("pull", { status: 503 }, { params: { number: "7", owner: "a/b", repo: "platform" } });
	for (const path of ["/repos/other/platform/pulls/7", "/repos/a%2Fb/other/pulls/7", "/repos/a%2Fb/platform/pulls/8"]) {
		const other = yield* request(path);
		expect(yield* other.headers).toMatchObject({ status: 200 });
	}
	const target = yield* request("/repos/a%2Fb/platform/pulls/7");
	expect(yield* target.headers).toMatchObject({ status: 503 });
	const next = yield* request("/repos/a%2Fb/platform/pulls/7");
	expect(yield* next.headers).toMatchObject({ status: 200 });
});

scopedHttpApp.it("stalls one pull while another pull on the same route finishes", [], function* ({ stall, request }) {
	const paused = yield* stall("pull", { params: { number: "7" } });
	const target = yield* request("/repos/team/platform/pulls/7");
	yield* paused.waiting;
	const pending = yield* Effect.forkChild(target.finished);
	const other = yield* request("/repos/team/platform/pulls/8");
	expect(yield* other.finished).toEqual({ bytes: Buffer.from('{"owner":"team","repo":"platform","number":"8"}'), kind: "complete" });
	expect(pending.pollUnsafe()).toBeUndefined();
	yield* paused.release;
	expect(yield* Fiber.join(pending)).toMatchObject({ kind: "complete" });
});

scopedHttpApp.it("injects an immediate fault into the selected arrived pull", [], function* ({ stall, fault, request }) {
	const paused = yield* stall("pull");
	const other = yield* request("/repos/team/platform/pulls/8");
	yield* paused.waiting;
	const target = yield* request("/repos/team/platform/pulls/7");
	expect(yield* target.headers).toMatchObject({ status: 200 });
	yield* fault("pull", { kind: "reset" }, { params: { number: "7" } });
	expect(yield* target.finished).toMatchObject({ code: "ECONNRESET", kind: "error" });
	const pending = yield* Effect.forkChild(other.finished);
	expect(pending.pollUnsafe()).toBeUndefined();
	yield* paused.release;
	expect(yield* Fiber.join(pending)).toMatchObject({ kind: "complete" });
});

scopedHttpApp.it("repeats a scoped dropped connection three times until its narrated lift", [], function* ({ scriptFault, request, story }) {
	const outage = yield* scriptFault("pull", { kind: "drop" }, { params: { number: "7" }, repeat: true });
	const other = yield* request("/repos/team/platform/pulls/8");
	expect(yield* other.headers).toMatchObject({ status: 200 });
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const client = yield* request("/repos/team/platform/pulls/7");
		expect(yield* client.headers).toMatchObject({ code: "ECONNRESET", kind: "error" });
	}
	yield* outage.lift;
	const recovered = yield* request("/repos/team/platform/pulls/7");
	expect(yield* recovered.headers).toMatchObject({ status: 200 });
	expect(story.lines).toContain('fake HTTP pull matching {"number":"7"} fault drop lifted');
});

scopedHttpApp.it("keeps a status reply installed until lifted", [], function* ({ scriptFault, request }) {
	const outage = yield* scriptFault("pull", { kind: "status", reply: { headers: { "retry-after": "3" }, status: 429 } }, { repeat: true });
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const client = yield* request("/repos/team/platform/pulls/7");
		expect(yield* client.headers).toMatchObject({ headers: { "retry-after": "3" }, status: 429 });
	}
	yield* outage.lift;
	const recovered = yield* request("/repos/team/platform/pulls/7");
	expect(yield* recovered.headers).toMatchObject({ status: 200 });
});

scopedHttpApp.it("holds every matching decoded scope while other scopes keep answering", [], function* ({ hold, request, requests }) {
	const paused = yield* hold("pull", { params: { number: "7", owner: "a/b" } });
	const first = yield* request("/repos/a%2Fb/platform/pulls/7");
	yield* paused.waiting;
	const second = yield* request("/repos/a%2Fb/platform/pulls/7");
	const other = yield* request("/repos/a%2Fb/platform/pulls/8");
	expect(yield* other.finished).toMatchObject({ kind: "complete" });
	const elsewhere = yield* request("/repos/other/platform/pulls/7");
	expect(yield* elsewhere.finished).toMatchObject({ kind: "complete" });
	expect(requests()).toEqual([
		"GET /repos/a%2Fb/platform/pulls/7 pending",
		"GET /repos/a%2Fb/platform/pulls/7 pending",
		"GET /repos/a%2Fb/platform/pulls/8 200",
		"GET /repos/other/platform/pulls/7 200",
	]);
	yield* paused.release;
	expect(yield* first.finished).toMatchObject({ kind: "complete" });
	expect(yield* second.finished).toMatchObject({ kind: "complete" });
});

scopedHttpApp.it("holds only the first matching request until release", [], function* ({ hold, request, requests }) {
	const paused = yield* hold("pull", { once: true, params: { number: "7" } });
	const other = yield* request("/repos/team/platform/pulls/8");
	expect(yield* other.finished).toMatchObject({ kind: "complete" });
	const first = yield* request("/repos/team/platform/pulls/7");
	yield* paused.waiting;
	const second = yield* request("/repos/team/platform/pulls/7");
	expect(yield* second.finished).toEqual({ bytes: Buffer.from('{"owner":"team","repo":"platform","number":"7"}'), kind: "complete" });
	expect(requests()).toEqual([
		"GET /repos/team/platform/pulls/8 200",
		"GET /repos/team/platform/pulls/7 pending",
		"GET /repos/team/platform/pulls/7 200",
	]);
	yield* paused.release;
	expect(yield* first.finished).toMatchObject({ kind: "complete" });
});

scopedHttpApp.it("releases the selected scoped hold on an authorized arrival", [], function* ({ hold, releaseOnArrival, request, requests }) {
	const target = yield* hold("pull", { once: true, params: { number: "7" } });
	const other = yield* hold("pull", { params: { number: "8" } });
	yield* releaseOnArrival("pull", "installation", { params: { number: "7" } });
	const first = yield* request("/repos/team/platform/pulls/7");
	yield* target.waiting;
	const second = yield* request("/repos/team/platform/pulls/8");
	yield* other.waiting;
	const trigger = yield* request("/installations/4");
	expect(yield* trigger.finished).toMatchObject({ kind: "complete" });
	expect(yield* first.finished).toMatchObject({ kind: "complete" });
	expect(requests()).toContain("GET /repos/team/platform/pulls/8 pending");
	yield* other.release;
	expect(yield* second.finished).toMatchObject({ kind: "complete" });
});
