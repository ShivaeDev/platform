import { Schema } from "effect";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { PublicationUncertain, ResponseRejection } from "#rpc/rejections.ts";
export function responseFailure(error: unknown) {
	const outcome =
		Schema.is(ResponseRejection)(error) && !(error instanceof PublicationUncertain) && !(error instanceof InternalServerError)
			? "rejected"
			: "uncertain";
	return {
		outcome,
		text: `${outcome === "rejected" ? "Rejected" : "Uncertain"}: ${String(error)}. Draft retained. Preview and retry with the same identity; saved content will be reconciled.`,
	};
}
