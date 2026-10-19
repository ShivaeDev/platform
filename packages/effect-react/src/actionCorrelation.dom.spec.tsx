import { Option, Schema } from "effect";
import { expect } from "vitest";
import { actions, screen } from "#test/action-trace/story.tsx";

for (const mode of ["action", "create", "editor"] as const) {
	actions.it(
		`a click on the ${mode} screen carries one trace through RPC, SQL and enqueue to a linked worker`,
		[screen(mode)],
		function* ({ click, headers, observe, ready, spans, stored, work }) {
			const rpcsPerAction = 2;
			const totalRpcs = rpcsPerAction * 2;
			yield* click();
			yield* observe("the first action finishes two RPCs and Write is ready again", () => {
				expect(spans().filter(({ name }) => name === "Action.enqueue")).toHaveLength(rpcsPerAction);
				expect(ready()).toBe(true);
			});
			yield* click();
			yield* observe("the second action finishes two RPCs and Write is ready again", () => {
				expect(spans().filter(({ name }) => name === "Action.enqueue")).toHaveLength(totalRpcs);
				expect(ready()).toBe(true);
			});
			const calls = headers();
			expect(calls).toHaveLength(totalRpcs);
			for (const header of calls) {
				expect(header).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/u);
			}
			const traces = calls.map((header) => header.split("-")[1]);
			expect(traces[0]).toBe(traces[1]);
			expect(traces[2]).toBe(traces[3]);
			expect(traces[0]).not.toBe(traces[2]);
			for (const traceId of [traces[0], traces[2]]) {
				const trace = spans().filter((span) => span.traceId === traceId);
				expect(trace.filter(({ name, kind }) => name === "write" && kind === "server")).toHaveLength(rpcsPerAction);
				expect(trace.filter(({ name }) => name === "postgres")).toHaveLength(rpcsPerAction);
				expect(trace.filter(({ name }) => name === "Action.enqueue")).toHaveLength(rpcsPerAction);
				for (const rpc of trace.filter(({ name, kind }) => name === "write" && kind === "server")) {
					expect(rpc.attributes.get("request.id")).toMatch(/^[a-f0-9]{32}$/u);
					expect(Option.isSome(rpc.parent)).toBe(true);
				}
			}
			const jobs = Schema.decodeUnknownSync(
				Schema.Array(
					Schema.Struct({ payload: Schema.Struct({ id: Schema.Number }), span: Schema.Struct({ spanId: Schema.String, traceId: Schema.String }) }),
				),
			)(yield* stored());
			expect(jobs).toHaveLength(totalRpcs);
			for (const data of jobs) {
				expect(data.span.traceId).toBe(traces[data.payload.id - 1]);
				expect(spans()).toContainEqual(expect.objectContaining({ name: "Action.enqueue", spanId: data.span.spanId, traceId: data.span.traceId }));
			}
			yield* work();
			yield* observe("each worker attempt links back to its enqueue span", () => {
				const attempts = spans().filter(({ name }) => name === "action-work");
				expect(attempts).toHaveLength(totalRpcs);
				for (const data of jobs) {
					const worker = attempts.find((span) => span.links.some((link) => link.span.spanId === data.span.spanId));
					expect(worker).toBeDefined();
					expect(worker?.traceId).not.toBe(data.span.traceId);
					expect(worker?.links).toEqual(expect.arrayContaining([expect.objectContaining({ span: expect.objectContaining(data.span) })]));
				}
			});
		},
		20_000,
	);
}
