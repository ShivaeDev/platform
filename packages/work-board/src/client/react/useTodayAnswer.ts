import { RegistryContext, useAtomRef } from "@effect/atom-react";
import { Option } from "effect";
import { useContext, useEffect, useRef, useState } from "react";
import type { Document } from "#browser/document/schema.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { authorLabel } from "#client/responses/authorLabel.ts";
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
	function write(text: string) {
		if (prompt) {
			state.editAnswers(0, { prompt: prompt.id, selected: [], text });
		} else {
			form.change("body", text);
			state.edit();
		}
	}
	// Today records only what it shows, so draft fields edited on the item page but hidden here are left out.
	function choose(choice: TodayChoice) {
		form.values.set({
			...form.values.value,
			answerContext: JSON.stringify([preview.id, preview.reviewedRevision]),
			answers: prompt ? [{ prompt: prompt.id, selected: [...choice.selected], text: choice.text }] : undefined,
			body: prompt ? "" : choice.text,
			supersedes: undefined,
			type: "answer",
		});
		if (state.attempt(author.trim())) {
			state.created.save();
		}
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
		locked: Boolean(offline) || !author.trim() || state.created.saving || Option.isSome(created),
		setAuthor,
		status,
		text: prompt ? (state.answers?.[0]?.text ?? "") : values.body,
		write,
	};
}
