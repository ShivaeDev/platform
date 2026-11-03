import { Context, Deferred, Effect, Fiber, Tracer } from "effect";
import { gitMainSource, MainSource } from "#host/mainSource.ts";
import { admissionRepository } from "#test/admissionRepository.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { refusal } from "#test/refusal.ts";

const repositories = new WeakMap<HostStoryEngine, Effect.Success<ReturnType<typeof admissionRepository>>>();

export function configureFetchingMain(engine: HostStoryEngine) {
	engine.beforeStart = (fixture) =>
		Effect.gen(function* () {
			const repository = yield* admissionRepository(fixture.host.boardDir);
			repositories.set(engine, repository);
			engine.parts = { ...engine.parts, main: gitMainSource(fixture.host) };
		});
}

export function admissionFetchVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	function repository() {
		const value = repositories.get(engine);
		if (value === undefined) {
			throw new Error("Configure a real admission remote first");
		}
		return value;
	}
	return {
		admissionDuringHeldFetch: Effect.fn("AdmissionFetch.admissionDuringHeldFetch")(function* (admit: Effect.Effect<readonly string[], unknown>) {
			tell("admission starts while another read of main holds its Git fetch");
			const attempted = yield* Deferred.make<void>();
			const fetchesStarted: string[] = [];
			const tracer = Tracer.make({
				span: (options) => {
					if (options.name === "GitMainSource.latest") {
						Deferred.doneUnsafe(attempted, Effect.void);
					}
					if (options.name === "GitMainSource.fetch") {
						fetchesStarted.push(options.name);
					}
					return new Tracer.NativeSpan(options);
				},
			});
			const admission = yield* admit.pipe(Effect.withTracer(tracer), Effect.forkScoped);
			return {
				attempted: Deferred.await(attempted).pipe(Effect.timeout("5 seconds")),
				fetchesStarted: () => [...fetchesStarted],
				result: () => Fiber.join(admission),
			};
		}),
		admissionHoldingFetch: Effect.fn("AdmissionFetch.admissionHoldingFetch")(function* (admit: Effect.Effect<readonly string[], unknown>) {
			tell("admission starts and holds its Git fetch after main is advertised");
			repository().enable();
			const admission = yield* admit.pipe(Effect.forkScoped);
			yield* Effect.addFinalizer(() => Effect.sync(() => repository().release()));
			yield* repository().entered;
			return { result: () => Fiber.join(admission) };
		}),
		awaitMainFetch: () => repository().entered,
		breakMainRemote: () => {
			tell("the main remote becomes unreachable");
			repository().breakRemote();
		},
		externalMainFetch: () => {
			tell("another Git process fetches main in the same checkout");
			return repository().externalFetch();
		},
		fetchLatestMain: () => {
			tell("read the latest main through the daemon's main source");
			return Context.get(engine.running.context, MainSource).latest;
		},
		heldMainRead: Effect.fn("AdmissionFetch.heldMainRead")(function* () {
			tell("another daemon read of main starts and holds its Git fetch");
			repository().enable();
			const reading = yield* Context.get(engine.running.context, MainSource).latest.pipe(Effect.forkScoped);
			yield* Effect.addFinalizer(() => Effect.sync(() => repository().release()));
			yield* repository().entered;
			return { revision: () => Fiber.join(reading).pipe(Effect.map(({ revision }) => revision)) };
		}),
		holdMainFetch: () => {
			tell("hold the next real Git fetch after main is advertised");
			repository().enable();
		},
		mainFetchesOverlapped: () => repository().overlapped(),
		pushedMainRevision: () => repository().revision,
		releaseMainFetch: () => {
			tell("release the held Git fetch");
			repository().release();
		},
		unreachableRemoteAdmission: (admit: Effect.Effect<unknown, unknown>) => {
			tell("the main remote becomes unreachable before admission");
			repository().breakRemote();
			return refusal(admit);
		},
	};
}
