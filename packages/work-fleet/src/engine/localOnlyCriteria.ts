import { Effect } from "effect";
import { workMetadata } from "#board/readPass.ts";
import type { BoardWork } from "#policy.ts";

function mentions(text: string, localPath: string) {
	const escaped = localPath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
	return new RegExp(`(?<![\\w.-])${escaped}(?![\\w-])`, "u").test(text);
}

export const localOnlyCriteria = Effect.fn("Fleet.localOnlyCriteria")(function* (work: BoardWork, localPath: string | undefined) {
	if (localPath === undefined) {
		return undefined;
	}
	const criteria = (yield* workMetadata(work)).fields.criteria?.filter(({ text }) => mentions(text, localPath)) ?? [];
	if (criteria.length > 0) {
		return `Criteria ${criteria.map(({ id }) => `"${id}"`).join(", ")} reference ${localPath}: Cloud workers cannot read local-only Board data`;
	}
	return undefined;
});
