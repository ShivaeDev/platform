import { answerBody } from "./answerBody.ts";
import type { Draft } from "./drafts.ts";
import type { Prompt } from "./Prompt.ts";

export function responsePreview(draft: Draft, question: string, prompts: readonly Prompt[] = []): string {
	return `New file: responses/${draft.id}.md\nRegistration (if needed): responses/${question}.md\nRecorded time is assigned by the server when saving.\n\n---\n${JSON.stringify({ id: draft.id, kind: "response", response: { answers: draft.answers, author: draft.author, question, reviewedRevision: draft.revision, supersedes: draft.supersedes, type: draft.type } }, null, 2)}\n---\n${draft.answers ? answerBody(prompts, draft.answers, draft.body) : draft.body}`;
}
