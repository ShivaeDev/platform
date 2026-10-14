import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserStorage } from "#test/browserStorage.ts";
import { control } from "#test/chrome.ts";
import { renderBoard } from "#test/react.tsx";
import { Header } from "./Header.tsx";
import { shellIds } from "./shellIds.ts";
import { useAppearance } from "./useAppearance.ts";
import { useSidebar } from "./useSidebar.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
beforeEach(() => {
	browserStorage();
});
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
			main={{ file: "", view: "" }}
			openSearch={() => undefined}
			sidebar={sidebar}
			status=""
			updates={null}
		/>
	);
}

it.each([0, 4, null])("names the Files and Inbox controls independently of responsive text and count %s", async (count) => {
	const view = await renderBoard({}, () => <Shell count={count} />);
	try {
		expect(control(`#${shellIds.sidebarToggle}`, HTMLButtonElement).getAttribute("aria-label")).toBe("Files");
		expect(control(`#${shellIds.inboxTopbar}`, HTMLAnchorElement).getAttribute("aria-label")).toBe("Inbox");
		expect(control(`#${shellIds.inboxTopbarCount}`, HTMLElement).getAttribute("aria-label")).toBe(`${count ?? "?"} waiting`);
	} finally {
		await view.unmount();
	}
});
