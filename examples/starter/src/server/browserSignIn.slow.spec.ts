import { expect } from "vitest";
import { aliceHasPasswordAccount, browserSignIn } from "#test-support/browserSignIn.ts";

browserSignIn.it(
	"browser-check signs in as alice once and both starter session pages receive exactly one copy of her issued cookie",
	[aliceHasPasswordAccount],
	function* ({ checksSessionPages, cookieAdoption }) {
		expect(yield* cookieAdoption()).toEqual({ requests: [], signIns: [] });

		const run = yield* checksSessionPages();

		expect(run, `${run.stdout}\n${run.stderr}`).toMatchObject({ exitCode: 0 });
		expect(yield* cookieAdoption()).toEqual({
			requests: [["better-auth.session_token"], ["better-auth.session_token"]],
			signIns: [200],
		});
	},
);

browserSignIn.it(
	"browser-check rejects alice's incorrect password with the starter's HTTP 401 and opens no session pages",
	[aliceHasPasswordAccount],
	function* ({ checksSessionPages, cookieAdoption }) {
		const run = yield* checksSessionPages("incorrect-password");

		expect(run.exitCode).toBe(1);
		expect(run.stderr).toContain("Test-user sign-in returned HTTP 401.");
		expect(yield* cookieAdoption()).toEqual({ requests: [], signIns: [401] });
	},
);
