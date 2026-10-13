import { Cause, Effect, Exit, Stream, Tracer } from "effect";
import { afterEach, expect, vi } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { browserClient } from "#client/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { waitFor } from "#test/live.ts";
import * as hints from "./hints.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
afterEach(() => {
	client?.registry.dispose();
	notes?.remove();
	vi.restoreAllMocks();
});

it.live("traces the bound subscription and redacts stream defects over real HTTP while retaining the server cause", function* () {
	const spans: Tracer.NativeSpan[] = [];
	const tracer = Tracer.make({
		span: (options) => {
			const span = new Tracer.NativeSpan(options);
			spans.push(span);
			return span;
		},
	});
	notes = folder({ "note.md": "# Note" });
	board = yield* startBoard(notes.root, undefined, undefined, false, undefined, undefined, undefined, tracer);
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
	const initial = yield* Effect.promise(() => client.run(Stream.runCollect(client.api.subscribe.run(undefined).pipe(Stream.take(1)))));
	expect(initial).toEqual([{ _tag: "Resync" }]);
	const subscribed = spans.find((span) => span.kind === "server" && span.name === "work-board.subscribe");
	expect(Object.fromEntries(subscribed?.attributes ?? [])).toMatchObject({
		"request.id": expect.stringMatching(/^[0-9a-f]{32}$/u),
		"rpc.method": "work-board.subscribe",
	});

	const original = new Error("Subscription failure with token=private-value");
	vi.spyOn(hints, "hints").mockReturnValue(Stream.die(original));
	const rejection = yield* Effect.promise(() => client.run(Stream.runCollect(client.api.subscribe.run(undefined))).catch((error: unknown) => error));
	expect(rejection).toBeInstanceOf(InternalServerError);
	expect(rejection).toMatchObject({ message: "Internal server error" });
	if (!(rejection instanceof InternalServerError)) {
		throw new Error("Expected a declared subscription rejection");
	}
	expect(rejection.cause).toBeUndefined();
	expect(JSON.stringify(rejection)).not.toContain("private-value");

	yield* Effect.promise(() =>
		waitFor(() => {
			const failed = spans.find(
				(span) =>
					span.kind === "server"
					&& span.name === "work-board.subscribe"
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
		}),
	);
});
