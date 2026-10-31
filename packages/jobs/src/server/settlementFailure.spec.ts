import { Redacted, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { ProviderRejected } from "#test/ProviderRejected.ts";
import { running, runtime } from "#test/runtime/kit.ts";
import { settlementFailsWith } from "#test/runtime/settlementFailsWith.ts";
import { worker } from "#test/workers.ts";

const Reports = defineQueue({ name: "reports", schema: Schema.Struct({}) });

runtime.it(
	"a settle failure exposes the original tag and message with its secrets redacted",
	[
		settlementFailsWith(
			new ProviderRejected({
				detail: { original: Redacted.make("credential-secret"), reason: "database unavailable" },
				message: "database unavailable: token=provider-secret",
				status: 503,
				token: "provider-secret",
			}),
		),
		running("app", [worker(Reports, "succeeds")]),
	],
	function* ({ batchFailureMessage, deliver }) {
		yield* deliver("reports", [{ data: {}, id: "report" }]);

		expect(yield* batchFailureMessage()).toBe("pg-boss settle for queue reports failed: ProviderRejected: database unavailable: token=<redacted>");
	},
);
