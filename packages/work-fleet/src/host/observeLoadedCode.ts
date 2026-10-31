import { Clock, Effect, Schema, Stream } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { LoadedCode } from "#host/adapters/LoadedCode.ts";

const LoadedFile = Schema.fromJsonString(Schema.Struct({ digest: Schema.String, directory: Schema.String, file: Schema.String }));

export const observeLoadedCode = Effect.fn("FleetSupervisor.observeLoadedCode")(function* (child: ChildProcessSpawner.ChildProcessHandle) {
	const now = yield* Clock.currentTimeMillis;
	const loaded = yield* Effect.acquireRelease(
		Effect.sync(() => new LoadedCode(now)),
		(code) => Effect.sync(() => code.close()),
	);
	yield* Effect.forkScoped(
		child.getOutputFd(3).pipe(
			Stream.decodeText,
			Stream.splitLines,
			Stream.mapEffect((line) => Schema.decodeUnknownEffect(LoadedFile)(line)),
			Stream.runForEach((file) => Effect.sync(() => loaded.add(file))),
		),
	);
	return {
		check: Effect.gen(function* () {
			const time = yield* Clock.currentTimeMillis;
			return yield* Effect.try({ catch: (cause) => new Error(`Cannot inspect loaded code: ${cause}`), try: () => loaded.check(time) });
		}),
	};
});
