import { Effect } from "effect";
import { expect } from "vitest";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { boardFilesystem, boardHome, boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { FILES, settle, waitFor } from "#test/live.ts";
import { type RpcRequest, rpcCall, rpcFailure } from "#test/rpc.ts";

const routes = [
	{ kind: "board", url: "/board.md" },
	{ kind: "work", url: "/_board/work?view=table" },
];

for (const { failed, kind, url } of routes.flatMap((route) => [false, true].map((isFailed) => ({ ...route, failed: isFailed })))) {
	boardStory.it(
		`keeps same-URL ${kind} navigation on its projection query (failed: ${failed})`,
		[projectFiles(FILES), boardHome("board.md"), responsesEnabled(false), boardFilesystem(undefined)],
		function* ({ reader }) {
			const reads: RpcRequest[] = [];
			let fail = failed;
			const tag = `work-board.${kind}`;
			const page = yield* reader.open("/plan.md", (window) => {
				const fetch = window.fetch.bind(window);
				window.fetch = async (input, init) => {
					const call = await rpcCall(window, input, init);
					if (call) {
						reads.push(call);
						if (fail && call.tag === tag) {
							return rpcFailure(window, call, new InternalServerError({ message: "Projection unavailable." }));
						}
					}
					return fetch(input, init);
				};
			});
			const link = page.document.createElement("a");
			link.href = url;
			page.document.body.append(link);
			function click() {
				link.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
			}
			click();
			yield* Effect.promise(() =>
				waitFor(() => {
					expect(page.document.getElementById("doc")?.getAttribute("data-projection")).toBe(kind);
					expect(page.document.getElementById("doc")?.getAttribute("data-route")).toBe(url);
					expect(page.document.getElementById("doc")?.getAttribute("data-status")).toBe(failed ? "503" : "200");
				}),
			);
			const before = reads.filter((call) => call.tag === tag).length;
			fail = false;
			click();
			yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("doc")?.getAttribute("data-status")).toBe("200")));
			yield* Effect.promise(() => settle());
			expect(page.window.location.pathname + page.window.location.search).toBe(url);
			expect(page.document.querySelector("[data-legacy-main]")).toBeNull();
			expect(reads.map((call) => call.tag)).not.toContain("work-board.page");
			const projections = reads.filter((call) => call.tag === tag);
			expect(projections.length).toBe(failed ? before + 1 : before);
			for (const call of projections) {
				expect(call.payload).toEqual({ url });
			}
		},
	);
}
