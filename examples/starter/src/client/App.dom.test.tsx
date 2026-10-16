import { createMemoryHistory } from "@tanstack/react-router";
import { act } from "react";
import { expect, onTestFinished } from "vitest";
import { eventually, expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { appAuth } from "#test-support/appAuth.ts";
import { notesClient } from "#test-support/notesClient.ts";
import { screens } from "#test-support/screens.ts";
import { App } from "./App.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

screens.it("checks and retries the session through its injected auth client", [], function* ({ interact }) {
	yield* interact(async () => {
		const fixture = appAuth({ baseUrl: "http://session.story.test", sessionFailure: true });
		const client = notesClient();
		const history = createMemoryHistory({ initialEntries: ["/sign-in"] });
		const view = await render(<App auth={fixture.auth} connect={() => client} history={history} />);
		onTestFinished(view.unmount);
		await eventually(() => expect(view.container.querySelector("[role=alert]")?.textContent).toBe("Could not check your session."));
		fixture.recover();
		await act(async () => {
			view.container.querySelector<HTMLButtonElement>("button")?.click();
			await new Promise<void>((resolve) => setTimeout(resolve, 10));
		});
		await eventually(() => expect(view.container.querySelector("h1")?.textContent).toBe("Sign in"));
		expect(fixture.requests.map((url) => url.href)).toEqual([
			"http://session.story.test/api/auth/get-session",
			"http://session.story.test/api/auth/get-session",
		]);
	});
});

screens.it("routes sign-out through the same injected auth client as its session check", [], function* ({ interact }) {
	yield* interact(async () => {
		const fixture = appAuth({ baseUrl: "http://actions.story.test", signedIn: true, signOutFailure: "Provider refused sign-out" });
		const client = notesClient();
		const history = createMemoryHistory({ initialEntries: ["/"] });
		const view = await render(<App auth={fixture.auth} connect={() => client} history={history} />);
		onTestFinished(view.unmount);
		await eventually(() => expect(view.container.textContent).toContain("No notes yet"));
		await act(() => [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Sign out")?.click());
		await eventually(() => expect(view.container.querySelector("[role=alert]")?.textContent).toBe("Provider refused sign-out"));
		expect(fixture.requests.some((url) => url.pathname === "/api/auth/sign-out")).toBe(true);
		expect(fixture.requests.every((url) => url.origin === "http://actions.story.test")).toBe(true);
	});
});
