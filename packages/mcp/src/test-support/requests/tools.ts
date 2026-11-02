import { type FileHandle, open } from "node:fs/promises";
import { Deferred, Effect, Layer, Queue, Schema } from "effect";
import { McpServer, Tool, Toolkit } from "effect/ai";
import { Identity, SessionUser, SessionUserSchema } from "@shivaedev/identity/identity.ts";

const Caller = Schema.Struct({ identity: Schema.String, user: SessionUserSchema });
export const CallerAnswer = Schema.Struct({ after: Caller, before: Caller });
const Tools = Toolkit.make(
	Tool.make("caller", { dependencies: [Identity, SessionUser], success: CallerAnswer }),
	Tool.make("readResource", { parameters: Schema.Struct({ wait: Schema.Boolean }), success: Schema.String }),
	Tool.make("firstOnly", { success: Schema.String }),
);
const OtherTools = Toolkit.make(Tool.make("secondOnly", { success: Schema.String }));

const caller = Effect.gen(function* () {
	return { identity: (yield* Identity).id, user: yield* SessionUser };
});

export const requestTools = Effect.fnUntraced(function* (file: string) {
	const entered = yield* Queue.unbounded<string>();
	const resume = yield* Deferred.make<void>();
	const acquired = yield* Deferred.make<FileHandle>();
	const released = yield* Deferred.make<void>();
	const tools = McpServer.toolkit(Tools).pipe(
		Layer.provide(
			Tools.toLayer({
				caller: () =>
					Effect.gen(function* () {
						const before = yield* caller;
						yield* Queue.offer(entered, before.identity);
						yield* Deferred.await(resume);
						return { after: yield* caller, before };
					}),
				firstOnly: () => Effect.succeed("first server"),
				readResource: ({ wait }) =>
					Effect.gen(function* () {
						const handle = yield* Effect.acquireRelease(
							Effect.promise(() => open(file)),
							(resource) => Effect.promise(() => resource.close()).pipe(Effect.andThen(Deferred.succeed(released, undefined))),
						);
						if (wait) {
							yield* Deferred.succeed(acquired, handle);
							yield* Effect.never;
						}
						return yield* Effect.promise(() => handle.readFile("utf8"));
					}).pipe(Effect.scoped),
			}),
		),
	);
	const otherTools = McpServer.toolkit(OtherTools).pipe(Layer.provide(OtherTools.toLayer({ secondOnly: () => Effect.succeed("second server") })));
	return { acquired, entered, otherTools, released, resume, tools };
});
