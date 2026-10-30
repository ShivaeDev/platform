import { Cause, Clock, Console, Context, Deferred, Duration, Effect, Exit, Fiber, Layer, Queue, Scope } from "effect";
import { TestClock } from "effect/testing";
import { acquireHeavyLock } from "#acquire.ts";
import { HeavyLockError } from "#error.ts";
import { HeldLock, type HeldLockShape } from "#HeldLock.ts";
import { HOLDER_ID_ENV } from "#holder.ts";
import { heavyLockLayer, withHeavyLock } from "#withHeavyLock.ts";
import { configured, type Lock, nameOf } from "./lock.ts";

type Observation =
	| { readonly kind: "runs" }
	| { readonly kind: "sleeps"; readonly until: number }
	| { readonly kind: "ends"; readonly exit: Exit.Exit<void, unknown> };

export interface Command {
	readonly done: Deferred.Deferred<void, string>;
	failure?: unknown;
	fiber?: Fiber.Fiber<void, unknown>;
	held?: Context.Context<HeldLock>;
	readonly observations: Queue.Queue<Observation>;
	readonly printed: string[];
	state: string;
	wakesAt?: number;
}

export interface Hold {
	readonly env: Readonly<Record<string, string>>;
	readonly scope: Scope.Closeable;
}

function failureOf(error: unknown) {
	return error instanceof HeavyLockError ? `failed with heavy-lock error "${error.message}"` : `failed with "${String(error)}"`;
}

function settle(command: Command) {
	return Effect.map(Queue.take(command.observations), (observation) => {
		if (observation.kind === "runs") {
			command.state = "running";
		} else if (observation.kind === "sleeps") {
			command.state = "waiting";
			command.wakesAt = observation.until;
		} else if (Exit.isSuccess(observation.exit)) {
			command.state = "finished";
		} else if (Cause.hasInterruptsOnly(observation.exit.cause)) {
			command.state = "interrupted";
		} else {
			command.failure = Cause.squash(observation.exit.cause);
			command.state = failureOf(command.failure);
		}
	});
}

function remember(engine: Lock, name: string, env: Readonly<Record<string, string>>) {
	const id = env[HOLDER_ID_ENV];
	if (id !== undefined && !engine.names.has(id)) {
		engine.names.set(id, name);
	}
}

export const startCommand = Effect.fn("LockStory.startCommand")(function* (engine: Lock, name: string, inside?: string) {
	const parent = inside === undefined ? undefined : engine.commands[inside]?.held;
	if (inside !== undefined && parent === undefined) {
		return yield* Effect.die(new Error(`${inside} holds no lock for ${name} to run inside.`));
	}
	const command: Command = {
		done: yield* Deferred.make<void, string>(),
		observations: yield* Queue.unbounded<Observation>(),
		printed: [],
		state: "starting",
	};
	engine.commands[name] = command;
	const clock = yield* Clock.Clock;
	const output = yield* Console.Console;
	const observedClock: Clock.Clock = {
		...clock,
		sleep: (duration) =>
			Queue.offer(command.observations, { kind: "sleeps", until: clock.currentTimeMillisUnsafe() + Duration.toMillis(duration) }).pipe(
				Effect.andThen(clock.sleep(duration)),
			),
	};
	const printing: Console.Console = {
		...output,
		error: (line) => {
			command.printed.push(String(line));
		},
	};
	const body = Effect.gen(function* () {
		command.held = yield* Effect.context<HeldLock>();
		remember(engine, name, Context.get(command.held, HeldLock).env);
		yield* Queue.offer(command.observations, { kind: "runs" });
		yield* Deferred.await(command.done);
	});
	const locked = configured(engine, withHeavyLock(body, engine.omitsCommand ? engine.options : { ...engine.options, command: `pnpm ${name}` }));
	command.fiber = yield* (parent === undefined ? locked : Effect.provide(locked, parent)).pipe(
		Effect.provideService(Clock.Clock, observedClock),
		Effect.provideService(Console.Console, printing),
		Effect.onExit((exit) => Queue.offer(command.observations, { exit, kind: "ends" })),
		Effect.forkScoped,
	);
	yield* settle(command);
	return command;
});

function commandOf(engine: Lock, name: string) {
	const command = engine.commands[name];
	return command === undefined ? Effect.die(new Error(`${name} was never started in this story.`)) : Effect.succeed(command);
}

