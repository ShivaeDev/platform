import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { managedRequestReceipt } from "@shivaedev/work-board/attention/managedRequestReceipt.ts";
import { requestReceiptStory } from "#test/requestReceiptStory.ts";

it.effect("qualifies one exact managed decision and rejects authored, ambiguous and invalid receipt evidence", () =>
	Effect.sync(() => {
		const accepted = requestReceiptStory("managed");
		expect(managedRequestReceipt(accepted.document, accepted.request, accepted.model)?.disposition).toBe("applied");
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
			"competing-receipt",
			"competing-answer",
		] as const) {
			const story = requestReceiptStory(trait);
			expect(managedRequestReceipt(story.document, story.request, story.model), trait).toBeUndefined();
		}
	}),
);
