import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { authReads, pendingAuthRead } from "#test/authQueryStories.tsx";

authReads.it("renders a successful Better Auth read through useQuery", [pendingAuthRead()], function* ({ succeed, text, request, observe }) {
	yield* succeed("Consent granted");
	yield* observe("the read is rendered", () => expect(text()).toContain('"value":"Consent granted"'));
	expect(request().inputs).toEqual(["consent"]);
});
authReads.it("keeps returned auth errors in the typed failure channel", [pendingAuthRead()], function* ({ refuse, text, observe }) {
	yield* refuse();
	yield* observe("the typed auth failure is rendered", () =>
		expect(text()).toContain(`"error":${JSON.stringify({ code: "REFUSED", status: HttpStatus.fromLiteral("Forbidden") })}`),
	);
});
authReads.it("renders a rejected promise as AuthActionUnavailable", [pendingAuthRead()], function* ({ reject, text, observe }) {
	yield* reject();
	yield* observe("the unavailable failure is rendered", () => expect(text()).toContain('"cause":"offline","_tag":"AuthActionUnavailable"'));
});
authReads.it("aborts a pending auth read when its screen unmounts", [pendingAuthRead()], function* ({ close, request, observe }) {
	expect(request().aborted).toBe(false);
	yield* close();
	yield* observe("the auth request is aborted", () => expect(request().aborted).toBe(true));
});

authReads.it("keys cached reads by their input", [pendingAuthRead()], function* ({ succeed, read, text, request, observe }) {
	yield* succeed("First consent");
	yield* observe("the first consent is rendered", () => expect(text()).toContain('"value":"First consent"'));
	yield* read("consent");
	expect(request().inputs).toEqual(["consent"]);
	yield* read("another");
	yield* succeed("Another consent");
	yield* observe("the next consent is rendered", () => expect(text()).toContain('"value":"Another consent"'));
	expect(request().inputs).toEqual(["consent", "another"]);
});
