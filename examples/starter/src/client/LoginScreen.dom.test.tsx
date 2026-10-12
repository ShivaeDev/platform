import { act } from "react";
import { expect, it, onTestFinished } from "vitest";
import { eventually, expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import type { AuthActions, Credentials } from "./auth.ts";
import { LoginScreen } from "./LoginScreen.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it("submits signup and sign-in, retains rejected input, and shows provider and network failures", async () => {
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
	async function enter(label: string, value: string) {
		const field = [...view.container.querySelectorAll("label")].find((element) => element.textContent === label);
		const input = document.getElementById(field?.htmlFor ?? "");
		if (!(input instanceof HTMLInputElement)) {
			throw new Error(`Missing ${label} input`);
		}
		await act(() => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
	}
	async function submit() {
		await act(async () => {
			view.container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
			await Promise.resolve();
		});
	}
	await act(() => [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Create an account")?.click());
	await enter("Name", "Alice");
	await enter("Email", "alice@starter.test");
	await enter("Password", "correct-horse");
	await submit();
	expect(calls).toEqual([{ credentials: { email: "alice@starter.test", name: "Alice", password: "correct-horse" }, mode: "sign-up" }]);
	expect(view.container.querySelector("[role=alert]")?.textContent).toBe(outcome);
	expect(view.container.querySelector<HTMLInputElement>("input[type=email]")?.value).toBe("alice@starter.test");
	expect(authenticated).toBe(0);
	outcome = undefined;
	await submit();
	await eventually(() => expect(authenticated).toBe(1));
	await act(() => [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Use an existing account")?.click());
	unavailable = true;
	await submit();
	expect(calls.at(-1)?.mode).toBe("sign-in");
	expect(view.container.querySelector("[role=alert]")?.textContent).toBe("Could not reach authentication. Try again.");
	unavailable = false;
	await submit();
	expect(authenticated).toBe(2);
});
