import { Effect } from "effect";
import { makeApp } from "./api.ts";
import { expireSession } from "./sessionLifecycle.ts";
import { browser, sessions } from "./sessionStory.ts";

export const expiryDuringAccountLookup = sessions.trait("accounts", "the session expires after its read and before the account lookup", (state) => {
	state.apps.set(
		"browser",
		makeApp(state.provider, browser, async (headers) => {
			const session = await state.provider.auth.api.getSession({ headers });
			if (session === null) {
				throw new Error("The expiry precondition requires a live session");
			}
			await Effect.runPromise(expireSession(state.provider, session.session.token));
			return state.provider.auth.api.listUserAccounts({ headers });
		}),
	);
});
