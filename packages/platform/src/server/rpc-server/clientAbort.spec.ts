import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { abortableRpc } from "#test/app-host/abortableRpc.ts";
import { hostOptions } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const cancellation = storyKit(hostOptions({ database: true }));

cancellation.it(
	"aborting HTTP interrupts the handler, rolls back its transaction and returns the only pool connection",
	[abortableRpc("transaction"), collector()],
	function* ({ beginRpc, awaitWrite, abortClient, awaitAbort, abortProbe, rpcResult, poolActivity, close, logs, exportedSpans }) {
		yield* beginRpc("hold");
		yield* awaitWrite();
		expect(abortProbe().written).toBe(true);
		expect(yield* poolActivity()).toContainEqual({ state: "idle in transaction" });
		yield* abortClient();
		yield* awaitAbort();
		expect(abortProbe()).toMatchObject({ finalized: true, interrupted: true });
		expect(yield* rpcResult("rows")).toContainEqual(expect.objectContaining({ exit: { _tag: "Success", value: [] } }));
		const activity = yield* poolActivity();
		expect(activity.length).toBeGreaterThan(0);
		expect(activity).not.toContainEqual({ state: "idle in transaction" });
		yield* rpcResult("reject");
		yield* close();
		const interrupted = logs().filter((log) => String(log.message).includes("RPC interrupted"));
		expect(interrupted).toEqual([
			expect.objectContaining({
				annotations: { requestId: "abort-hold", "rpc.method": "hold", "rpc.payload": { password: "<redacted>" } },
				level: "Debug",
				spans: { "rpc.duration": expect.any(Number) },
			}),
		]);
		expect(logs().filter((log) => String(log.message).includes("RPC failure") || String(log.message).includes("RPC defect"))).toEqual([
			expect.objectContaining({ annotations: expect.objectContaining({ "rpc.method": "reject" }) }),
		]);
		const span = exportedSpans().find((candidate) => candidate.kind === 2 && candidate.name === "hold");
		expect(span?.attributes).toContainEqual({ key: "rpc.interrupted", value: { boolValue: true } });
		expect(span?.attributes).toContainEqual({ key: "request.id", value: { stringValue: "abort-hold" } });
		expect(span?.status.code).toBe(0);
		for (const name of ["rows", "reject"]) {
			const finished = exportedSpans().find((candidate) => candidate.kind === 2 && candidate.name === name);
			expect(finished).toBeDefined();
			expect(finished?.attributes.map(({ key }) => key)).not.toContain("rpc.interrupted");
		}
		expect(JSON.stringify(logs())).not.toContain("abort-secret");
	},
);

cancellation.it(
	"aborting a live HTTP subscription finalizes AppChanges and releases its Reactivity registrations",
	[abortableRpc("subscription"), collector()],
	function* ({ beginRpc, nextHint, rpcResult, awaitCommit, abortClient, awaitAbort, abortProbe, close, logs, exportedSpans }) {
		yield* beginRpc("watch");
		expect(yield* nextHint()).toContain('"_tag":"Resync"');
		expect(abortProbe().registrations).toEqual([["abort_items"], [expect.stringMatching(/^@shivaedev\/contract\/resync\//u)]]);
		yield* rpcResult("commit");
		yield* awaitCommit(1);
		expect(yield* nextHint()).toContain('"_tag":"Changed"');
		expect(abortProbe().callbacks).toBeGreaterThan(0);
		yield* abortClient();
		yield* awaitAbort();
		expect(abortProbe()).toMatchObject({ finalized: true, interrupted: true, registrations: [] });
		const callbacks = abortProbe().callbacks;
		yield* rpcResult("commit");
		yield* awaitCommit(2);
		expect(abortProbe().callbacks).toBe(callbacks);
		expect(yield* rpcResult("rows")).toContainEqual(
			expect.objectContaining({
				exit: { _tag: "Success", value: [{ value: "committed" }, { value: "committed" }] },
			}),
		);
		yield* close();
		const interrupted = logs().filter((log) => String(log.message).includes("RPC interrupted"));
		expect(interrupted).toEqual([
			expect.objectContaining({
				annotations: { requestId: "abort-watch", "rpc.method": "watch", "rpc.payload": { password: "<redacted>" } },
				level: "Debug",
				spans: { "rpc.duration": expect.any(Number) },
			}),
		]);
		expect(logs().filter((log) => String(log.message).includes("RPC failure") || String(log.message).includes("RPC defect"))).toEqual([]);
		const span = exportedSpans().find((candidate) => candidate.kind === 2 && candidate.name === "watch");
		expect(span?.attributes).toContainEqual({ key: "rpc.interrupted", value: { boolValue: true } });
		expect(span?.attributes).toContainEqual({ key: "request.id", value: { stringValue: "abort-watch" } });
		expect(span?.status.code).toBe(0);
		expect(JSON.stringify(logs())).not.toContain("abort-secret");
	},
);
