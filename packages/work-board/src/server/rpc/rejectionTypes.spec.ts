import { Cause, Effect, Exit, Tracer } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { Forbidden, InternalServerError, NotFound } from "@shivaedev/platform/errors/taxonomy.ts";
import { browserClient } from "#client/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
afterEach(() => {
	client?.registry.dispose();
	notes?.remove();
});

it.live("Board declares taxonomy rejections through real HTTP RPC without session middleware", function* () {
	notes = folder({ "note.md": "# Note" });
	board = yield* startBoard(notes.root);
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
	const missing = yield* Effect.promise(() => client.run(client.responses.responses.run({ question: "missing" })).catch((error: unknown) => error));
	expect(missing).toBeInstanceOf(NotFound);
	expect(missing).toMatchObject({ message: "The registered question is missing." });
	const disabled = yield* Effect.promise(() =>
		client
			.mutate(client.responses.registerQuestion.run({ item: "missing", request: "review", revision: "0".repeat(64) }))
			.catch((error: unknown) => error),
	);
	expect(disabled).toBeInstanceOf(Forbidden);
});

it.live("Board redacts a handler defect into a declared rejection while the server span retains the original cause", function* () {
	notes = folder({ "note.md": "# Note" });
	const original = new Error("Unexpected storage failure with token=private-value");
	const spans: Tracer.NativeSpan[] = [];
	const tracer = Tracer.make({
		span: (options) => {
			const span = new Tracer.NativeSpan(options);
			spans.push(span);
			return span;
		},
	});
	let crash = false;
	board = yield* startBoard(
		notes.root,
		undefined,
		(fs) => ({
			...fs,
			readFileString: (path, options) => (crash && path.endsWith("note.md") ? Effect.die(original) : fs.readFileString(path, options)),
		}),
		false,
		undefined,
		undefined,
		undefined,
		tracer,
	);
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
	yield* Effect.promise(() => client.run(client.api.document.run({ url: "/note.md" })));
	crash = true;
	const rejection = yield* Effect.promise(() => client.run(client.api.document.run({ url: "/note.md" })).catch((error: unknown) => error));
	expect(rejection).toBeInstanceOf(InternalServerError);
	expect(rejection).toMatchObject({ message: "Internal server error" });
	if (!(rejection instanceof InternalServerError)) {
		throw new Error("Expected a declared client rejection");
	}
	expect(rejection.cause).toBeUndefined();
	expect(JSON.stringify(rejection)).not.toContain("private-value");
	const failures = spans
		.filter((span) => span.kind === "server" && span.name === "work-board.document")
		.flatMap((span) => {
			if (span.status._tag !== "Ended" || !Exit.isFailure(span.status.exit)) {
				return [];
			}
			return span.status.exit.cause.reasons.filter(Cause.isFailReason).map((reason) => reason.error);
		});
	expect(failures).toHaveLength(1);
	for (const traced of failures) {
		expect(traced).toBeInstanceOf(InternalServerError);
		if (!(traced instanceof InternalServerError && Cause.isCause(traced.cause))) {
			throw new Error("Expected the server rejection to retain its Effect cause");
		}
		expect(Cause.squash(traced.cause)).toBe(original);
	}
});
