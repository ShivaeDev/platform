import { Effect, Option } from "effect";
import { expect } from "vitest";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { itemPolishFixture } from "#test/itemPolishFixture.ts";
import { type BoardTestApi, renderBoard } from "#test/react.tsx";
import { DocumentPage } from "./DocumentPage.tsx";

function Page({ api, file }: { readonly api: BoardTestApi; readonly file: string }) {
	const query = useQuery(api.document.query({ url: `/${file}.md` }));
	return Option.match(query.data, { onNone: () => null, onSome: (data) => <DocumentPage document={data} /> });
}

it.live.each([false, true])("summarizes criterion evidence once and retains recorded claims (evidence: %s)", function* (evidence) {
	const view = yield* Effect.promise(() => renderBoard(itemPolishFixture(evidence), (api) => <Page api={api} file="done" />));
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#criterion-layout")).not.toBeNull()));
		const summary = `${evidence ? 1 : 0} of 2 criteria have recorded evidence`;
		expect(view.container.textContent?.split(summary)).toHaveLength(2);
		expect(view.container.textContent).not.toContain("No recorded evidence");
		expect(view.container.textContent).not.toContain("Acceptance is not established");
		expect(view.container.querySelector("#criterion-links p")).toBeNull();
		if (evidence) {
			expect(view.container.querySelector("#criterion-layout a")?.getAttribute("href")).toBe("/_board/item/report.review/#recorded-evidence-0");
			expect(view.container.querySelector("#criterion-layout")?.textContent).toContain("1 recorded claim:");
		} else {
			expect(view.container.querySelector("#criterion-layout a")).toBeNull();
		}
		expect(view.container.querySelector(".item-introduction [data-status-token]")?.textContent).toBe("done");
		expect(view.container.querySelector('a[href="https://github.com/ShivaeDev/platform/pull/390"]')).not.toBeNull();
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});

it.live.each(["done", "planned", "goal"])("keeps owned fields quiet and unowned fields visible on %s", function* (file) {
	const view = yield* Effect.promise(() => renderBoard(itemPolishFixture(), (api) => <Page api={api} file={file} />));
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#criterion-layout")).not.toBeNull()));
		expect(view.container.textContent).toContain("0 of 2 criteria have recorded evidence");
		expect(view.container.textContent).not.toContain("Unknown field fleet");
		const diagnostics = view.container.querySelector(".metadata-problems");
		if (file === "planned") {
			expect(diagnostics?.textContent).toContain("Unknown field flavor");
			expect(diagnostics?.querySelectorAll("li")).toHaveLength(1);
		} else {
			expect(diagnostics).toBeNull();
		}
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
