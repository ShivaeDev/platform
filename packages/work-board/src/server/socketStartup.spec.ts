import { chmodSync, constants, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Cause, Effect, Exit } from "effect";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { longSocketProject } from "#test/servingTraits.ts";
import { socketRpc } from "#test/socketRpc.ts";

boardStory.it(
	"serves a nested directory whose public socket fits but a longer staging address would exceed Unix limits",
	[longSocketProject, deferredServing],
	function* ({ notes, start }) {
		const socket = join(notes.root, "board.sock");
		let pending = "";
		const board = yield* start({
			wrap: (fs) => ({
				...fs,
				chmod: (path, mode) => {
					pending = path;
					return fs.chmod(path, mode);
				},
			}),
		});
		expect(Buffer.byteLength(pending)).toBeLessThanOrEqual(Buffer.byteLength(socket));
		expect(statSync(socket).mode & 0o777).toBe(constants.S_IRUSR | constants.S_IWUSR);
		expect(yield* Effect.promise(() => socketRpc(socket, "work-board.server"))).toEqual(
			expect.arrayContaining([expect.objectContaining({ exit: { _tag: "Success", value: { directory: notes.root, url: `${board.url}/` } } })]),
		);
		expect(yield* Effect.promise(() => socketRpc(socket, "work-board.inbox"))).toEqual(
			expect.arrayContaining([expect.objectContaining({ exit: { _tag: "Success", value: expect.any(Object) } })]),
		);
		yield* board.stop();
		expect(readdirSync(notes.root)).toEqual(["note.md"]);
	},
);

boardStory.it(
	"keeps a newly bound socket private before chmod under umask 0002",
	[projectFiles({ "note.md": "# Notes\n" }), deferredServing],
	function* ({ notes, startSocketWorker }) {
		chmodSync(notes.root, 0o775);
		const child = yield* startSocketWorker("permissions");
		const pending = yield* child.next();
		expect(pending.phase).toBe("permissions");
		expect(pending.path).toBeDefined();
		const path = pending.path ?? "";
		expect(statSync(path).isSocket()).toBe(true);
		expect(statSync(path).mode & 0o777).toBe(constants.S_IRWXU | constants.S_IRWXG | constants.S_IROTH | constants.S_IXOTH);
		expect(statSync(dirname(path)).mode & 0o777).toBe(constants.S_IRWXU);
		const socket = join(notes.root, "board.sock");
		expect(existsSync(socket)).toBe(false);
		yield* child.send("continue");
		const ready = yield* child.next();
		expect(ready.phase).toBe("ready");
		expect(statSync(socket).mode & 0o777).toBe(constants.S_IRUSR | constants.S_IWUSR);
		expect(yield* Effect.promise(() => socketRpc(socket, "work-board.server"))).toEqual(
			expect.arrayContaining([expect.objectContaining({ exit: { _tag: "Success", value: { directory: notes.root, url: `${ready.url}/` } } })]),
		);
		yield* child.send("close");
		expect((yield* child.next()).phase).toBe("closed");
		expect(existsSync(socket)).toBe(false);
	},
);

boardStory.it(
	"serializes stale reclamation across processes and loser cleanup preserves the winner",
	[projectFiles({ "note.md": "# Notes\n" }), deferredServing],
	function* ({ notes, startSocketWorker, leaveStaleSocket }) {
		const socket = join(notes.root, "board.sock");
		yield* leaveStaleSocket();
		const winner = yield* startSocketWorker("reclaim");
		expect((yield* winner.next()).phase).toBe("reclaim");
		const loser = yield* startSocketWorker();
		const rejected = yield* loser.next();
		expect(rejected.phase).toBe("rejected");
		expect(rejected.error).toContain(`Another board is already running at ${socket}`);
		yield* winner.send("continue");
		const ready = yield* winner.next();
		expect(ready.phase).toBe("ready");
		yield* loser.send("close");
		expect((yield* loser.next()).phase).toBe("closed");
		expect(yield* Effect.promise(() => socketRpc(socket, "work-board.server"))).toEqual(
			expect.arrayContaining([expect.objectContaining({ exit: { _tag: "Success", value: { directory: notes.root, url: `${ready.url}/` } } })]),
		);
		yield* winner.send("close");
		expect((yield* winner.next()).phase).toBe("closed");
		expect(existsSync(socket)).toBe(false);
		expect(existsSync(join(notes.root, ".board.sock.starting"))).toBe(false);
	},
);

boardStory.it(
	"releases the startup lock after failed preparation so another startup can recover",
	[projectFiles({ "note.md": "# Notes\n" }), deferredServing],
	function* ({ notes, start }) {
		const socket = join(notes.root, "board.sock");
		const failed = yield* Effect.scoped(
			start({ wrap: (fs) => ({ ...fs, chmod: (_path, mode) => fs.chmod(join(notes.root, "missing"), mode) }) }),
		).pipe(Effect.exit);
		expect(Exit.isFailure(failed)).toBe(true);
		expect(existsSync(socket)).toBe(false);
		expect(existsSync(join(notes.root, ".board.sock.starting"))).toBe(false);
		const board = yield* start({});
		yield* board.stop();
	},
);

boardStory.it(
	"explains recovery from an abandoned startup lock and leaves it for its owner",
	[projectFiles({ "note.md": "# Notes\n" }), deferredServing],
	function* ({ start, abandonStartup }) {
		const lock = abandonStartup();
		const failed = yield* Effect.scoped(start({})).pipe(Effect.exit);
		expect(Exit.isFailure(failed)).toBe(true);
		if (Exit.isFailure(failed)) {
			expect(Cause.pretty(failed.cause)).toContain(`A startup lock exists at ${lock}; remove it only if its startup was forcibly killed.`);
		}
		expect(existsSync(lock)).toBe(true);
		rmSync(lock, { recursive: true });
		const board = yield* start({});
		yield* board.stop();
	},
);
