import { Schema } from "effect";
import { Identity } from "#path/Identity.ts";
import { Answers, type PromptAnswer } from "./schema.ts";

export const DRAFT_BYTES = 2 * 1024 * 1024;
export const DRAFT_AGE = 30 * 24 * 60 * 60 * 1000;
export interface Draft {
	readonly answers?: readonly PromptAnswer[] | undefined;
	readonly author: string;
	readonly body: string;
	readonly id: string;
	readonly question?: string | undefined;
	readonly recovery?: string | undefined;
	readonly revision: string;
	readonly supersedes?: string | undefined;
	readonly type: string;
	readonly updatedAt: number;
}
function extraFields(entry: object) {
	return {
		...("question" in entry ? { question: Schema.decodeUnknownSync(Identity)(entry.question) } : {}),
		...("recovery" in entry ? { recovery: Schema.decodeUnknownSync(Schema.String)(entry.recovery) } : {}),
		...("answers" in entry ? { answers: Schema.decodeUnknownSync(Answers, { onExcessProperty: "error" })(entry.answers) } : {}),
		...("supersedes" in entry ? { supersedes: Schema.decodeUnknownSync(Identity)(entry.supersedes) } : {}),
	};
}
export function readDrafts(raw: string | null, now: number): { drafts: Record<string, Draft>; expired: boolean } {
	if (raw === null) {
		return { drafts: {}, expired: false };
	}
	if (new TextEncoder().encode(raw).length > DRAFT_BYTES) {
		throw new Error("Draft storage exceeds the workspace limit.");
	}
	const value: unknown = JSON.parse(raw);
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error("Draft storage is malformed.");
	}
	const drafts: Record<string, Draft> = {};
	let expired = false;
	for (const [key, entry] of Object.entries(value)) {
		if (
			typeof entry !== "object"
			|| entry === null
			|| !("author" in entry)
			|| !("body" in entry)
			|| !("id" in entry)
			|| !("revision" in entry)
			|| !("type" in entry)
			|| !("updatedAt" in entry)
			|| typeof entry.author !== "string"
			|| typeof entry.body !== "string"
			|| typeof entry.id !== "string"
			|| typeof entry.revision !== "string"
			|| (entry.type !== "answer" && entry.type !== "clarify" && entry.type !== "not_now")
			|| typeof entry.updatedAt !== "number"
			|| !Number.isFinite(entry.updatedAt)
		) {
			throw new Error("Draft storage is malformed.");
		}
		if (entry.updatedAt > now || now - entry.updatedAt >= DRAFT_AGE) {
			expired = true;
			continue;
		}
		drafts[key] = {
			...extraFields(entry),
			author: entry.author,
			body: entry.body,
			id: entry.id,
			revision: entry.revision,
			type: entry.type,
			updatedAt: entry.updatedAt,
		};
	}
	return { drafts, expired };
}
export function encodeDrafts(drafts: Readonly<Record<string, Draft>>): string {
	const value = JSON.stringify(drafts);
	if (new TextEncoder().encode(value).length > DRAFT_BYTES) {
		throw new Error("Draft storage is full. Copy this draft before clearing workspace drafts.");
	}
	return value;
}
