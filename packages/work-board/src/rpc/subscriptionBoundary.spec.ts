import { Cause, Exit, Stream, Tracer } from "effect";
import { afterEach, expect, it, vi } from "vitest";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { waitFor } from "#test/live.ts";
import * as hints from "./hints.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
afterEach(async () => {
	client?.registry.dispose();
	await board?.stop();
	notes?.remove();
	vi.restoreAllMocks();
});

it("traces the bound subscription and redacts stream defects over real HTTP while retaining the server cause", async () => {
	const spans: Tracer.NativeSpan[] = [];
	const tracer = Tracer.make({
		span: (options) => {
			const span = new Tracer.NativeSpan(options);
			spans.push(span);
			return span;
		},
	});
	notes = folder({ "note.md": "# Note" });
	board = await startBoard(notes.root, undefined, undefined, false, undefined, undefined, undefined, tracer);
	client = browserClient(board.url);
	const initial = await client.run(Stream.runCollect(client.api.subscribe.run(undefined).pipe(Stream.take(1))));
	expect(initial).toEqual([{ _tag: "Resync" }]);
	const subscribed = spans.find((span) => span.name === "RpcServer.work-board.subscribe");
	expect(Object.fromEntries(subscribed?.attributes ?? [])).toMatchObject({
		"request.id": expect.stringMatching(/^[0-9a-f]{32}$/u),
		"rpc.method": "work-board.subscribe",
	});

	const original = new Error("Subscription failure with token=private-value");
	vi.spyOn(hints, "hints").mockReturnValue(Stream.die(original));
	const rejection = await client.run(Stream.runCollect(client.api.subscribe.run(undefined))).catch((error: unknown) => error);
	expect(rejection).toBeInstanceOf(InternalServerError);
	expect(rejection).toMatchObject({ message: "Internal server error" });
	if (!(rejection instanceof InternalServerError)) {
		throw new Error("Expected a declared subscription rejection");
	}
	expect(rejection.cause).toBeUndefined();
	expect(JSON.stringify(rejection)).not.toContain("private-value");

	await waitFor(() => {
		const failed = spans.find(
			(span) =>
				span.name === "RpcServer.work-board.subscribe"
				&& span.status._tag === "Ended"
				&& Exit.isFailure(span.status.exit)
				&& span.status.exit.cause.reasons.some((reason) => Cause.isFailReason(reason) && reason.error instanceof InternalServerError),
		);
		if (!(failed?.status._tag === "Ended" && Exit.isFailure(failed.status.exit))) {
			throw new Error("Expected a failed subscription span");
		}
		const traced = failed.status.exit.cause.reasons.filter(Cause.isFailReason).map((reason) => reason.error)[0];
		expect(traced).toBeInstanceOf(InternalServerError);
		if (!(traced instanceof InternalServerError && Cause.isCause(traced.cause))) {
			throw new Error("Expected the stream rejection to retain its Effect cause");
		}
		expect(Cause.squash(traced.cause)).toBe(original);
	});
});
