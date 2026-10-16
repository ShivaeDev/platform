import { chmodSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Cause, Effect, Exit } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, startBoard } from "#test/board.ts";
import { socketRpc, staleSocket } from "#test/socketRpc.ts";
import { abandonedSocketStartup, nestedSocketFolder, socketStartup } from "#test/socketStartup.ts";

let notes: Folder;
afterEach(() => notes?.remove());

it.live("serves a nested directory whose public socket fits but a longer staging address would exceed Unix limits", function* () {
	notes = nestedSocketFolder();
	const socket = join(notes.root, "board.sock");
	expect(Buffer.byteLength(notes.root)).toBe(83);
	expect(Buffer.byteLength(socket)).toBe(94);
	let pending = "";
	const board = yield* startBoard(notes.root, undefined, (fs) => ({
		...fs,
		chmod: (path, mode) => {
			pending = path;
			return fs.chmod(path, mode);
		},
	}));
	expect(Buffer.byteLength(pending)).toBeLessThanOrEqual(Buffer.byteLength(socket));
	expect(statSync(socket).mode & 0o777).toBe(0o600);
	expect(yield* Effect.promise(() => socketRpc(socket, "work-board.server"))).toEqual(
		expect.arrayContaining([expect.objectContaining({ exit: { _tag: "Success", value: { directory: notes.root, url: `${board.url}/` } } })]),
	);
	expect(yield* Effect.promise(() => socketRpc(socket, "work-board.inbox"))).toEqual(
		expect.arrayContaining([expect.objectContaining({ exit: { _tag: "Success", value: expect.any(Object) } })]),
	);
	yield* board.stop();
	expect(readdirSync(notes.root)).toEqual(["note.md"]);
});

it.live("keeps a newly bound socket private before chmod under umask 0002", function* () {
	notes = folder({ "note.md": "# Notes\n" });
	chmodSync(notes.root, 0o775);
	const child = yield* socketStartup(notes.root, "permissions");
	const pending = yield* child.next();
	expect(pending.phase).toBe("permissions");
	expect(pending.path).toBeDefined();
	const path = pending.path ?? "";
	expect(statSync(path).isSocket()).toBe(true);
	expect(statSync(path).mode & 0o777).toBe(0o775);
	expect(statSync(dirname(path)).mode & 0o777).toBe(0o700);
	const socket = join(notes.root, "board.sock");
	expect(existsSync(socket)).toBe(false);
	yield* child.send("continue");
	const ready = yield* child.next();
	expect(ready.phase).toBe("ready");
	expect(statSync(socket).mode & 0o777).toBe(0o600);
	expect(yield* Effect.promise(() => socketRpc(socket, "work-board.server"))).toEqual(
		expect.arrayContaining([expect.objectContaining({ exit: { _tag: "Success", value: { directory: notes.root, url: `${ready.url}/` } } })]),
	);
	yield* child.send("close");
	expect((yield* child.next()).phase).toBe("closed");
	expect(existsSync(socket)).toBe(false);
});

it.live("serializes stale reclamation across processes and loser cleanup preserves the winner", function* () {
	notes = folder({ "note.md": "# Notes\n" });
	const socket = join(notes.root, "board.sock");
	yield* Effect.promise(() => staleSocket(socket));
	const winner = yield* socketStartup(notes.root, "reclaim");
	expect((yield* winner.next()).phase).toBe("reclaim");
	const loser = yield* socketStartup(notes.root);
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
});

it.live("releases the startup lock after failed preparation so another startup can recover", function* () {
	notes = folder({ "note.md": "# Notes\n" });
	const socket = join(notes.root, "board.sock");
	const failed = yield* Effect.scoped(
		startBoard(notes.root, undefined, (fs) => ({ ...fs, chmod: (_path, mode) => fs.chmod(join(notes.root, "missing"), mode) })),
	).pipe(Effect.exit);
	expect(Exit.isFailure(failed)).toBe(true);
	expect(existsSync(socket)).toBe(false);
	expect(existsSync(join(notes.root, ".board.sock.starting"))).toBe(false);
	const board = yield* startBoard(notes.root);
	yield* board.stop();
});

it.live("explains recovery from an abandoned startup lock and leaves it for its owner", function* () {
	notes = folder({ "note.md": "# Notes\n" });
	const lock = abandonedSocketStartup(notes.root);
	const failed = yield* Effect.scoped(startBoard(notes.root)).pipe(Effect.exit);
	expect(Exit.isFailure(failed)).toBe(true);
	if (Exit.isFailure(failed)) {
		expect(Cause.pretty(failed.cause)).toContain(`A startup lock exists at ${lock}; remove it only if its startup was forcibly killed.`);
	}
	expect(existsSync(lock)).toBe(true);
	rmSync(lock, { recursive: true });
	const board = yield* startBoard(notes.root);
	yield* board.stop();
});
