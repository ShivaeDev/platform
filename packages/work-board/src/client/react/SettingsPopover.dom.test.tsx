import * as Atom from "effect/reactivity/Atom";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserStorage } from "#test/browserStorage.ts";
import { choose, click, control } from "#test/chrome.ts";
import { renderBoard } from "#test/react.tsx";
import { Header } from "./Header.tsx";
import { emptyMainLocation } from "./mainLocation.ts";
import { UpdatesToggle } from "./UpdatesToggle.tsx";
import { useAppearance } from "./useAppearance.ts";
import { useSidebar } from "./useSidebar.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
beforeEach(() => {
	browserStorage();
});
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
it("changes saved theme and density and pauses native updates from the header settings", async () => {
	const client = { updates: { paused: Atom.make(false) } };

	const view = await renderBoard({}, () => <Shell client={client} />);
	try {
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
		act(() => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })));
		expect(control('[role="dialog"][aria-label="Settings"]', HTMLElement).hidden).toBe(true);
		expect(document.activeElement?.id).toBe("settings-open");
	} finally {
		await view.unmount();
	}
});
