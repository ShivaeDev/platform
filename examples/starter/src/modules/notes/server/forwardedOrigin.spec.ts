import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { app, behindProxy, signedIn } from "#modules/notes/test-support/application.ts";

app.it("without PUBLIC_URL, a forwarded HTTPS caller can create a note", [behindProxy("unset"), signedIn()], function* ({ actor }) {
	const note = yield* actor().notes.create({ title: "A note behind TLS" });

	expect(note.title).toBe("A note behind TLS");
});

app.it("without PUBLIC_URL, a foreign origin receives Forbidden", [behindProxy("unset"), signedIn()], function* ({ actor, foreignRequest }) {
	const response = yield* foreignRequest(actor().cookie);

	expect(response.status).toBe(HttpStatus.fromLiteral("Forbidden"));
});
