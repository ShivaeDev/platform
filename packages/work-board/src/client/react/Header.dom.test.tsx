import { RouterContextProvider } from "@tanstack/react-router";
import { afterEach, expect, vi } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { boardRouter } from "./boardRouter.ts";
import { Header } from "./Header.tsx";
import { emptyMainLocation } from "./mainLocation.ts";
import { shellIds } from "./shellIds.ts";
import { useAppearance } from "./useAppearance.ts";
import { useSidebar } from "./useSidebar.ts";

afterEach(() => {
	vi.unstubAllGlobals();
});

function Shell({ count }: { readonly count: number | null }) {
	const appearance = useAppearance();
	const sidebar = useSidebar(appearance);
	return (
		<Header
			appearance={appearance}
			count={count}
			live={null}
			main={emptyMainLocation}
			openSearch={() => undefined}
			sidebar={sidebar}
			status=""
			updates={null}
		/>
	);
}

for (const count of [0, 4, null]) {
	screenStory.it(
		`names the Files and Today controls independently of responsive text and count ${count}`,
		[
			boardScreen({}, () => (
				<RouterContextProvider router={boardRouter()}>
					<Shell count={count} />
				</RouterContextProvider>
			)),
		],
		({ control }) => {
			expect(control(`#${shellIds.sidebarToggle}`, HTMLButtonElement).getAttribute("aria-label")).toBe("Files");
			expect(control(`#${shellIds.inboxTopbar}`, HTMLAnchorElement).getAttribute("aria-label")).toBe("Today");
			expect(control(`#${shellIds.inboxTopbarCount}`, HTMLElement).getAttribute("aria-label")).toBe(`${count ?? "?"} waiting`);
		},
	);
}
