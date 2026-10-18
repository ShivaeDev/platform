import { Effect } from "effect";
import { afterEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { ThemeContext } from "#client/react/ThemeContext.ts";
import { useAppearance } from "#client/react/useAppearance.ts";
import { mermaidEngine as mermaid } from "#test/mermaidEngine.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen, screenTheme } from "#test/screenTraits.ts";
import { Mermaid } from "./Mermaid.ts";

expectNoReactWarnings();
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
screenStory.it(
	"redraws Mermaid through the shell theme context when appearance changes",
	[screenTheme("light"), componentScreen(<Appearance />)],
	function* ({ screen, click }) {
		const view = screen();

		yield* Effect.promise(() => eventually(() => expect(mermaid.render).toHaveBeenCalledTimes(1)));
		expect(mermaid.initialize.mock.lastCall?.[0]).toMatchObject({ themeVariables: { darkMode: false } });
		click(view.container.querySelector("button"));
		yield* Effect.promise(() => eventually(() => expect(mermaid.render).toHaveBeenCalledTimes(2)));
		expect(mermaid.initialize.mock.lastCall?.[0]).toMatchObject({ themeVariables: { darkMode: true } });
	},
);
