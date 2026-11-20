const ACTS = "outside an Effect, so it throws on bad input or acts at once.";

const OPTION = "which returns an Option, and give the invalid input a typed outcome";

const YIELD_IT =
	"Yield the Effect that Effect ships beside it, usually the same name without Unsafe, or wrap the call in Effect.sync, Effect.try or Effect.suspend when it is a real side effect.";

export const unsafeRejected = [
	{
		code: 'import { DateTime } from "effect";\nexport const reset = (header: string) => DateTime.makeUnsafe(Number(header) * 1000);\n',
		message: `DateTime.makeUnsafe runs ${ACTS} Use DateTime.make, ${OPTION}.`,
		name: "a bare call of an imported DateTime.makeUnsafe",
	},
	{
		code: 'import * as Duration from "effect/Duration";\nexport const millis = (input: Duration.Input) => Duration.fromInputUnsafe(input);\n',
		message: `Duration.fromInputUnsafe runs ${ACTS} Use Duration.fromInput, ${OPTION}, a Duration constructor such as Duration.seconds for a fixed value, or pass the Duration.Input on to the API that accepts it, such as Duration.toMillis.`,
		name: "a bare call through a module namespace import",
	},
	{
		code: 'import { Effect, Queue } from "effect";\nexport const offered = Effect.gen(function* () {\n\tconst queue = yield* Queue.unbounded<number>();\n\tQueue.offerUnsafe(queue, 1);\n});\n',
		message: `Queue.offerUnsafe runs ${ACTS} Yield Queue.offer; for a callback source, build the stream with Stream.callback and register the callback inside Effect.sync.`,
		name: "a bare call inside Effect.gen",
	},
	{
		code: 'import { Effect } from "effect";\nimport { Reactivity } from "effect/unstable/reactivity";\nexport const watch = Effect.gen(function* () {\n\tconst reactivity = yield* Reactivity.Reactivity;\n\treactivity.registerUnsafe(["orders"], () => undefined);\n});\n',
		message: `reactivity.registerUnsafe runs ${ACTS} ${YIELD_IT}`,
		name: "a bare member call on a service value",
	},
	{
		code: 'import { makeUnsafe } from "effect/Latch";\nexport const latch = makeUnsafe(true);\n',
		message: `makeUnsafe runs ${ACTS} ${YIELD_IT}`,
		name: "a bare call of a named import from an effect module",
	},
	{
		code: 'import { DateTime, Option } from "effect";\nexport const created = (on: Date | null) => Option.map(Option.fromNullishOr(on), DateTime.makeUnsafe);\n',
		message: `DateTime.makeUnsafe is passed to run ${ACTS} Use DateTime.make, ${OPTION}.`,
		name: "an imported unsafe function passed as a callback",
	},
] as const;

export const unsafeAccepted = [
	{
		code: 'import { Effect, Queue } from "effect";\nexport const offer = (queue: Queue.Queue<number>) => Effect.sync(() => Queue.offerUnsafe(queue, 1));\n',
		name: "a call inside an Effect.sync thunk",
	},
	{
		code: 'import { Effect, Queue } from "effect";\nexport const forward = (queue: Queue.Queue<number>, registry: { subscribe(f: (value: number) => void): void }) =>\n\tEffect.sync(() => registry.subscribe((value) => Queue.offerUnsafe(queue, value)));\n',
		name: "a callback written inside an Effect.sync thunk",
	},
	{
		code: 'import { DateTime, Effect } from "effect";\nexport const parsed = (input: string) => Effect.try({ catch: () => "invalid", try: () => DateTime.makeUnsafe(input) });\n',
		name: "a call inside an Effect.try thunk",
	},
	{
		code: 'import * as Effect from "effect/Effect";\nimport type * as Exit from "effect/Exit";\nimport * as Scope from "effect/Scope";\nexport const close = (scope: Scope.Closeable, exit: Exit.Exit<unknown>) => Effect.suspend(() => Scope.closeUnsafe(scope, exit) ?? Effect.void);\n',
		name: "a call inside an Effect.suspend thunk",
	},
	{
		code: 'function parseUnsafe(value: string) {\n\treturn Number(value);\n}\nexport const parsed = parseUnsafe("1");\n',
		name: "a local function named …Unsafe",
	},
	{
		code: 'import * as Parse from "#parse.ts";\nimport { readUnsafe } from "some-library";\nexport const values = [Parse.dateUnsafe("1"), readUnsafe()];\n',
		name: "…Unsafe functions imported from the repository and from another library",
	},
	{
		code: 'import type { RpcSerialization } from "effect/unstable/rpc";\nexport const wrapped = (wire: RpcSerialization.RpcSerialization["Service"]) => ({\n\tmakeUnsafe: () => wire.makeUnsafe(),\n});\n',
		name: "a call inside the body of a member that implements an …Unsafe member",
	},
	{
		code: 'import { Context, Effect } from "effect";\nexport const annotations = (map: ReadonlyMap<string, unknown>) => Context.makeUnsafe(map);\nexport const now = Effect.map(Effect.clock, (clock) => clock.currentTimeMillisUnsafe());\n',
		name: "Context.makeUnsafe and currentTimeMillisUnsafe, which other rules own",
	},
] as const;

const BARE = 'import { DateTime } from "effect";\nexport const reset = DateTime.makeUnsafe(0);\n';

export const uncheckedPaths = [
	"src/adapters/clock.ts",
	"src/test-support/clock.ts",
	"src/clock.spec.ts",
	"src/clock.test.ts",
	"vitest.config.ts",
].map((path) => ({ content: BARE, path }));
