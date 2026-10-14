import { Effect, Tracer } from "effect";
import { folder, startBoard } from "./board.ts";
import { responseWorkspace } from "./responseWorkspace.ts";

function spanTimings(spans: readonly Tracer.NativeSpan[]) {
	return spans.flatMap((span) => {
		if (span.status._tag !== "Ended" || !["POST", "GET", "work-board.document", "WorkBoard.document", "WorkBoard.body"].includes(span.name)) {
			return [];
		}
		const nanoseconds: bigint = span.status.endTime - span.startTime;
		return [{ milliseconds: Number(nanoseconds) / 1e6, name: span.name }];
	});
}

await Effect.runPromise(
	Effect.scoped(
		Effect.gen(function* () {
			const notes = yield* Effect.acquireRelease(
				Effect.sync(() => folder(responseWorkspace())),
				(value) => Effect.sync(value.remove),
			);
			const spans: Tracer.NativeSpan[] = [];
			const tracer = Tracer.make({
				span: (options) => {
					const span = new Tracer.NativeSpan(options);
					spans.push(span);
					return span;
				},
			});
			let reads = 0;
			const board = yield* startBoard(
				notes.root,
				undefined,
				(fs) => ({
					...fs,
					readFileString: (path, encoding) =>
						Effect.suspend(() => {
							reads += 1;
							return fs.readFileString(path, encoding);
						}),
				}),
				true,
				undefined,
				undefined,
				undefined,
				tracer,
			);
			function rpc(url: string) {
				return fetch(`${board.url}/_board/rpc`, {
					body: `${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: { url }, tag: "work-board.document" })}\n`,
					headers: { "content-type": "application/ndjson" },
					method: "POST",
				});
			}
			function measure(operation: string, request: () => Promise<Response>) {
				return Effect.promise(async () => {
					reads = 0;
					spans.length = 0;
					const start = performance.now();
					const response = await request();
					const headersMs = performance.now() - start;
					const text = await response.text();
					const milliseconds = performance.now() - start;
					if (!response.ok || (operation !== "html" && !text.includes('"_tag":"Success"'))) {
						throw new Error(`Document request failed: ${response.status} ${text.slice(0, 200)}`);
					}
					const result = { bytes: Buffer.byteLength(text), headersMs, milliseconds, operation, reads, spans: spanTimings(spans) };
					await Effect.runPromise(Effect.logInfo(JSON.stringify(result)));
				});
			}
			yield* measure("cold", () => rpc("/document-0.md"));
			for (const index of [1, 2, 3, 5, 10, 21]) {
				yield* measure(`rpc-${index}`, () => rpc(`/document-${index}.md`));
			}
			yield* measure("decision", () => rpc("/decisions/decision-1.md"));
			yield* measure("pending-decision", () => rpc("/decisions/decision-9.md"));
			yield* measure("html", () => fetch(`${board.url}/document-1.md`));
		}),
	),
);
