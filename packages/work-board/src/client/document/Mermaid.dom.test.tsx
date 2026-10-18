import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { MermaidAppearance } from "#test/MermaidAppearance.tsx";
import { mermaidEngine as mermaid } from "#test/mermaidEngine.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { screenTheme } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"redraws Mermaid through the shell theme context when appearance changes",
	[screenTheme("light"), componentScreen(<MermaidAppearance />)],
	function* ({ click, findElement }) {
		yield* Effect.promise(() => eventually(() => expect(mermaid.render).toHaveBeenCalledTimes(1)));
		expect(mermaid.initialize.mock.lastCall?.[0]).toMatchObject({ themeVariables: { darkMode: false } });
		click(findElement("button"));
		yield* Effect.promise(() => eventually(() => expect(mermaid.render).toHaveBeenCalledTimes(2)));
		expect(mermaid.initialize.mock.lastCall?.[0]).toMatchObject({ themeVariables: { darkMode: true } });
	},
);
