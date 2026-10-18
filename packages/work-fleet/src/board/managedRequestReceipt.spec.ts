import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { managedRequestReceipt } from "@shivaedev/work-board/server/attention/managedRequestReceipt.ts";
import { requestReceiptStory } from "#test/requestReceiptStory.ts";

it.effect("qualifies exact managed decisions and rejects authored, ambiguous and invalid receipt evidence", () =>
	Effect.sync(() => {
		for (const trait of ["managed", "agreeing-receipt"] as const) {
			const accepted = requestReceiptStory(trait);
			expect(managedRequestReceipt(accepted.document, accepted.request, accepted.model)?.disposition, trait).toBe("applied");
		}
		for (const trait of [
			"authored",
			"task",
			"clarify",
			"not_now",
			"duplicate-request",
			"malformed-source",
			"duplicate-question",
			"duplicate-response",
			"duplicate-receipt",
			"competing-answer",
		] as const) {
			const story = requestReceiptStory(trait);
			expect(managedRequestReceipt(story.document, story.request, story.model), trait).toBeUndefined();
		}
	}),
);
