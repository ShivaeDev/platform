import { Redacted, Schema } from "effect";
import { RemoteHttpError } from "@shivaedev/http/errors.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { ProviderRejected } from "#test/ProviderRejected.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Failed = defineQueue({ name: "failure-summary", queue: { retryLimit: 0 }, schema: Schema.Struct({}) });

database.it(
	"a RemoteHttpError is stored and listed with its tag and call summary, without URL credentials, query or fragment",
	[
		running("app", [
			worker(Failed, {
				failsWith: new RemoteHttpError({ method: "POST", status: 503, url: "https://user:password@api.example.com/orders?token=private#fragment" }),
			}),
		]),
		enqueued(Failed, {}, { as: "remote call" }),
	],
	function* ({ listedOutputs, storedOutput, untilJob }) {
		yield* untilJob("remote call", "failed");

		const summary = { _tag: "RemoteHttpError", message: "HTTP 503: POST api.example.com/orders" };
		yield* outcomes({
			"listed failure": [listedOutputs("app", "failed", Failed), [summary]],
			"stored failure": [storedOutput("remote call"), summary],
		});
	},
);

for (const message of [undefined, "", "   "]) {
	database.it(
		`a tagged error with ${JSON.stringify(message) ?? "no"} message is stored and listed with safe fields and redacted secrets`,
		[
			running("app", [
				worker(Failed, {
					failsWith: new ProviderRejected({
						detail: { original: Redacted.make("credential-secret"), reason: "provider unavailable" },
						status: 503,
						token: "provider-secret",
						...(message === undefined ? {} : { message }),
					}),
				}),
			]),
			enqueued(Failed, {}, { as: "rejected call" }),
		],
		function* ({ listedOutputs, storedOutput, untilJob }) {
			yield* untilJob("rejected call", "failed");

			const summary = {
				_tag: "ProviderRejected",
				message: '{"detail":{"original":"<redacted>","reason":"provider unavailable"},"status":503,"token":"<redacted>"}',
			};
			yield* outcomes({
				"listed failure": [listedOutputs("app", "failed", Failed), [summary]],
				"stored failure": [storedOutput("rejected call"), summary],
			});
		},
	);
}
