import { RegistryContext, useAtomRef } from "@effect/atom-react";
import { Option } from "effect";
import { useContext, useEffect, useRef, useState } from "react";
import type { Document } from "#browser/document/schema.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { authorLabel } from "#client/responses/authorLabel.ts";
import type { ResponseInput } from "#client/responses/formSchema.ts";
import { saveFailure } from "#client/saveFailure.ts";
import { fileUrl } from "#files/url.ts";
import { documentQuery, navigationQuery, routeQueryOptions } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";
import { useAnswerOffline } from "./useAnswerOffline.ts";
import { useResponseForm } from "./useResponseForm.ts";

export interface TodayChoice {
	readonly selected: readonly string[];
	readonly text: string;
}

export function useTodayAnswer(api: ShellApi, data: Document, preview: QuestionPreview, prompts: readonly Prompt[], onSaved: () => void) {
	const registry = useContext(RegistryContext);
	const state = useResponseForm(preview, prompts);
	const form = state.form;
	const values = useAtomRef(form.values);
	const savedRef = useRef(onSaved);
	savedRef.current = onSaved;
	const offline = useAnswerOffline();
	const [label] = useState(() => authorLabel(() => localStorage, document.documentElement.dataset.workspace));
	const [author, setAuthor] = useState(() => label.read("") || "maintainer");
	const created = state.created.created;
	useEffect(() => {
		if (Option.isSome(created)) {
			label.save(created.value.author);
			registry.refresh(api.inbox.query(undefined, routeQueryOptions));
			registry.refresh(navigationQuery(api));
			registry.refresh(documentQuery(api, fileUrl(data.file)));
			savedRef.current();
		}
	}, [created, api, registry, data.file, label]);
	const [prompt] = prompts;
	const note = state.answers?.[0]?.text ?? "";
	function write(text: string) {
		if (prompt) {
			state.editAnswers(0, { prompt: prompt.id, selected: [], text });
		} else {
			form.change("body", text);
			state.edit();
		}
	}
	function choose(choice: TodayChoice) {
		if (prompt) {
			form.change("answers", [{ prompt: prompt.id, selected: [...choice.selected], text: choice.selected.length > 0 ? note : choice.text }]);
			form.change("answerContext", JSON.stringify([preview.id, preview.reviewedRevision]));
		} else {
			form.change("body", choice.text);
		}
		state.attempt(author.trim());
		state.created.save();
	}
	let status = Option.match(state.created.failure, { onNone: () => "", onSome: (failure) => saveFailure(failure, "response").text });
	if (offline) {
		status = offline;
	}
	if (state.created.saving) {
		status = "Saving your answer…";
	}
	return {
		author,
		choose,
		hidden: hiddenDraft(values, prompt, inlineOptions(prompt)),
		// The answer file caps a prompt's text below a whole body, as the item page does.
		limit: prompt ? 8192 : 32_768,
		locked: Boolean(offline) || !author.trim() || state.created.saving || Option.isSome(created),
		setAuthor,
		status,
		text: prompt ? note : values.body,
		write,
	};
}

const KINDS = new Map([
	["clarify", "a question back"],
	["not_now", "not now"],
]);

function inlineOptions(prompt: Prompt | undefined) {
	return prompt !== undefined && prompt.mode !== "text";
}

// Today sends the whole shared draft, so it names the parts only the item page shows.
function hiddenDraft(values: ResponseInput, prompt: Prompt | undefined, options: boolean) {
	const parts = [
		(prompt && values.body.trim()) || (options && values.answers?.[0]?.text.trim()) ? "your note" : "",
		KINDS.has(values.type) ? `your reply kind, ${KINDS.get(values.type)}` : "",
		values.supersedes ? "the earlier answer it replaces" : "",
	].filter(Boolean);
	return parts.length > 0 ? `Also sends ${parts.join(", ")} from the item page.` : "";
}
