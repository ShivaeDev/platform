import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { revisionOf } from "@shivaedev/work-board/responses/records.ts";
import { briefRevision } from "#board/briefRevision.ts";

export function workRevision(revision: string, context?: string): string {
	return context !== undefined && revision === revisionOf(context) ? briefRevision(metadataParse(context)) : revision;
}
