import { constants } from "node:fs";
import { Context, Deferred, Effect, Fiber, Layer, Schema } from "effect";
import { State } from "#model.ts";
import { requestFailure } from "#requestFailure.ts";
import { Watcher } from "#Watcher.ts";
import type { Engine } from "./engine.ts";
import { type FileOperation, type Gate, makeGate, passGate } from "./io.ts";
import { clockTime, described, request, snapshotPhrase, transitionLines } from "./readouts.ts";
import { GRAPHQL, REPOSITORY } from "./server.ts";

export function emitTo(engine: Engine) {
	return (line: string) =>
		Effect.sync(() => {
			engine.lines.push(line);
		});
}

export function diagnosticTo(engine: Engine) {
	return (failure: unknown) =>
		Effect.sync(() => {
			engine.diagnostics.push(typeof failure === "string" ? failure : requestFailure(failure).message);
		});
}

export function pollOnce(engine: Engine) {
	return Effect.gen(function* () {
		engine.roundStart = engine.github.requests.length;
		const state = yield* engine.watcher.load(engine.options);
		yield* engine.watcher.poll(engine.options, state, emitTo(engine), diagnosticTo(engine));
		return "polled";
	}).pipe(
		Effect.catch((error) =>
			Effect.sync(() => {
				engine.observation.failure = error;
				return `failed: ${requestFailure(error).message}`;
			}),
		),
		Effect.tap((outcome) =>
			Effect.sync(() => {
				engine.lastPoll = outcome;
			}),
		),
	);
}

function savedState(engine: Engine) {
	return engine.io.fs.readFileString(engine.options.stateFile).pipe(
		Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(State))),
		Effect.catchTag("PlatformError", (error) => (error.reason._tag === "NotFound" ? Effect.succeed(undefined) : Effect.fail(error))),
	);
}

function permissions(mode: number) {
	return [
		constants.S_IRUSR,
		constants.S_IWUSR,
		constants.S_IXUSR,
		constants.S_IRGRP,
		constants.S_IWGRP,
		constants.S_IXGRP,
		constants.S_IROTH,
		constants.S_IWOTH,
		constants.S_IXOTH,
	]
		.map((bit, index) => ((mode & bit) === 0 ? "-" : "rwx"[index % 3]))
		.join("");
}

const interruptedAt = Effect.fnUntraced(function* <A, E>(running: Fiber.Fiber<A, E>, gate: Gate) {
	yield* Deferred.await(gate.reached);
	const stopping = yield* Effect.forkChild(Fiber.interrupt(running), { startImmediately: true });
	yield* Deferred.succeed(gate.release, undefined);
	yield* Fiber.join(stopping);
});

export function watcherVerbs(engine: Engine, tell: (line: string) => void) {
	return {
		awaitingFirstSnapshot: () => savedState(engine).pipe(Effect.map((state) => (state?.openNumbers ?? []).map((number) => `PR ${number}`))),
		confirmations: () =>
			Effect.sync(() =>
				engine.github.requests
					.filter(({ body, path }) => path.endsWith(GRAPHQL) && body?.query?.includes("query QueueEntry") === true)
					.map(({ body, path }) => `${path} for ${body?.variables?.owner}/${body?.variables?.name} PR ${body?.variables?.number}`),
			),
		dequeueReasons: () => Effect.sync(() => transitionLines(engine.lines).flatMap(({ event, reason }) => (event === "dequeued" ? [reason] : []))),
		diagnostics: () => Effect.sync(() => [...engine.diagnostics]),
		failureKind: () => Effect.sync(() => (engine.observation.failure instanceof Error ? engine.observation.failure.name : "none")),
		fileOperationFails: (operation: FileOperation) =>
			Effect.sync(() => {
				tell(`the file system refuses every ${operation} with permission denied`);
				engine.io.control.failing = operation;
			}),
		interruptWhilePrinting: () =>
			Effect.gen(function* () {
				tell("the watcher polls and is interrupted while it prints its first line");
				const gate = yield* makeGate;
				let held = false;
				function emit(line: string) {
					return Effect.suspend(() => {
						engine.lines.push(line);
						if (held) {
							return Effect.void;
						}
						held = true;
						return passGate(gate);
					});
				}
				const state = yield* engine.watcher.load(engine.options);
				const running = yield* Effect.forkChild(engine.watcher.poll(engine.options, state, emit, diagnosticTo(engine)));
				yield* interruptedAt(running, gate);
			}),
		interruptWhileSavingDiscovery: () =>
			Effect.gen(function* () {
				tell("the watcher polls and is interrupted while it saves the PRs it discovered");
				const gate = yield* makeGate;
				engine.io.control.rename = gate;
				const state = yield* engine.watcher.load(engine.options);
				const running = yield* Effect.forkChild(engine.watcher.poll(engine.options, state, emitTo(engine), diagnosticTo(engine)));
				yield* interruptedAt(running, gate);
				delete engine.io.control.rename;
			}),
		lastPoll: () => Effect.sync(() => engine.lastPoll),
		lastPollAt: (number: number) =>
			Effect.sync(() => {
				const last = engine.github.requests.findLast(({ path }) => path.endsWith(`${REPOSITORY}/pulls/${number}`));
				return last === undefined ? "never" : clockTime(last.at);
			}),
		lastRoundRequests: () => Effect.sync(() => engine.github.requests.slice(engine.roundStart).map(request)),
		liftSelection: () =>
			Effect.sync(() => {
				tell("the watcher's --events selection is removed");
				delete engine.options.events;
			}),
		poll: () =>
			Effect.suspend(() => {
				tell("the watcher polls GitHub");
				return pollOnce(engine);
			}),
		pollTimes: (number: number) =>
			Effect.sync(() => engine.github.requests.filter(({ path }) => path.endsWith(`${REPOSITORY}/pulls/${number}`)).map(({ at }) => clockTime(at))),
		printed: () => Effect.sync(() => engine.lines.map(described)),
		printedTransitions: () => Effect.sync(() => transitionLines(engine.lines)),
		requestsTo: (path: string) => Effect.sync(() => engine.github.requests.filter((received) => received.path === path).map(request)),
		restart: () =>
			Effect.gen(function* () {
				tell("the watcher restarts from its state file and polls GitHub");
				engine.context = yield* Layer.build(Layer.fresh(engine.layer));
				engine.watcher = Context.get(engine.context, Watcher);
				return yield* pollOnce(engine);
			}),
		savedHead: (number: number) =>
			savedState(engine).pipe(
				Effect.map((state) => {
					const snapshot = state?.prs[String(number)];
					return snapshot === undefined ? "none" : `${snapshot.branch}: ${snapshot.title}`;
				}),
			),
		savedSnapshot: (number: number) => savedState(engine).pipe(Effect.map((state) => snapshotPhrase(state?.prs[String(number)]))),
		stateFileMode: () => engine.io.fs.stat(engine.options.stateFile).pipe(Effect.map((stat) => permissions(stat.mode))),
		stateFileText: () => engine.io.fs.readFileString(engine.options.stateFile),
		transportFails: () =>
			Effect.sync(() => {
				tell("every HTTP request fails before reaching GitHub");
				engine.io.control.transport = "fails";
			}),
		transportRecovers: () =>
			Effect.sync(() => {
				tell("HTTP requests reach GitHub again");
				engine.io.control.transport = "works";
			}),
		transportStalls: () =>
			Effect.sync(() => {
				tell("the next HTTP requests never get an answer");
				engine.io.control.transport = "stalls";
			}),
	};
}
