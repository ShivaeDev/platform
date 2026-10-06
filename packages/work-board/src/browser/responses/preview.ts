import type { Draft } from "./drafts.ts";

export function responsePreview(draft: Draft, question: string): string {
	return `New file: responses/${draft.id}.md\nRegistration (if needed): responses/${question}.md\nRecorded time is assigned by the server when saving.\n\n---\n${JSON.stringify({ id: draft.id, kind: "response", response: { author: draft.author, question, reviewedRevision: draft.revision, type: draft.type } }, null, 2)}\n---\n${draft.body}`;
}
