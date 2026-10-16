import { createMemoryHistory } from "@tanstack/react-router";
import { act } from "react";
import { expect, onTestFinished } from "vitest";
import { eventually, expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { notesClient } from "#test-support/notesClient.ts";
import { screenAuth } from "#test-support/screenAuth.ts";
import { screens } from "#test-support/screens.ts";
import { SessionApp } from "./SessionApp.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

screens.it("replaces cached notes and the draft when the authentication owner's session changes", [], function* ({ interact, enter }) {
	yield* interact(async () => {
		const alice = notesClient();
		const bob = notesClient();
		function connection({ id }: { readonly id: string }) {
			return id === "alice" ? alice : bob;
		}
		const auth = screenAuth();
		const history = createMemoryHistory({ initialEntries: ["/"] });
		function recheck() {
			return undefined;
		}
		const view = await render(<SessionApp auth={auth} connect={connection} history={history} recheck={recheck} sessionId="alice" />);
		onTestFinished(view.unmount);
		await eventually(() => expect(alice.calls).toEqual(["list"]));

		await enter(view.container, "Alice's saved note");
		await act(() => view.container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
		await eventually(() => expect(view.container.querySelector("li > a")?.textContent).toBe("Alice's saved note"));
		await enter(view.container, "Alice's private draft");
		await view.render(<SessionApp auth={auth} connect={connection} history={history} recheck={recheck} sessionId="bob" />);
		await eventually(() => expect(bob.calls).toEqual(["list"]));
		expect(view.container.querySelector("li")).toBeNull();
		expect(view.container.querySelector("input")?.value).toBe("");
	});
});
