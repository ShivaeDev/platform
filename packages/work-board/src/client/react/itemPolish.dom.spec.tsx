import { Effect, Option } from "effect";
import { expect } from "vitest";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import { itemPolishFixture } from "#test/itemPolishFixture.ts";
import type { BoardTestApi } from "#test/react.tsx";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentPage } from "./DocumentPage.tsx";

function Page({ api, file }: { readonly api: BoardTestApi; readonly file: string }) {
	const query = useQuery(api.document.query({ url: `/${file}.md` }));
	return Option.match(query.data, { onNone: () => null, onSome: (data) => <DocumentPage document={data} /> });
}

for (const evidence of [false, true]) {
	screenStory.it(
		`summarizes criterion evidence once and retains recorded claims (evidence: ${evidence})`,
		[boardScreen(itemPolishFixture(evidence), (api) => <Page api={api} file="done" />)],
		function* ({ boardView }) {
			const view = boardView();

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
		},
	);
}

for (const file of ["done", "planned", "goal"]) {
	screenStory.it(
		`keeps owned fields quiet and unowned fields visible on ${file}`,
		[boardScreen(itemPolishFixture(), (api) => <Page api={api} file={file} />)],
		function* ({ boardView }) {
			const view = boardView();

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
		},
	);
}
