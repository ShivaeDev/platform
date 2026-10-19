import { Effect } from "effect";
import { expect } from "vitest";
import { boardFilesystem, boardStory, projectFiles, readerAt, responsesEnabled } from "#test/boardStory.ts";
import { commandTransport } from "#test/commandTransport.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { enterField } from "#test/enterField.ts";
import { silentWatch } from "#test/faults.ts";
import { formEvent } from "#test/formEvent.ts";
import { waitFor } from "#test/live.ts";
import type { RpcRequest } from "#test/rpc.ts";

const cases = (["response", "handoff"] as const).flatMap((kind) => (["rejection", "transport"] as const).map((failure) => ({ failure, kind })));
for (const { failure, kind } of cases) {
	boardStory.it(
		`classifies ${kind} ${failure} and retries its retained identity through RPC`,
		[readerAt("/"), projectFiles({ "item.md": EDGE_ATTENTION_SOURCE }), responsesEnabled(true), boardFilesystem(silentWatch)],
		function* ({ notes, reader }) {
			const commands: RpcRequest[] = [];
			let offline = failure === "transport";
			const command = kind === "response" ? "work-board.recordResponse" : "work-board.prepareHandoff";
			const page = yield* reader.open(
				kind === "response" ? "/_board/respond?item=item.edge&request=direction" : "/_board/handoff?item=item.edge",
				commandTransport(command, (call) => {
					commands.push(call);
					if (offline) {
						throw new Error("Connection lost while saving");
					}
				}),
			);

			yield* formEvent(page, () => enterField(page, kind === "response" ? "author" : "recipient", "local-reviewer"));
			const field = enterField(page, kind === "response" ? "body" : "goal", "Keep this direction");
			yield* formEvent(page, () => reader.click(`${kind}-preview`));
			const identity = page.document.getElementById(`${kind}-preview-content`)?.textContent?.match(/\b(?:response|handoff)\.[\da-f-]{36}/u)?.[0];
			expect(identity).toBeDefined();
			if (failure === "rejection") {
				notes.write("item.md", `${EDGE_ATTENTION_SOURCE}Changed reviewed source.\n`);
			}
			yield* reader.submit(`${kind}-form`);
			function status() {
				return page.document.getElementById(`${kind}-status`)?.textContent;
			}
			yield* Effect.promise(() =>
				waitFor(() => expect(status()).toContain(failure === "rejection" ? "Rejected: PreconditionFailed:" : "Uncertain:")),
			);
			expect(status()).toContain("Draft retained");
			expect(field.value).toBe("Keep this direction");
			notes.write("item.md", EDGE_ATTENTION_SOURCE);
			offline = false;
			yield* formEvent(page, () => reader.click(`${kind}-preview`));
			yield* reader.submit(`${kind}-form`);
			yield* Effect.promise(() => waitFor(() => expect(status()).toContain(kind === "response" ? "Saved:" : "Saved handoffs/")));
			expect(commands.length).toBe(failure === "transport" || kind === "handoff" ? 2 : 1);
			for (const call of commands) {
				expect(call.payload).toMatchObject({ id: identity });
			}
		},
	);
}
