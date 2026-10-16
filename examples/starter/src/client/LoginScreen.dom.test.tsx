import { act } from "react";
import { expect, onTestFinished } from "vitest";
import { eventually, expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { screens } from "#test-support/screens.ts";
import type { AuthActions, Credentials } from "./auth.ts";
import { LoginScreen } from "./LoginScreen.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

screens.it(
	"submits signup and sign-in, retains rejected input, and shows provider and network failures",
	[],
	function* ({ interact, enter, submit }) {
		yield* interact(async () => {
			const calls: { mode: string; credentials: Credentials }[] = [];
			let outcome: string | undefined = "Email is already registered";
			let unavailable = false;
			let authenticated = 0;
			const auth: AuthActions = {
				signOut: () => Promise.resolve(undefined),
				submit: (mode, credentials) => {
					calls.push({ credentials, mode });
					if (unavailable) {
						return Promise.reject(new Error("offline"));
					}
					return Promise.resolve(outcome);
				},
			};
			const view = await render(
				<LoginScreen
					auth={auth}
					onAuthenticated={() => {
						authenticated += 1;
					}}
				/>,
			);
			onTestFinished(view.unmount);

			await act(() => [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Create an account")?.click());
			await enter(view.container, "Alice", "Name");
			await enter(view.container, "alice@starter.test", "Email");
			await enter(view.container, "correct-horse", "Password");
			await submit(view.container);
			expect(calls).toEqual([{ credentials: { email: "alice@starter.test", name: "Alice", password: "correct-horse" }, mode: "sign-up" }]);
			expect(view.container.querySelector("[role=alert]")?.textContent).toBe(outcome);
			expect(view.container.querySelector<HTMLInputElement>("input[type=email]")?.value).toBe("alice@starter.test");
			expect(authenticated).toBe(0);
			outcome = undefined;
			await submit(view.container);
			await eventually(() => expect(authenticated).toBe(1));
			await act(() => [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Use an existing account")?.click());
			unavailable = true;
			await submit(view.container);
			expect(calls.at(-1)?.mode).toBe("sign-in");
			expect(view.container.querySelector("[role=alert]")?.textContent).toBe("Could not reach authentication. Try again.");
			unavailable = false;
			await submit(view.container);
			expect(authenticated).toBe(2);
		});
	},
);
