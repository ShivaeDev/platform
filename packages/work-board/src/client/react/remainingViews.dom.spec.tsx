import { Effect } from "effect";
import { act } from "react";
import { afterEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { routeQueryOptions } from "#client/page/routeQuery.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();
afterEach(() => {
	window.dispatchEvent(new Event("pagehide"));
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
const files = {
	"home.md": "# Home",
	"result.md":
		"---\nid: result.fixture\nkind: result\nstatus: finished\nrelationships:\n - kind: implements\n   target: task.fixture\nevidence:\n - criterion: task.fixture#proof\n   source: task.md\n   outcome: observed\n---\n# A result\n\nReport limitations.\n",
	"task.md":
		"---\nid: task.fixture\nkind: task\nstatus: planned\nnext_action: Check the proof\ncriteria:\n - id: proof\n   text: Show the result\nattention:\n - id: direction\n   kind: decision\n   reason: Choose a direction\n   state: open\n   response_from: [maintainer]\n   unblocks: [task.fixture]\n---\n# A task\n\nTask context.\n",
};
const routes = [
	{ kind: "system", selector: "[data-source=codex]", text: "Source missing", url: "/_board/system" },
	{ kind: "start", selector: ".start-template textarea", text: "example.project", url: "/_board/start" },
	{ kind: "handoff", selector: "#handoff-form", text: "Recipient", url: "/_board/handoff?item=task.fixture" },
	{ kind: "result", selector: "#result-criteria", text: "Show the result", url: "/_board/result?item=result.fixture" },
];
for (const { kind, url, selector, text } of routes) {
	screenStory.it(`renders ${kind} from typed queries without an HTML page request`, [], function* ({ renderRouter }) {
		let page: unknown;
		const view = yield* Effect.promise(() =>
			renderRouter(files, url, undefined, (api) => {
				page = vi.spyOn(api.page, "query");
			}),
		);
		try {
			yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(selector)?.textContent).toContain(text)));
			expect(view.container.querySelector("main")?.dataset.projection).toBe(kind);
			expect(view.container.querySelector("[data-legacy-main]")).toBeNull();
			expect(view.container.textContent).not.toContain("Legacy HTML must not be shown");
			expect(page).not.toHaveBeenCalled();
			if (kind === "result") {
				expect(view.container.querySelector("#result-report")?.textContent).toContain("Report limitations");
				expect(view.container.querySelector("#result-criteria h2")?.getAttribute("title")).toContain("authored records");
			}
		} finally {
			yield* Effect.promise(() => view.unmount());
			vi.restoreAllMocks();
		}
	});
}
screenStory.it("updates answer card context while retaining answer text, node and caret", [], function* ({ renderRouter }) {
	const url = "/_board/item/task.fixture/";
	let refresh: (() => void) | undefined;
	const sources = { ...files };
	const view = yield* Effect.promise(() =>
		renderRouter(sources, url, undefined, (api, registry) => {
			refresh = () => registry.refresh(api.document.query({ url }, routeQueryOptions));
		}),
	);

	yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#response-form textarea")).not.toBeNull()));
	const body = view.container.querySelector<HTMLTextAreaElement>("#response-form textarea");
	if (!body) {
		throw new Error("Missing answer textarea");
	}
	act(() => {
		body.value = "Keep my response";
		body.dispatchEvent(new Event("input", { bubbles: true }));
	});
	body.focus();
	body.setSelectionRange(5, 7);
	sources["task.md"] += "\nChanged reviewed context.\n";
	yield* Effect.promise(() => act(async () => refresh?.()));
	yield* Effect.promise(() =>
		eventually(() => expect(view.container.querySelector("article.doc")?.textContent).toContain("Changed reviewed context")),
	);
	expect(view.container.querySelector("#response-form textarea")).toBe(body);
	expect(body.value).toBe("Keep my response");
	expect(document.activeElement).toBe(body);
	expect([body.selectionStart, body.selectionEnd]).toEqual([5, 7]);
});
screenStory.it("shows Today and getting-started guidance for an empty workspace", [], function* ({ renderRouter }) {
	let page: unknown;
	const view = yield* Effect.promise(() =>
		renderRouter({}, "/", undefined, (api) => {
			page = vi.spyOn(api.page, "query");
		}),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("h1")?.textContent).toBe("Today")));
		expect(page).not.toHaveBeenCalled();
	} finally {
		yield* Effect.promise(() => view.unmount());
		vi.restoreAllMocks();
	}
});
