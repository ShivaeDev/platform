import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Context, Deferred, Effect, Fiber, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { vi } from "vitest";
import { fleetHealth } from "@shivaedev/work-board/server/adapters/fleetHealth.ts";
import { withBoardReadPass } from "#board/readPass.ts";
import * as statusPublication from "#board/writeStatus.ts";
import { capacityRejected, HealthSnapshot } from "#engine/health.ts";
import { cycle, run } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { boardHttp } from "#test/boardHttp.ts";
import { prepareWork } from "#test/engine.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { fileCondition } from "#test/fileCondition.ts";
import { blockedHealth } from "#test/health.ts";
import { blockedStatus } from "#test/status.ts";

export function enginePublicationVerbs(state: EngineStory, tell: (line: string) => void) {
	let writes: (() => number) | undefined;
	let publications: (() => readonly (readonly string[])[]) | undefined;
	function context() {
		if (state.publicationContext === undefined) {
			throw new Error("Configure Board publication before using it");
		}
		return state.publicationContext;
	}
	function status() {
		return readFileSync(join(state.root, "fleet/status.md"), "utf8");
	}
	return {
		awaitPage: (board: StatusPage, step: string) =>
			Effect.gen(function* () {
				tell(`wait until Board renders ${step}`);
				yield* AtomRegistry.toStream(board.client.registry, board.page).pipe(
					Stream.filter((observed) => observed._tag === "Success" && observed.value.document.source.includes(`Stage: ${step}`)),
					Stream.take(1),
					Stream.runDrain,
				);
				return yield* Effect.tryPromise(() => board.client.read(board.page));
			}),
		batchLaunch: () => {
			tell("prepare and launch work inside one Board read pass");
			return withBoardReadPass(
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* fleet.list();
					yield* fleet.dispatch("one");
					return { status: status(), writes: writes?.() };
				}),
			).pipe(Effect.provideContext(context()));
		},
		blockHealth: () => {
			tell("occupy the health publication path");
			state.restoreHealth = blockedHealth(state.root);
		},
		blockStatus: () =>
			Effect.gen(function* () {
				tell("occupy the status publication path");
				state.restoreStatus = yield* blockedStatus(state.root);
			}),
		boardPage: () =>
			Effect.gen(function* () {
				tell("mount the generated status in a Board HTTP client");
				const { client } = yield* boardHttp(state.root, "fleet/status.md");
				const page = client.api.board.query({ url: "/fleet/status.md" });
				const unmount = client.registry.mount(page);
				yield* Effect.addFinalizer(() => Effect.sync(unmount));
				return { client, page };
			}),
		health: () => fleetHealth(state.root),
		idlePass: () => {
			tell("run an idle scheduler pass");
			return cycle.pipe(Effect.provideContext(context()));
		},
		observeWrites: () =>
			Effect.gen(function* () {
				tell("observe the real status publisher's writes");
				const calls = vi.spyOn(statusPublication, "writeStatus");
				writes = () => calls.mock.calls.length;
				publications = () => calls.mock.calls.map(([, , records]) => records.map(({ workId }) => workId));
				yield* Effect.addFinalizer(() => Effect.sync(() => calls.mockRestore()));
			}),
		publishedWorkIds: () => publications?.(),
		readPage: (board: StatusPage) => Effect.tryPromise(() => board.client.read(board.page)),
		reassign: (...args: Parameters<typeof Fleet.Service.reassign>) => running(state).fleet.reassign(...args),
		rejectCapacity: () => {
			tell("the provider rejects capacity");
			return capacityRejected("serverOverloaded").pipe(Effect.provideContext(context()));
		},
		restoreHealth: () => {
			if (state.restoreHealth === undefined) {
				throw new Error("Block health before restoring it");
			}
			tell("restore the health publication path");
			state.restoreHealth();
		},
		restoreStatus: () => {
			if (state.restoreStatus === undefined) {
				throw new Error("Block status before restoring it");
			}
			tell("restore the status publication path");
			state.restoreStatus();
		},
		runUntilValidationPublished: () =>
			Effect.gen(function* () {
				tell("run the scheduler until suspended validation reaches the status file");
				const entered = state.validationEntered;
				if (entered === undefined) {
					return yield* Effect.die("Configure suspended validation first");
				}
				const scheduler = yield* Effect.scoped(run(Effect.sleep("5 millis"))).pipe(Effect.provideContext(context()), Effect.forkChild);
				yield* Deferred.await(entered);
				yield* fileCondition(state.root, Effect.sync(status), (source) => source.includes("Stage: reviewing"));
				yield* Fiber.interrupt(scheduler);
				return status();
			}),
		snapshot: () => Context.get(context(), HealthSnapshot),
		source: () => state.source,
		status,
		task: () => readFileSync(join(state.root, "one.md"), "utf8"),
		writes: () => {
			if (writes === undefined) {
				throw new Error("Observe writes before reading them");
			}
			return writes();
		},
	};
}

type BoardHttp = Effect.Success<ReturnType<typeof boardHttp>>;
interface StatusPage {
	readonly client: BoardHttp["client"];
	readonly page: ReturnType<BoardHttp["client"]["api"]["board"]["query"]>;
}
