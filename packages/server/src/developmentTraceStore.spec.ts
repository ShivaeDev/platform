import { expect } from "vitest";
import { localTraces } from "#test/localTraces.ts";

localTraces.it("closing the scope persists a real span and its correlated redacted log with configured indexes", [], function* ({ open, read }) {
	const recorder = yield* open();
	yield* recorder.record();
	expect((yield* read()).spans).toEqual([]);
	yield* recorder.close();
	const { attributes, logs, spans } = yield* read();
	const span = spans.find((row) => row.name === "checkout");
	expect(span).toBeDefined();
	expect(logs).toEqual([expect.objectContaining({ "span_id": span?.span_id, "trace_id": span?.trace_id })]);
	expect(logs[0]?.data).toContain("password=<redacted>");
	expect(span?.data).toContain('"password":"<redacted>"');
	expect(JSON.stringify({ attributes, logs, spans })).not.toContain("hidden-");
	expect(attributes).toEqual([
		{ key: "orderId", value: "order-42" },
		{ key: "password", value: "<redacted>" },
	]);
});

localTraces.it("the development configuration records locally without a collector", [], function* ({ open, read }) {
	const recorder = yield* open(true);
	yield* recorder.record();
	yield* recorder.close();
	expect((yield* read()).spans.map((row) => row.name)).toEqual(["effect.log", "checkout"]);
});

localTraces.it("production without an endpoint creates no local store", [], function* ({ open, storeExists }) {
	const recorder = yield* open(true, "production");
	yield* recorder.record();
	yield* recorder.close();
	expect(yield* storeExists()).toBe(false);
});

localTraces.it("the timer persists a batch before scope close", [], function* ({ open, read, secondPasses }) {
	const recorder = yield* open();
	yield* recorder.record();
	yield* secondPasses();
	expect((yield* read()).spans.map((row) => row.name)).toEqual(["effect.log", "checkout"]);
});

localTraces.it("closing a third run drops spans, correlated logs and indexes beyond the two-run retention limit", [], function* ({ open, read }) {
	for (const name of ["oldest", "middle", "latest"]) {
		const recorder = yield* open();
		yield* recorder.record(name);
		yield* recorder.close();
	}
	const { attributes, logs, runs, spans } = yield* read();
	expect(spans.map((row) => row.name)).toEqual(["effect.log", "middle", "effect.log", "latest"]);
	expect(runs.map((row) => row.id)).toEqual([...new Set(spans.map((row) => row.run_id))]);
	expect(logs.map((row) => row.span_id)).toEqual(spans.filter((row) => row.name !== "effect.log").map((row) => row.span_id));
	expect(attributes).toEqual([
		{ key: "orderId", value: "order-42" },
		{ key: "orderId", value: "order-42" },
		{ key: "password", value: "<redacted>" },
		{ key: "password", value: "<redacted>" },
	]);
});

localTraces.it("retention leaves an active recorder able to flush until its scope closes", [], function* ({ open, read, secondPasses }) {
	const active = yield* open();
	for (const name of ["oldest", "middle", "latest"]) {
		const recorder = yield* open();
		yield* recorder.record(name);
		yield* recorder.close();
	}
	yield* active.record("active");
	yield* secondPasses();
	expect((yield* read()).spans.map((row) => row.name)).toEqual(["effect.log", "middle", "effect.log", "latest", "effect.log", "active"]);
	yield* active.close();
	expect((yield* read()).spans.map((row) => row.name)).toEqual(["effect.log", "middle", "effect.log", "latest"]);
});

localTraces.it("local recording preserves the application's installed native tracer", [], function* ({ nativeSpanNames, open }) {
	const recorder = yield* open();
	yield* recorder.record();
	yield* recorder.close();
	expect(yield* nativeSpanNames()).toEqual(["checkout", "effect.log"]);
});

localTraces.it("two scoped recorders share a store and flush their own batches", [], function* ({ open, read }) {
	const server = yield* open();
	const worker = yield* open();
	yield* server.record("server");
	yield* worker.record("worker");
	yield* server.close();
	yield* worker.close();
	expect((yield* read()).spans.map((row) => row.name)).toEqual(["effect.log", "server", "effect.log", "worker"]);
});
