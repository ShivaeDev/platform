import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { Cause, Effect, Exit } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder, startBoard } from "#test/board.ts";
import { inboxAudienceFixture } from "#test/inboxAudienceFixture.ts";
import { socketRpc, staleSocket } from "#test/socketRpc.ts";

const folders: Folder[] = [];
afterEach(() => {
	for (const entry of folders.splice(0)) {
		entry.remove();
	}
});

function notes() {
	const result = folder(inboxAudienceFixture());
	folders.push(result);
	return result.root;
}

function success(value: unknown) {
	return expect.arrayContaining([expect.objectContaining({ _tag: "Exit", exit: { _tag: "Success", value } })]);
}

it.live("serves server info and the same read queries on an owner-only socket and TCP", function* () {
	const root = notes();
	const board = yield* startBoard(root, undefined, undefined, false, undefined, undefined, null);
	const socket = join(root, "board.sock");
	expect(statSync(socket).isSocket()).toBe(true);
	expect(statSync(socket).mode & 0o777).toBe(0o600);
	const info = { directory: root, url: `${board.url}/` };
	for (const address of [socket, board.url]) {
		expect(yield* Effect.promise(() => socketRpc(address, "work-board.server"))).toEqual(success(info));
	}
	for (const tag of ["work-board.inbox", "work-board.fleetItems", "work-board.goals"]) {
		const local = yield* Effect.promise(() => socketRpc(socket, tag));
		expect(local).toEqual(yield* Effect.promise(() => socketRpc(board.url, tag)));
		expect(local).toEqual(success(expect.any(Object)));
		if (tag === "work-board.inbox") {
			expect(JSON.stringify(local)).toContain("Where should the project documents live?");
		}
	}
	yield* board.stop();
	expect(existsSync(socket)).toBe(false);
});

it.live("replaces an unanswered stale Unix socket and removes it when the scope closes", function* () {
	const root = notes();
	const socket = join(root, "board.sock");
	yield* Effect.promise(() => staleSocket(socket));
	expect(statSync(socket).isSocket()).toBe(true);
	yield* Effect.scoped(
		Effect.gen(function* () {
			const board = yield* startBoard(root);
			expect(yield* Effect.promise(() => socketRpc(socket, "work-board.server"))).toEqual(success({ directory: root, url: `${board.url}/` }));
		}),
	);
	expect(existsSync(socket)).toBe(false);
});

it.live("refuses a second board on the same directory without disturbing the first", function* () {
	const root = notes();
	const board = yield* startBoard(root);
	const second = yield* Effect.scoped(startBoard(root)).pipe(Effect.exit);
	expect(Exit.isFailure(second)).toBe(true);
	if (Exit.isFailure(second)) {
		expect(Cause.pretty(second.cause)).toContain(`Another board is already running at ${join(root, "board.sock")}`);
	}
	expect(yield* Effect.promise(() => socketRpc(join(root, "board.sock"), "work-board.server"))).toEqual(
		success({ directory: root, url: `${board.url}/` }),
	);
});

it.live("keeps two directories' socket addresses and browser URLs independent", function* () {
	const first = notes();
	const second = notes();
	const a = yield* startBoard(first);
	const b = yield* startBoard(second);
	expect(a.port).not.toBe(b.port);
	for (const [directory, board] of [
		[first, a],
		[second, b],
	] as const) {
		expect(yield* Effect.promise(() => socketRpc(join(directory, "board.sock"), "work-board.server"))).toEqual(
			success({ directory, url: `${board.url}/` }),
		);
	}
	yield* a.stop();
	expect(existsSync(join(first, "board.sock"))).toBe(false);
	expect(existsSync(join(second, "board.sock"))).toBe(true);
});

it.live("allows only one of two boards that start together on a fresh directory", function* () {
	const root = notes();
	const results = yield* Effect.all([startBoard(root).pipe(Effect.exit), startBoard(root).pipe(Effect.exit)], { concurrency: "unbounded" });
	expect(results.filter(Exit.isSuccess)).toHaveLength(1);
	expect(results.filter(Exit.isFailure)).toHaveLength(1);
	for (const result of results) {
		if (Exit.isSuccess(result)) {
			expect(yield* Effect.promise(() => socketRpc(join(root, "board.sock"), "work-board.server"))).toEqual(
				success({ directory: root, url: `${result.value.url}/` }),
			);
		} else {
			expect(Cause.pretty(result.cause)).toContain("Another board is already running at");
		}
	}
});
