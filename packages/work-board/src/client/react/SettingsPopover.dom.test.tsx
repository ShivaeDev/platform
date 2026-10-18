import { RouterContextProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { afterEach, expect, vi } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { boardRouter } from "./boardRouter.ts";
import { Header } from "./Header.tsx";
import { emptyMainLocation } from "./mainLocation.ts";
import { UpdatesToggle } from "./UpdatesToggle.tsx";
import { useAppearance } from "./useAppearance.ts";
import { useSidebar } from "./useSidebar.ts";

afterEach(() => {
	vi.unstubAllGlobals();
	document.documentElement.classList.remove("dark");
});
function Shell({ client }: { readonly client: { readonly updates: { readonly paused: Atom.Writable<boolean> } } }) {
	const appearance = useAppearance();
	const sidebar = useSidebar(appearance);
	return (
		<Header
			appearance={appearance}
			count={0}
			live={null}
			main={emptyMainLocation}
			openSearch={() => undefined}
			sidebar={sidebar}
			status=""
			updates={<UpdatesToggle client={client} />}
		/>
	);
}
screenStory.it(
	"changes saved theme and density and pauses native updates from the header settings",
	[],
	function* ({ renderBoard, click, choose, control, keyboard }) {
		const client = { updates: { paused: Atom.make(false) } };

		const view = yield* Effect.promise(() =>
			renderBoard({}, () => (
				<RouterContextProvider router={boardRouter()}>
					<Shell client={client} />
				</RouterContextProvider>
			)),
		);

		expect(control('[role="dialog"][aria-label="Settings"]', HTMLElement).hidden).toBe(true);
		click("#settings-open");
		expect(document.activeElement?.id).toBe("theme");
		expect(control('[role="dialog"][aria-label="Settings"]', HTMLElement).hidden).toBe(false);
		choose("#theme", "dark");
		choose("#density", "compact");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.dataset.density).toBe("compact");
		click("#updates-toggle");
		expect(control("#updates-toggle", HTMLButtonElement).getAttribute("aria-pressed")).toBe("true");
		expect(view.registry.get(client.updates.paused)).toBe(true);
		expect(control("#updates-toggle", HTMLButtonElement).textContent).toBe("Resume updates");
		choose("#theme", "light");
		expect(document.documentElement.classList.contains("dark")).toBe(false);
		keyboard("Escape", { bubbles: true }, document);
		expect(control('[role="dialog"][aria-label="Settings"]', HTMLElement).hidden).toBe(true);
		expect(document.activeElement?.id).toBe("settings-open");
	},
);
