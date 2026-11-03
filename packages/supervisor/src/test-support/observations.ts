import process from "node:process";
import { Effect, Fiber, Stream, SubscriptionRef } from "effect";
import { child, type Engine } from "#test/engine.ts";

export function started(engine: Engine, name: string) {
	return Stream.fromQueue(child(engine, name).output).pipe(
		Stream.filter((line) => line.text.startsWith("started:")),
		Stream.runHead,
		Effect.map((line) => {
			if (line._tag === "None") {
				throw new Error("Child did not start");
			}
			return { at: line.value.at, pid: Number(line.value.text.slice(8)) };
		}),
	);
}
export function running(engine: Engine, name: string) {
	return Fiber.join(child(engine, name).fiber);
}
export function ready(engine: Engine, name: string) {
	return running(engine, name).pipe(Effect.flatMap((handle) => SubscriptionRef.get(handle.state)));
}
export function backoff(engine: Engine, name: string) {
	return running(engine, name).pipe(
		Effect.flatMap((handle) =>
			SubscriptionRef.changes(handle.state).pipe(
				Stream.filter((state) => state.status === "backoff"),
				Stream.runHead,
			),
		),
		Effect.map((state) => {
			if (state._tag === "None" || state.value.status !== "backoff") {
				throw new Error("No restart backoff");
			}
			return state.value.delay;
		}),
	);
}
export function alive(pid: number) {
	return Effect.sync(() => {
		try {
			process.kill(pid, 0);
			return true;
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "ESRCH") {
				return false;
			}
			throw error;
		}
	});
}
export function awaitReady(engine: Engine, name: string, pid: number) {
	return running(engine, name).pipe(
		Effect.flatMap((handle) =>
			SubscriptionRef.changes(handle.state).pipe(
				Stream.filter((state) => state.status === "ready" && state.pid === pid),
				Stream.runHead,
			),
		),
	);
}
