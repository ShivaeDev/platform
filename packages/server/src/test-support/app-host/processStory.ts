import { Effect, Exit, Result, Scope } from "effect";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { hostProcess } from "#testing/hostProcess.ts";

const options = { execArgv: ["--conditions=source"], module: new URL("./process.ts", import.meta.url) };

interface ProcessHostState {
	host?: Effect.Success<ReturnType<typeof hostProcess>>;
	readonly scope: Scope.Closeable;
}

export const processHost = storyKit({
	clock: "live",
	*create(): Effect.fn.Return<ProcessHostState> {
		return { scope: yield* Scope.make() };
	},
	name: "host child process",
	stages: [],
	verbs: (state, story) => {
		function running() {
			if (state.host === undefined) {
				throw new Error("Launch the host before reading it");
			}
			return state.host;
		}
		return {
			closeScope: () => {
				story.tell("the story closes the scope that owns the child process");
				return Scope.close(state.scope, Exit.void);
			},
			headers: (path: string) => Effect.suspend(() => running().headers(path)),
			health: () => Effect.suspend(() => running().health()),
			healthConnection: () =>
				Effect.suspend(() => running().health()).pipe(Effect.match({ onFailure: () => "refused", onSuccess: () => "connected" })),
			launch: (mode = "http") => {
				story.tell(`the ${mode} host launches and reports readiness over IPC`);
				return Effect.gen(function* () {
					yield* Effect.addFinalizer(() => Scope.close(state.scope, Exit.void));
					state.host = yield* hostProcess({ ...options, args: [mode] }).pipe(Effect.provideService(Scope.Scope, state.scope));
				});
			},
			launchFailure: () => {
				story.tell("the child exits without reporting readiness");
				return hostProcess({ ...options, args: ["exit-before-ready"] }).pipe(
					Effect.result,
					Effect.map((result) => (Result.isFailure(result) ? result.failure.operation : "started")),
				);
			},
			signal: (signal: NodeJS.Signals) => {
				story.tell(`the parent delivers ${signal} and waits for the host's acknowledgement`);
				return Effect.suspend(() => running().signal(signal));
			},
			signalOutcome: (signal: NodeJS.Signals) =>
				Effect.suspend(() => running().signal(signal)).pipe(
					Effect.match({ onFailure: (failure) => `${failure.operation} failed`, onSuccess: () => "acknowledged" }),
				),
		};
	},
});

export const postgresConfigured = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL").configured;
