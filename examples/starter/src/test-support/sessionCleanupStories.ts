import { setTimeout } from "node:timers/promises";
import { expect, it } from "vitest";
import { appAuth } from "./appAuth.ts";

it("leaves the real session atom after a null-session response", async () => {
	const { auth, requests } = appAuth({ baseUrl: "http://session.story.test" });
	const session = auth.client.$store.atoms.session;
	if (!session) {
		throw new Error("The auth client has no session atom to subscribe to");
	}
	let observed = session.value;
	const unsubscribe = session.subscribe((value) => {
		observed = value;
	});
	await setTimeout(20);
	unsubscribe();
	expect(requests.map((url) => url.pathname)).toContain("/api/auth/get-session");
	expect(observed).toMatchObject({ data: null, error: null, isPending: false });
});
