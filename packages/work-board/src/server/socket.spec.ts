import { constants, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { Cause, Effect, Exit } from "effect";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { inboxAudienceFixture } from "#test/inboxAudienceFixture.ts";
import { socketRpc } from "#test/socketRpc.ts";

boardStory.it(
	"serves server info and the same read queries on an owner-only socket and TCP",
	[projectFiles(inboxAudienceFixture()), deferredServing],
	function* ({ notes, start }) {
		const root = notes.root;
		const board = yield* start({ fleetPort: null });
		const socket = join(root, "board.sock");
		expect(statSync(socket).isSocket()).toBe(true);
		expect(statSync(socket).mode & 0o777).toBe(constants.S_IRUSR | constants.S_IWUSR);
		const info = { directory: root, url: `${board.url}/` };
		for (const address of [socket, board.url]) {
			expect(yield* Effect.promise(() => socketRpc(address, "work-board.server"))).toEqual(
				expect.arrayContaining([expect.objectContaining({ _tag: "Exit", exit: { _tag: "Success", value: info } })]),
			);
		}
		for (const tag of ["work-board.inbox", "work-board.fleetItems", "work-board.goals"]) {
			const local = yield* Effect.promise(() => socketRpc(socket, tag));
			expect(local).toEqual(yield* Effect.promise(() => socketRpc(board.url, tag)));
			expect(local).toEqual(
				expect.arrayContaining([expect.objectContaining({ _tag: "Exit", exit: { _tag: "Success", value: expect.any(Object) } })]),
			);
			if (tag === "work-board.inbox") {
				expect(JSON.stringify(local)).toContain("Where should the project documents live?");
			}
		}
		yield* board.stop();
		expect(existsSync(socket)).toBe(false);
	},
);

boardStory.it(
	"replaces an unanswered stale Unix socket and removes it when the scope closes",
	[projectFiles(inboxAudienceFixture()), deferredServing],
	function* ({ notes, start, leaveStaleSocket }) {
		const root = notes.root;
		const socket = join(root, "board.sock");
		yield* leaveStaleSocket();
		expect(statSync(socket).isSocket()).toBe(true);
		yield* Effect.scoped(
			Effect.gen(function* () {
				const board = yield* start();
				expect(yield* Effect.promise(() => socketRpc(socket, "work-board.server"))).toEqual(
					expect.arrayContaining([
						expect.objectContaining({ _tag: "Exit", exit: { _tag: "Success", value: { directory: root, url: `${board.url}/` } } }),
					]),
				);
			}),
		);
		expect(existsSync(socket)).toBe(false);
	},
);

boardStory.it(
	"refuses a second board on the same directory without disturbing the first",
	[projectFiles(inboxAudienceFixture()), deferredServing],
	function* ({ notes, start }) {
		const root = notes.root;
		const board = yield* start();
		const second = yield* Effect.scoped(start()).pipe(Effect.exit);
		expect(Exit.isFailure(second)).toBe(true);
		if (Exit.isFailure(second)) {
			expect(Cause.pretty(second.cause)).toContain(`Another board is already running at ${join(root, "board.sock")}`);
		}
		expect(yield* Effect.promise(() => socketRpc(join(root, "board.sock"), "work-board.server"))).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ _tag: "Exit", exit: { _tag: "Success", value: { directory: root, url: `${board.url}/` } } }),
			]),
		);
	},
);

boardStory.it(
	"keeps two directories' socket addresses and browser URLs independent",
	[projectFiles(inboxAudienceFixture()), deferredServing],
	function* ({ notes, start, anotherFolder, startAnother }) {
		const first = notes.root;
		const second = (yield* anotherFolder(inboxAudienceFixture())).root;
		const a = yield* start();
		const b = yield* startAnother(second);
		expect(a.port).not.toBe(b.port);
		for (const [directory, board] of [
			[first, a],
			[second, b],
		] as const) {
			expect(yield* Effect.promise(() => socketRpc(join(directory, "board.sock"), "work-board.server"))).toEqual(
				expect.arrayContaining([expect.objectContaining({ _tag: "Exit", exit: { _tag: "Success", value: { directory, url: `${board.url}/` } } })]),
			);
		}
		yield* a.stop();
		expect(existsSync(join(first, "board.sock"))).toBe(false);
		expect(existsSync(join(second, "board.sock"))).toBe(true);
	},
);

boardStory.it(
	"allows only one of two boards that start together on a fresh directory",
	[projectFiles(inboxAudienceFixture()), deferredServing],
	function* ({ notes, start }) {
		const root = notes.root;
		const results = yield* Effect.all([start().pipe(Effect.exit), start().pipe(Effect.exit)], { concurrency: "unbounded" });
		expect(results.map((result) => result._tag).sort()).toEqual(["Failure", "Success"]);
		for (const result of results) {
			if (Exit.isSuccess(result)) {
				expect(yield* Effect.promise(() => socketRpc(join(root, "board.sock"), "work-board.server"))).toEqual(
					expect.arrayContaining([
						expect.objectContaining({ _tag: "Exit", exit: { _tag: "Success", value: { directory: root, url: `${result.value.url}/` } } }),
					]),
				);
			} else {
				expect(Cause.pretty(result.cause)).toContain("Another board is already running at");
			}
		}
	},
);
