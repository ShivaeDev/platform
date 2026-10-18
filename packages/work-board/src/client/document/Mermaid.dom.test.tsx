import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { ThemeContext } from "#client/react/ThemeContext.ts";
import { useAppearance } from "#client/react/useAppearance.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { Mermaid } from "./Mermaid.ts";

const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn(async () => ({ svg: "<svg></svg>" })) }));
vi.mock("mermaid", () => ({ default: mermaid }));
Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => browserStorage());
afterEach(() => {
	vi.unstubAllGlobals();
	document.documentElement.classList.remove("dark");
});

function Appearance() {
	const appearance = useAppearance();
	return (
		<ThemeContext.Provider value={appearance.scheme}>
			<button onClick={() => appearance.change({ theme: "dark" })} type="button">
				Dark
			</button>
			<Mermaid source="graph TD; Theme-->Drawing" />
		</ThemeContext.Provider>
	);
}
it("redraws Mermaid through the shell theme context when appearance changes", async () => {
	const view = await render(<Appearance />);
	try {
		await eventually(() => expect(mermaid.render).toHaveBeenCalledTimes(1));
		expect(mermaid.initialize.mock.lastCall?.[0]).toMatchObject({ themeVariables: { darkMode: false } });
		act(() => view.container.querySelector("button")?.click());
		await eventually(() => expect(mermaid.render).toHaveBeenCalledTimes(2));
		expect(mermaid.initialize.mock.lastCall?.[0]).toMatchObject({ themeVariables: { darkMode: true } });
	} finally {
		await view.unmount();
	}
});
