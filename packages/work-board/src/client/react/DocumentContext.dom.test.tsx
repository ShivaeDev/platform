import { act } from "react";
import { expect, it } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { control } from "#test/chrome.ts";
import { recordSourceFixture } from "#test/recordSourceFixture.ts";
import { renderRouter } from "#test/renderRouter.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it.each(recordSourceFixture)("keeps $file record explanations in the initially hidden Source tab", async ({ file, source, explanation }) => {
	const view = await renderRouter({ [file]: source }, `/${file}`);
	try {
		await eventually(() => expect(view.container.querySelector('[aria-label="Document source"]')).not.toBeNull());
		const records = control('[aria-label="Document source"]', HTMLElement);
		expect(records.textContent).toContain(explanation);
		expect(records.closest("[hidden]")).not.toBeNull();
		expect(control('.item-context [role="tab"][aria-selected="true"]', HTMLElement).textContent).toBe("Details");
		act(() => {
			const sourceTab = [...view.container.querySelectorAll<HTMLButtonElement>('.item-context [role="tab"]')].find(
				(tab) => tab.textContent === "Source",
			);
			sourceTab?.click();
		});
		expect(records.closest("[hidden]")).toBeNull();
	} finally {
		await view.unmount();
	}
});
