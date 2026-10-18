import { Effect, Option } from "effect";
import { act } from "react";
import { expect } from "vitest";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { type BoardTestApi, renderBoard } from "#test/react.tsx";
import { DocumentPage } from "./DocumentPage.tsx";

function Page({ api }: { readonly api: BoardTestApi }) {
	const query = useQuery(api.document.query({ url: "/task.md" }));
	return Option.match(query.data, { onNone: () => null, onSome: (data) => <DocumentPage document={data} /> });
}
it.live("shows criteria on load, resolved target status and backlinks counted by kind, with source in its own tab", function* () {
	const view = yield* Effect.promise(() =>
		renderBoard(
			{
				"board.md": "---\nid: board.fixture\nkind: board\nitems: [task.fixture]\n---\n# Board",
				"goal.md": "---\nid: goal.fixture\nkind: goal\nstatus: blocked\ncriteria:\n  - id: design\n    text: Design\n---\n# Ship the feature",
				"notes.md": "# Notes\n\n[Task](task.md)",
				"one.md": "---\nid: report.one\nstatus: done\nrelationships:\n  - kind: informs\n    target: task.fixture\n---\n# One",
				"task.md":
					"---\nid: task.fixture\nkind: task\nrelationships:\n  - kind: implements\n    target: goal.fixture#design\ncriteria:\n  - id: proof\n    text: Visible without a click\n---\n# Readable task\n\nBody.",
				"two.md": "---\nid: report.two\nstatus: planned\nrelationships:\n  - kind: informs\n    target: task.fixture\n---\n# Two",
			},
			(api) => <Page api={api} />,
		),
	);
	try {
		yield* Effect.promise(() =>
			eventually(() => expect(view.container.querySelector("#criterion-proof")?.textContent).toContain("Visible without a click")),
		);
		const criterion = view.container.querySelector("#criterion-proof");
		expect(criterion?.closest("details")).toBeNull();
		expect(criterion?.closest("[hidden]")).toBeNull();
		expect(view.container.querySelector(".item-introduction h1")?.textContent).toBe("Readable task");
		expect(view.container.querySelector(".item-introduction")?.classList.contains("sticky")).toBe(true);
		const relationships = view.container.querySelector('[aria-label="Relationships"]');
		expect(relationships?.textContent).toContain("Ship the feature");
		expect(relationships?.querySelector("[data-status-token]")?.textContent).toBe("blocked");
		expect(relationships?.querySelector("a")?.getAttribute("href")).toBe("/_board/item/goal.fixture/#criterion-design");
		expect(
			[...view.container.querySelectorAll(".work-context h4")].map((node) => node.textContent).sort((a, b) => (a ?? "").localeCompare(b ?? "")),
		).toEqual(["Board membership (1)", "Informs (2)", "Markdown link (1)"]);
		const backlinks = view.container.querySelector('[aria-label="Informs backlinks"]');
		expect([...(backlinks?.querySelectorAll("a") ?? [])].map((node) => node.textContent)).toEqual(["One", "Two"]);
		expect([...(backlinks?.querySelectorAll("[data-status-token]") ?? [])].map((node) => node.textContent)).toEqual(["done", "planned"]);
		expect(backlinks?.querySelector("a")?.getAttribute("title")).toBe("one.md:6");
		expect(view.container.querySelector('[aria-label="Markdown link backlinks"] a')?.textContent).toBe("Notes");
		expect(view.container.textContent).not.toContain("Context and tools");
		expect(view.container.textContent).not.toContain("Status (source)");
		expect(view.container.textContent).not.toContain("Recorded work ·");
		const source = view.container.querySelector('[aria-label="Document source"]');
		expect(source?.closest("[hidden]")).not.toBeNull();
		yield* Effect.promise(() => act(async () => view.container.querySelector<HTMLButtonElement>('[role="tab"]:nth-child(2)')?.click()));
		expect(source?.closest("[hidden]")).toBeNull();
		expect(source?.querySelector("code")?.textContent).toContain("task.md:");
		expect(source?.querySelector("pre")?.textContent).toContain("id: task.fixture");
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
