import { Context, Effect, Fiber } from "effect";
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
			const admission = yield* admit.pipe(Effect.forkChild);
			// No production signal marks admission reaching the fetch lock, so the held fetch stays open long enough for it to try.
			yield* Effect.sleep("250 millis");
			return { result: () => Fiber.join(admission) };
		}),
		admissionHoldingFetch: Effect.fn("AdmissionFetch.admissionHoldingFetch")(function* (admit: Effect.Effect<readonly string[], unknown>) {
			tell("admission starts and holds its Git fetch after main is advertised");
			repository().enable();
			const admission = yield* admit.pipe(Effect.forkChild);
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
			const reading = yield* Context.get(engine.running.context, MainSource).latest.pipe(Effect.forkChild);
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
