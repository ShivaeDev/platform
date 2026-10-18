import { board as boardApi } from "@shivaedev/work-board/server/integration/board.ts";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import { briefRevision } from "#board/briefRevision.ts";

const { revisionOf } = responses;

export function workRevision(revision: string, context?: string): string {
	return context !== undefined && revision === revisionOf(context) ? briefRevision(boardApi.metadataParse(context)) : revision;
}
