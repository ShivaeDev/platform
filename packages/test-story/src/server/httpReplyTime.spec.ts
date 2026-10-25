import { expect } from "vitest";
import { timedHttpApp } from "#test/httpFaultApp.ts";

for (const control of ["failOnce", "replyOnce", "scriptFault", "afterFault"] as const) {
	timedHttpApp.it(
		`builds a ${control} reply at arrival on its creation clock`,
		[],
		function* ({ failOnce, replyOnce, scriptFault, advanceTime, request, requests }) {
			function reply(incoming: { path: string; query: URLSearchParams }, now: number) {
				return {
					body: { path: incoming.path, value: incoming.query.get("value") },
					headers: { "x-ratelimit-reset": String(now + 60_000) },
					status: 429,
				};
			}
			if (control === "scriptFault" || control === "afterFault") {
				yield* scriptFault("data", { kind: "status", reply }, { phase: control === "afterFault" ? "after" : "before", repeat: true });
			} else {
				yield* { failOnce, replyOnce }[control]("data", reply);
			}
			yield* advanceTime(12_000);
			const first = yield* request("/data?value=first");
			expect(yield* first.headers).toMatchObject({ headers: { "x-ratelimit-reset": "72000" }, status: 429 });
			expect(yield* first.finished).toEqual({ bytes: Buffer.from('{"path":"/data?value=first","value":"first"}'), kind: "complete" });
			yield* advanceTime(3000);
			const second = yield* request("/data?value=second");
			expect(yield* second.headers).toMatchObject(
				control === "scriptFault" || control === "afterFault" ? { headers: { "x-ratelimit-reset": "75000" }, status: 429 } : { status: 200 },
			);
			yield* second.finished;
			expect(requests()).toEqual([
				"GET /data?value=first 429",
				`GET /data?value=second ${control === "scriptFault" || control === "afterFault" ? 429 : 200}`,
			]);
		},
	);
}

timedHttpApp.it("builds an immediate fault from the held request at refusal time", [], function* ({ hold, advanceTime, request, fault, requests }) {
	const paused = yield* hold("data");
	const client = yield* request("/data?value=held");
	yield* paused.waiting;
	expect(requests()).toEqual(["GET /data?value=held pending"]);
	yield* advanceTime(42_000);
	yield* fault("data", {
		kind: "status",
		reply: (incoming, now) => ({ body: { value: incoming.query.get("value") }, headers: { "x-ratelimit-reset": String(now + 60_000) }, status: 429 }),
	});
	expect(yield* client.headers).toMatchObject({ headers: { "x-ratelimit-reset": "102000" }, status: 429 });
	expect(yield* client.finished).toEqual({ bytes: Buffer.from('{"value":"held"}'), kind: "complete" });
	expect(requests()).toEqual(["GET /data?value=held 429"]);
});
