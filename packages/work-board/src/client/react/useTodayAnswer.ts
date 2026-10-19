import { RegistryContext } from "@effect/atom-react";
import { Cause, Effect, Option } from "effect";
import { useContext, useMemo, useRef, useState } from "react";
import { useAction } from "@shivaedev/effect-react/client/resultState.ts";
import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import { answerBody } from "#browser/responses/answerBody.ts";
import { chosenLabels } from "#browser/responses/cardContext.ts";
import { authorLabel } from "#client/responses/authorLabel.ts";
import { saveFailure } from "#client/saveFailure.ts";
import { fileUrl } from "#files/url.ts";
import { createResponse } from "./createResponse.ts";
import { useFormClient } from "./FormContext.ts";
import { documentQuery, navigationQuery, routeQueryOptions } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";

export interface TodayChoice {
	readonly option?: string;
	readonly text?: string;
}

export function useTodayAnswer(api: ShellApi, data: Document, request: DocumentRequest) {
	const registry = useContext(RegistryContext);
	const requestRef = useRef(request);
	requestRef.current = request;
	const client = useFormClient();
	const [label] = useState(() => authorLabel(() => localStorage, document.documentElement.dataset.workspace));
	const [author, setAuthor] = useState(() => label.read("") || "maintainer");
	const actionAtom = useMemo(
		() =>
			client.runtime.fn(
				Effect.fn("Board.answerToday")(function* (choice: TodayChoice) {
					const preview = requestRef.current.preview;
					const prompts = requestRef.current.prompts ?? [];
					if (!(preview && author.trim())) {
						return yield* Effect.fail("Add your local author label.");
					}
					const answers = prompts.map((prompt) => ({
						prompt: prompt.id,
						selected: choice.option === undefined ? [] : [choice.option],
						text: choice.text ?? "",
					}));
					const submission = {
						...(answers.length > 0 ? { answers } : {}),
						author: author.trim(),
						body: answers.length > 0 ? answerBody(prompts, answers, "") : (choice.text ?? ""),
						id: `response.${crypto.randomUUID()}`,
						question: preview.id,
						revision: preview.reviewedRevision,
						type: "answer" as const,
					};
					const saved = yield* createResponse(client, preview, submission);
					label.save(author);
					registry.refresh(api.inbox.query(undefined, routeQueryOptions));
					registry.refresh(navigationQuery(api));
					registry.refresh(documentQuery(api, fileUrl(data.file)));
					return saved;
				}),
			),
		[client, api, registry, author, data.file, label.save],
	);
	const action = useAction(actionAtom);
	const failure = Option.getOrUndefined(Option.flatMap(action.cause, Cause.findErrorOption));
	const saved = Option.getOrUndefined(action.data);
	const chosen = saved && chosenLabels(request.prompts ?? [], saved.answers, request.options);
	let status = "";
	if (saved) {
		status = `Saved: your answer${chosen ? ` “${chosen}”` : ""} is recorded. The agent reads it the next time it checks.`;
	}
	if (failure) {
		status = typeof failure === "string" ? failure : saveFailure(failure, "response").text;
	}
	if (action.pending) {
		status = "Pending: registering reviewed context, then recording response…";
	}
	return {
		author,
		choose: action.dispatch,
		locked: !(data.writable && author.trim()) || action.pending || Boolean(saved),
		setAuthor,
		status,
	};
}
