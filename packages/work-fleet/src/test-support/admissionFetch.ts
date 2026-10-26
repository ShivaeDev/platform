import { Context, Effect } from "effect";
import { gitMainSource, MainSource } from "#host/mainSource.ts";
import { admissionRepository } from "#test/admissionRepository.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

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
	};
}
