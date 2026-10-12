import { createMemoryHistory } from "@tanstack/react-router";
import { act } from "react";
import { expect, it, onTestFinished } from "vitest";
import { eventually, expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { notesClient } from "#test-support/notesClient.ts";
import { SessionApp } from "./SessionApp.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it("replaces cached notes and the draft when the authentication owner's session changes", async () => {
	const alice = notesClient();
	const bob = notesClient();
	function connection({ id }: { readonly id: string }) {
		return id === "alice" ? alice : bob;
	}
	const history = createMemoryHistory({ initialEntries: ["/"] });
	function recheck() {
		return undefined;
	}
	const view = await render(<SessionApp connect={connection} history={history} recheck={recheck} sessionId="alice" />);
	onTestFinished(view.unmount);
	await eventually(() => expect(alice.calls).toEqual(["list"]));
	async function enter(value: string) {
		const input = view.container.querySelector("input");
		if (!(input instanceof HTMLInputElement)) {
			throw new Error("Missing note input");
		}
		await act(() => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
	}
	await enter("Alice's saved note");
	await act(() => view.container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
	await eventually(() => expect(view.container.querySelector("li")?.textContent).toBe("Alice's saved note"));
	await enter("Alice's private draft");
	await view.render(<SessionApp connect={connection} history={history} recheck={recheck} sessionId="bob" />);
	await eventually(() => expect(bob.calls).toEqual(["list"]));
	expect(view.container.querySelector("li")).toBeNull();
	expect(view.container.querySelector("input")?.value).toBe("");
});
