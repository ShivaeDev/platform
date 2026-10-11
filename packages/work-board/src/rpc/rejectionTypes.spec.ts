import { Cause, Effect, Exit, Tracer } from "effect";
import { afterEach, expect, it } from "vitest";
import { Forbidden, InternalServerError, NotFound } from "@shivaedev/platform/errors/taxonomy.ts";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
afterEach(async () => {
	client?.registry.dispose();
	await board?.stop();
	notes?.remove();
});

it("Board declares taxonomy rejections through real HTTP RPC without session middleware", async () => {
	notes = folder({ "note.md": "# Note" });
	board = await startBoard(notes.root);
	client = browserClient(board.url);
	const missing = await client.run(client.responses.responses.run({ question: "missing" })).catch((error: unknown) => error);
	expect(missing).toBeInstanceOf(NotFound);
	expect(missing).toMatchObject({ message: "The registered question is missing." });
	const disabled = await client
		.mutate(client.responses.registerQuestion.run({ item: "missing", request: "review", revision: "0".repeat(64) }))
		.catch((error: unknown) => error);
	expect(disabled).toBeInstanceOf(Forbidden);
});

it("Board redacts a handler defect into a declared rejection while the server span retains the original cause", async () => {
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
	board = await startBoard(
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
	client = browserClient(board.url);
	await client.run(client.api.page.run({ url: "/note.md" }));
	crash = true;
	const rejection = await client.run(client.api.page.run({ url: "/note.md" })).catch((error: unknown) => error);
	expect(rejection).toBeInstanceOf(InternalServerError);
	expect(rejection).toMatchObject({ message: "Internal server error" });
	if (!(rejection instanceof InternalServerError)) {
		throw new Error("Expected a declared client rejection");
	}
	expect(rejection.cause).toBeUndefined();
	expect(JSON.stringify(rejection)).not.toContain("private-value");
	const documentRejection = await client.run(client.api.document.run({ url: "/note.md" })).catch((error: unknown) => error);
	expect(documentRejection).toBeInstanceOf(InternalServerError);
	expect(documentRejection).toMatchObject({ message: "Internal server error" });
	if (!(documentRejection instanceof InternalServerError)) {
		throw new Error("Expected a declared document rejection");
	}
	expect(documentRejection.cause).toBeUndefined();
	expect(JSON.stringify(documentRejection)).not.toContain("private-value");
	const failures = spans
		.filter((span) => ["RpcServer.work-board.page", "RpcServer.work-board.document"].includes(span.name))
		.flatMap((span) => {
			if (span.status._tag !== "Ended" || !Exit.isFailure(span.status.exit)) {
				return [];
			}
			return span.status.exit.cause.reasons.filter(Cause.isFailReason).map((reason) => reason.error);
		});
	expect(failures).toHaveLength(2);
	for (const traced of failures) {
		expect(traced).toBeInstanceOf(InternalServerError);
		if (!(traced instanceof InternalServerError && Cause.isCause(traced.cause))) {
			throw new Error("Expected the server rejection to retain its Effect cause");
		}
		expect(Cause.squash(traced.cause)).toBe(original);
	}
});
