import { expect } from "vitest";
import { visitor, visitorApp } from "#test/visitorApp.ts";

visitorApp.it(
	"presents a foreign Origin and forged addresses through the visitor's edge",
	[
		visitor("ada", {
			edge: { forwardedHops: ["203.0.113.9"] },
			headers: { origin: "https://foreign.example", "x-forwarded-for": "198.51.100.7", "x-real-ip": "192.0.2.4" },
		}),
	],
	function* ({ as }) {
		const answer = yield* as("ada").asks();

		expect(answer).toMatchObject({ forwardedFor: "198.51.100.7, 203.0.113.9", origin: "https://foreign.example", realIp: "192.0.2.4" });
	},
);

visitorApp.it(
	"gives each visitor an independent edge header policy",
	[
		visitor("ada", { edge: { headers: { "x-forwarded-for": "203.0.113.1", "x-real-ip": "203.0.113.2" } } }),
		visitor("bob", { edge: { headers: { "x-forwarded-for": "192.0.2.1", "x-real-ip": "192.0.2.2" } } }),
	],
	function* ({ as }) {
		const ada = yield* as("ada").asks();
		const bob = yield* as("bob").asks();

		expect([ada.forwardedFor, ada.realIp, bob.forwardedFor, bob.realIp]).toEqual(["203.0.113.1", "203.0.113.2", "192.0.2.1", "192.0.2.2"]);
	},
);

visitorApp.it("presents the public host and HTTPS scheme to the local app", [visitor("ada")], function* ({ as }) {
	const answer = yield* as("ada").asks();

	expect(answer).toMatchObject({ forwardedHost: "app.example", scheme: "https" });
});

visitorApp.it("uses the local HTTP app when no public URL is configured", [visitor("ada", {})], function* ({ as }) {
	yield* as("ada").receivesCookies(["session=ada; Path=/"]);

	const answer = yield* as("ada").asks();

	expect(answer).toMatchObject({ cookies: "session=ada", scheme: "http" });
});

visitorApp.it(
	"sends a request's method, path, query, body and Origin override",
	[visitor("ada", { headers: { origin: "https://default.example" } })],
	function* ({ as }) {
		const answer = yield* as("ada").asks("/notes?draft=yes", { body: "my note", headers: { Origin: "https://other.example" }, method: "POST" });

		expect(answer).toMatchObject({ body: "my note", method: "POST", origin: "https://other.example", path: "/notes?draft=yes" });
	},
);
