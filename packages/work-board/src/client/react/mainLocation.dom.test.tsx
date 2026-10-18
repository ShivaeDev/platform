import { Effect, Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { useState } from "react";
import { expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { LiveControls } from "./LiveControls.tsx";
import { MainLocationContext, useMainLocation } from "./MainLocationContext.ts";
import { emptyMainLocation } from "./mainLocation.ts";
import { pageQueries } from "./pageQueries.ts";
import { retryPage } from "./retryPage.ts";

expectNoReactWarnings();

type LiveClient = Parameters<typeof LiveControls>[0]["client"];

function Controls({ client }: { readonly client: LiveClient }) {
	const page = useMainLocation();
	return (
		<>
			<LiveControls client={client} navigationFailed={false} navigationPending={false} />
			<button data-retry onClick={() => retryPage(client.api, client.registry, page)} type="button">
				Retry
			</button>
		</>
	);
}

function Page({ client }: { readonly client: LiveClient }) {
	const [page, setPage] = useState({ ...emptyMainLocation, projection: "system", route: "/_board/system", status: 503 });
	return (
		<MainLocationContext.Provider value={page}>
			<Controls client={client} />
			<button data-document onClick={() => setPage({ ...emptyMainLocation, route: "/broken.md", status: 503 })} type="button">
				Document
			</button>
		</MainLocationContext.Provider>
	);
}

screenStory.it(
	"uses the supplied displayed location for live health and retry queries without a document element",
	[],
	function* ({ renderBoard, click, control }) {
		const paused = Atom.make(false);
		const status = Atom.make<Atom.Type<LiveClient["updates"]["status"]>>({
			connection: "live",
			failure: Option.none(),
			needsResync: false,
			pending: 0,
		});
		let failed = true;
		let systemQueries: readonly Atom.Atom<unknown>[] = [];
		let documentQueries: readonly Atom.Atom<unknown>[] = [];
		const view = yield* Effect.promise(() =>
			renderBoard(
				{ "broken.md": "# Recovered" },
				(api, registry) => {
					systemQueries = pageQueries(api, "system", "/_board/system");
					documentQueries = pageQueries(api, "document", "/broken.md");
					const client = { api, registry, updates: { paused, status } };
					return <Page client={client} />;
				},
				{ beforeRead: () => (failed ? Effect.die(new Error("Read unavailable")) : Effect.void), home: undefined },
			),
		);

		expect(document.getElementById("doc")).toBeNull();
		yield* Effect.promise(() => eventually(() => expect(control("#live", HTMLElement).title).toContain("reads settled")));
		const refresh = vi.spyOn(view.registry, "refresh").mockImplementation(() => undefined);
		click("[data-retry]");
		expect(refresh.mock.calls.map(([query]) => query)).toEqual(systemQueries);
		refresh.mockClear();
		click("[data-document]");
		yield* Effect.promise(() => eventually(() => expect(control("#live", HTMLElement).textContent).toBe("refresh failed")));
		failed = false;
		click("[data-retry]");
		expect(refresh.mock.calls.map(([query]) => query)).toEqual(documentQueries);
		refresh.mockRestore();
		click("[data-retry]");
		yield* Effect.promise(() => eventually(() => expect(control("#live", HTMLElement).textContent).toBe("reconnecting")));
		expect(control("#live", HTMLElement).title).toContain("reads settled");
	},
);
