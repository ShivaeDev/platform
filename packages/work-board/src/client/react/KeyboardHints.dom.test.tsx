import { afterEach, expect, it, vi } from "vitest";
import { expectNoReactWarnings, render } from "@shivaedev/effect-react/client/testing.ts";
import { KeyboardHints } from "./KeyboardHints.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
afterEach(() => vi.unstubAllGlobals());

it.each([0, 1])("shows keyboard help only without touch points when the pointer is fine (%i touch points)", async (points) => {
	const match = window.matchMedia.bind(window);
	vi.stubGlobal("navigator", { maxTouchPoints: points });
	vi.stubGlobal("matchMedia", (query: string) => {
		const media = match(query);
		Object.defineProperty(media, "matches", { value: false });
		return media;
	});
	const view = await render(
		<KeyboardHints>
			<kbd>Ctrl K</kbd>
		</KeyboardHints>,
	);
	try {
		expect(view.container.querySelector("kbd")?.textContent).toBe(points === 0 ? "Ctrl K" : undefined);
	} finally {
		await view.unmount();
	}
});
