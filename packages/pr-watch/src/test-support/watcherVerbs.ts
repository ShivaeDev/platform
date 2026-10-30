import { Context, Deferred, Effect, Fiber, Layer } from "effect";
import type { Engine } from "#test/engine.ts";
import type { Operation } from "#test/io.ts";
import { Watcher } from "#Watcher.ts";
export function watcherVerbs(engine: Engine, tell: (line: string) => void) {
	const poll = Effect.gen(function* () {
		tell("the watcher polls GitHub");
		const before = engine.lines.length;
		const state = yield* engine.watcher.load(engine.options);
		return yield* engine.watcher.poll(engine.options, state, engine.emit, engine.diagnostic).pipe(
			Effect.ensuring(
				Effect.sync(() => {
					for (const line of engine.lines.slice(before)) {
						tell(`emitted ${line}`);
					}
				}),
			),
		);
	});
	const restart = Effect.gen(function* () {
		tell("the watcher restarts from stored history");
		engine.context = yield* Layer.build(Layer.fresh(engine.layer));
		engine.watcher = Context.get(engine.context, Watcher);
		return yield* poll;
	});
	return {
		delay: () => engine.watcher.delay(60_000),
		diagnostics: engine.diagnostics,
		eventNames: () => engine.lines.map((line) => JSON.parse(line).event),
		events: () => engine.lines.map((line) => JSON.parse(line)),
		fileOperationFails: (operation: Operation) => {
			tell(`the native filesystem fails to ${operation}`);
			engine.io.control.failure = operation;
		},
		interruptPollAt: (point: "output" | "replacement") =>
			Effect.gen(function* () {
				tell(`the watcher is interrupted during ${point}`);
				const started = yield* Deferred.make<void>();
				const finish = yield* Deferred.make<void>();
				if (point === "replacement") {
					engine.io.control.replacement = { finish, started };
				}
				function emit(line: string) {
					return Effect.gen(function* () {
						yield* engine.emit(line);
						if (point === "output") {
							yield* Deferred.succeed(started, undefined);
							yield* Deferred.await(finish);
						}
					});
				}
				const state = yield* engine.watcher.load(engine.options);
				const running = yield* Effect.forkChild(engine.watcher.poll(engine.options, state, emit, engine.diagnostic));
				yield* Deferred.await(started);
				const stopping = yield* Effect.forkChild(Fiber.interrupt(running));
				yield* Effect.yieldNow;
				yield* Deferred.succeed(finish, undefined);
				yield* Fiber.join(stopping);
				delete engine.io.control.replacement;
			}),
		io: engine.io,
		lines: engine.lines,
		options: engine.options,
		poll,
		pollOutcome: () => poll.pipe(Effect.match({ onFailure: () => "failed" as const, onSuccess: () => "observed" as const })),
		requests: engine.requests,
		restart,
		saved: () => engine.watcher.load(engine.options),
		stateMode: () => engine.io.fs.stat(engine.options.stateFile).pipe(Effect.map((stat) => stat.mode & 0o777)),
		stateTextIs: (text: string) =>
			Effect.gen(function* () {
				tell(`stored history is ${text}`);
				yield* engine.io.fs.writeFileString(engine.options.stateFile, text);
			}),
		stored: () => engine.io.fs.readFileString(engine.options.stateFile).pipe(Effect.map((text) => JSON.parse(text))),
		transitions: () => engine.lines.map((line) => JSON.parse(line)).filter((event) => event.number !== undefined),
		transportFails: (fails = true) => {
			tell(`the native HTTP transport ${fails ? "fails" : "recovers"}`);
			engine.io.control.transportFails = fails;
		},
		transportStalls: (stalls = true) => {
			tell(`the native HTTP transport ${stalls ? "stalls" : "resumes"}`);
			engine.io.control.transportStalls = stalls;
		},
	};
}