export const acquireInScope = Effect.fn("LockStory.acquireInScope")(function* (engine: Lock, name: string) {
	const scope = yield* Scope.fork(yield* Effect.scope);
	const held = yield* configured(engine, acquireHeavyLock({ ...engine.options, command: `pnpm ${name}` })).pipe(
		Effect.provideService(Scope.Scope, scope),
	);
	remember(engine, name, held.env);
	engine.holds[name] = { env: held.env, scope };
});

export const buildLayer = Effect.fn("LockStory.buildLayer")(function* (engine: Lock, name: string) {
	const scope = yield* Scope.fork(yield* Effect.scope);
	const context = yield* configured(engine, Layer.buildWithScope(heavyLockLayer({ ...engine.options, command: `pnpm ${name}` }), scope));
	const held: HeldLockShape = Context.get(context, HeldLock);
	remember(engine, name, held.env);
	engine.holds[name] = { env: held.env, scope };
});

function holdOf(engine: Lock, name: string) {
	const hold = engine.holds[name];
	return hold === undefined ? Effect.die(new Error(`${name} never acquired the lock in a scope of its own.`)) : Effect.succeed(hold);
}

function envOf(engine: Lock, name: string) {
	const held = engine.commands[name]?.held;
	return held === undefined ? engine.holds[name]?.env : Context.get(held, HeldLock).env;
}

export function commandVerbs(engine: Lock, tell: (line: string) => void) {
	function ends(name: string, change: (command: Command) => Effect.Effect<unknown>) {
		return Effect.gen(function* () {
			const command = yield* commandOf(engine, name);
			yield* change(command);
			while (command.state === "running" || command.state === "waiting") {
				yield* settle(command);
			}
		});
	}
	function closes(name: string) {
		return Effect.flatMap(holdOf(engine, name), ({ scope }) => Scope.close(scope, Exit.void));
	}
	return {
		closesLayer: (name: string) => {
			tell(`the scope of ${name}'s Layer closes`);
			return closes(name);
		},
		closesScope: (name: string) => {
			tell(`the scope ${name} acquired the lock in closes`);
			return closes(name);
		},
		fails: (name: string, error: string) => {
			tell(`${name}'s work fails with "${error}"`);
			return ends(name, (command) => Deferred.fail(command.done, error));
		},
		failureCauseOf: (name: string) =>
			Effect.map(commandOf(engine, name), ({ failure }) =>
				failure instanceof HeavyLockError ? String(failure.cause).replaceAll(engine.directory, "<story directory>") : "no heavy-lock error",
			),
		finishes: (name: string) => {
			tell(`${name} finishes its work`);
			return ends(name, (command) => Deferred.succeed(command.done, undefined));
		},
		holderIdGivenTo: (name: string) =>
			Effect.sync(() => {
				const id = envOf(engine, name)?.[HOLDER_ID_ENV];
				return id === undefined ? "no holder id" : `${nameOf(engine, id)}'s holder id`;
			}),
		interrupts: (name: string) => {
			tell(`${name} is interrupted`);
			return ends(name, (command) => (command.fiber === undefined ? Effect.void : Fiber.interrupt(command.fiber)));
		},
		printedBy: (name: string) =>
			Effect.map(commandOf(engine, name), ({ printed }) =>
				printed.map((line) => line.replace(/ pid \d+ /u, " pid <pid> ").replace(/ since \d\d:\d\d:\d\d /u, " since <time> ")),
			),
		starts: (name: string, { inside }: { readonly inside?: string } = {}) => {
			tell(inside === undefined ? `${name} starts` : `${name} starts inside ${inside}'s hold`);
			return Effect.asVoid(startCommand(engine, name, inside));
		},
		stateOf: (name: string) => Effect.map(commandOf(engine, name), ({ state }) => state),
		timePasses: (milliseconds: number) =>
			Effect.gen(function* () {
				tell(`${Duration.format(Duration.millis(milliseconds))} pass`);
				const clock = yield* Clock.Clock;
				const target = clock.currentTimeMillisUnsafe() + milliseconds;
				for (;;) {
					const next = nextWakeup(engine, target);
					if (next === undefined) {
						break;
					}
					yield* TestClock.setTime(next.wakesAt);
					yield* settle(next.command);
				}
				yield* TestClock.setTime(target);
			}),
	};
}

function nextWakeup(engine: Lock, target: number) {
	let next: { readonly command: Command; readonly wakesAt: number } | undefined;
	for (const command of Object.values(engine.commands)) {
		const wakesAt = command.wakesAt;
		if (command.state === "waiting" && wakesAt !== undefined && wakesAt <= target && (next === undefined || wakesAt < next.wakesAt)) {
			next = { command, wakesAt };
		}
	}
	return next;
}
