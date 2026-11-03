import process from "node:process";
import { Clock, Effect, Exit, Fiber, Queue, Schema, Scope } from "effect";
import { type Output, spawn } from "#adapters/spawn.ts";
import { jsonReadiness, withoutReadiness } from "#readiness.ts";
import { supervise } from "#supervisor.ts";
import { fixture } from "#test/fixture.ts";

const Ready = Schema.Struct({ dependency: Schema.NullOr(Schema.String), pid: Schema.Int });
function launch(
	name: string,
	onOutput: (output: Output) => Effect.Effect<void>,
	env: Record<string, string>,
	timeout: number,
	handshake: boolean | "wait",
) {
	return supervise(
		spawn({
			args: ["-e", fixture],
			command: process.execPath,
			env,
			onOutput,
			readiness: (stdout) =>
				Effect.gen(function* () {
					if (handshake === "wait") {
						return yield* Effect.never;
					}
					if (!handshake) {
						return yield* withoutReadiness(stdout);
					}
					return yield* jsonReadiness(Ready)(stdout);
				}),
			stopTimeout: 50,
		}),
		{ backoff: { initial: 100, maximum: 200 }, name, readinessTimeout: timeout },
	);
}
type Launch = ReturnType<typeof launch>;
export interface Child {
	readonly fiber: Fiber.Fiber<Effect.Success<Launch>, Effect.Error<Launch>>;
	readonly logs: Output[];
	readonly output: Queue.Queue<
		Output & {
			at: number;
		}
	>;
	readonly pids: number[];
	readonly scope: Scope.Closeable;
}
export const makeEngine = Effect.gen(function* () {
	return { children: new Map<string, Child>(), scope: yield* Scope.fork(yield* Effect.scope) };
});
export type Engine = Effect.Success<typeof makeEngine>;
export const begin = Effect.fnUntraced(function* (
	engine: Engine,
	name: string,
	options: {
		stubborn?: boolean;
		timeout?: number;
		after?: string;
		handshake?: boolean | "wait";
		noisy?: boolean;
	} = {},
) {
	const scope = yield* Scope.fork(engine.scope);
	const output = yield* Queue.unbounded<
		Output & {
			at: number;
		}
	>();
	const logs: Output[] = [];
	const pids: number[] = [];
	function record(line: Output) {
		return Effect.gen(function* () {
			logs.push(line);
			if (line.text.startsWith("started:")) {
				pids.push(Number(line.text.slice(8)));
			}
			yield* Queue.offer(output, { ...line, at: yield* Clock.currentTimeMillis });
		});
	}
	const opening = Effect.gen(function* () {
		const dependency = options.after === undefined ? undefined : (yield* Fiber.join(child(engine, options.after).fiber)).ready;
		return yield* launch(
			name,
			record,
			{
				"DEPENDENCY": dependency === undefined ? "" : String(dependency.pid),
				"LOG_LINES": options.noisy ? "100" : "1",
				"STUBBORN": options.stubborn ? "yes" : "no",
			},
			options.timeout ?? 5000,
			options.handshake ?? true,
		);
	});
	const fiber = yield* Effect.forkIn(opening.pipe(Scope.provide(scope)), scope);
	engine.children.set(name, { fiber, logs, output, pids, scope });
});
export function child(engine: Engine, name: string): Child {
	const value = engine.children.get(name);
	if (value === undefined) {
		throw new Error(`Start ${name} first`);
	}
	return value;
}
export function signal(pid: number, kind: NodeJS.Signals) {
	return Effect.sync(() => process.kill(pid, kind));
}
export function close(engine: Engine) {
	return Scope.close(engine.scope, Exit.void);
}
