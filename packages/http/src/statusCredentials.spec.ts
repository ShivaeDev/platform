import { expect } from "vitest";
import { statusCredentials } from "#test/http-client/statusCredentials.ts";

for (const status of [401, 404, 410, 429, 503]) {
	statusCredentials.it(`an HTTP ${status} failure URL drops credentials, query and fragment`, [], function* ({ failure, refuse, remoteUrl }) {
		yield* refuse(status, "alice:password");

		expect(yield* failure()).toMatchObject({ method: "GET", status, url: `${yield* remoteUrl()}/answer/${status}` });
	});
}

for (const userinfo of ["alice", ":password", "al%40ice:p%40ssword"]) {
	statusCredentials.it(`an HTTP failure URL drops ${userinfo} userinfo`, [], function* ({ failure, refuse, remoteUrl }) {
		yield* refuse(401, userinfo);

		expect(yield* failure()).toMatchObject({ method: "GET", status: 401, url: `${yield* remoteUrl()}/answer/401` });
	});
}
