import { useId, useState } from "react";
import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import { promptHeading } from "#browser/responses/cardContext.ts";
import { reasonMarkdown } from "#browser/responses/reasonMarkdown.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { Input } from "#client/react/components/ui/input.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { Textarea } from "#client/react/components/ui/textarea.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { TodayOptionButton } from "./TodayOptionButton.tsx";
import { type TodayChoice, useTodayAnswer } from "./useTodayAnswer.ts";

export type InlineMode = "options" | "text";

const READ_ONLY = "Answering is turned off on this Board.";

export function TodayAnswer({
	api,
	document: data,
	mode,
	request,
}: {
	readonly api: ShellApi;
	readonly document: Document;
	readonly mode: InlineMode;
	readonly request: DocumentRequest;
}) {
	const authorId = useId();
	const answer = useTodayAnswer(api, data, request);
	const reason = reasonMarkdown(request.preview?.reason ?? "").split("\n")[0];
	const prompt = request.prompts?.[0];
	const heading = prompt && promptHeading(prompt.source).title;
	return (
		<fieldset aria-label={`${mode === "options" ? "Options" : "Answer"} for ${data.identity}`} className="m-0 min-w-0 space-y-3 border-0 px-2 pb-1">
			{Boolean(reason) && <p className="m-0 font-medium text-sm">{reason}</p>}
			{mode === "options" ? (
				<TodayChoices choose={answer.choose} document={data} heading={heading} locked={answer.locked} request={request} />
			) : (
				<TodayText choose={answer.choose} heading={heading} locked={answer.locked} />
			)}
			<details className="text-muted-foreground text-xs">
				<summary className="cursor-pointer">Answer as {answer.author || "…"}</summary>
				<div className="mt-2 flex items-center gap-2">
					<Label className="shrink-0 font-normal text-xs" htmlFor={authorId}>
						Local author label
					</Label>
					<Input
						className="h-8 text-xs"
						id={authorId}
						maxLength={200}
						onChange={(event) => answer.setAuthor(event.currentTarget.value)}
						value={answer.author}
					/>
				</div>
			</details>
			{!data.writable && <p className="m-0 text-muted-foreground text-xs">{READ_ONLY}</p>}
			{Boolean(answer.status) && (
				<p className="m-0 text-xs" role="status">
					{answer.status}
				</p>
			)}
		</fieldset>
	);
}

function TodayChoices({
	choose,
	document: data,
	heading,
	locked,
	request,
}: {
	readonly choose: (choice: TodayChoice) => void;
	readonly document: Document;
	readonly heading: string | undefined;
	readonly locked: boolean;
	readonly request: DocumentRequest;
}) {
	return (
		<>
			<p className="m-0 text-muted-foreground text-xs">{heading ?? "Choose one option."}</p>
			<div className="grid gap-2">
				{request.prompts?.[0]?.options.map((option, index) => (
					<TodayOptionButton
						disabled={locked}
						key={option.id}
						onChoose={() => choose({ option: option.id })}
						option={option}
						recommended={data.metadata.recommended}
						source={data.metadata.options?.[index]}
					/>
				))}
			</div>
		</>
	);
}

function TodayText({
	choose,
	heading,
	locked,
}: {
	readonly choose: (choice: TodayChoice) => void;
	readonly heading: string | undefined;
	readonly locked: boolean;
}) {
	const textId = useId();
	const [text, setText] = useState("");
	return (
		<form
			className="grid gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				choose({ text });
			}}
		>
			<Label className="font-normal text-muted-foreground text-xs" htmlFor={textId}>
				{heading ?? "Your answer"}
			</Label>
			<Textarea disabled={locked} id={textId} maxLength={32_768} onChange={(event) => setText(event.currentTarget.value)} value={text} />
			<Button className="justify-self-end" disabled={locked || !text.trim()} size="sm" type="submit">
				Record answer
			</Button>
		</form>
	);
}
