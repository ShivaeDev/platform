import { Schema } from "effect";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { PublicationUncertain, ResponseRejection } from "#rpc/rejections.ts";
export function failureStatus(error: unknown) {
	return `${Schema.is(ResponseRejection)(error) && !(error instanceof PublicationUncertain) && !(error instanceof InternalServerError) ? "Rejected" : "Uncertain"}: ${String(error)}. Draft retained; preview and retry.`;
}
