import { type RefObject, useId } from "react";
import type { Document } from "#browser/document/schema.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { Input } from "#client/react/components/ui/input.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { Textarea } from "#client/react/components/ui/textarea.tsx";
import type { ShellApi } from "./ShellApi.ts";
import { TodayContext } from "./TodayContext.tsx";
import { TodayHiddenDraft } from "./TodayHiddenDraft.tsx";
import { TodayOptionButton } from "./TodayOptionButton.tsx";
import { type Inline, inlineReason } from "./todayInline.ts";
import { type TodayChoice, useTodayAnswer } from "./useTodayAnswer.ts";

export function TodayAnswer({
	api,
	document: data,
	focusRef,
	href,
	inline,
	onSaved,
	title,
}: {
	readonly api: ShellApi;
	readonly document: Document;
	readonly focusRef: RefObject<HTMLElement | null>;
	readonly href: string;
	readonly inline: Inline;
	readonly onSaved: () => void;
	readonly title: string;
}) {
	const authorId = useId();
	const answer = useTodayAnswer(api, data, inline.preview, inline.prompt ? [inline.prompt] : [], onSaved);
	const { heading, reason } = inlineReason(inline);
	return (
		<fieldset aria-label={`${inline.mode === "options" ? "Options" : "Answer"} for ${title}`} className="m-0 min-w-0 space-y-3 border-0 px-2 pb-1">
			{!heading && <p className="m-0 line-clamp-2 text-sm font-medium">{reason}</p>}
			{inline.mode === "options" ? (
				<TodayChoices choose={answer.choose} document={data} focusRef={focusRef} heading={heading} locked={answer.locked} prompt={inline.prompt} />
			) : (
				<TodayText answer={answer} focusRef={focusRef} heading={heading} />
			)}
			<TodayHiddenDraft href={href} text={answer.hidden} />
			<TodayContext inline={inline} />
			<details className="text-muted-foreground text-xs">
				<summary className="cursor-pointer">More options</summary>
				<div className="mt-2 flex items-center gap-2">
					<Label className="shrink-0 text-xs font-normal" htmlFor={authorId}>
						Answer as
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
	focusRef,
	heading,
	locked,
	prompt,
}: {
	readonly choose: (choice: TodayChoice) => void;
	readonly document: Document;
	readonly focusRef: RefObject<HTMLElement | null>;
	readonly heading: string | undefined;
	readonly locked: boolean;
	readonly prompt: Prompt;
}) {
	return (
		<>
			<p className="text-muted-foreground m-0 text-xs">{heading ?? "Choose one option."}</p>
			<div className="grid gap-2">
				{prompt.options.map((option, index) => (
					<TodayOptionButton
						disabled={locked}
						key={option.id}
						onChoose={() => choose({ selected: [option.id], text: "" })}
						option={option}
						recommended={data.metadata.recommended}
						ref={index === 0 ? focusTarget(focusRef) : undefined}
						source={data.metadata.options?.[index]}
					/>
				))}
			</div>
		</>
	);
}

function TodayText({
	answer,
	focusRef,
	heading,
}: {
	readonly answer: ReturnType<typeof useTodayAnswer>;
	readonly focusRef: RefObject<HTMLElement | null>;
	readonly heading: string | undefined;
}) {
	const textId = useId();
	return (
		<form
			className="grid gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				answer.choose({ selected: [], text: answer.text });
			}}
		>
			<Label className="text-muted-foreground text-xs font-normal" htmlFor={textId}>
				{heading ?? "Your answer"}
			</Label>
			<Textarea
				disabled={answer.locked}
				id={textId}
				maxLength={answer.limit}
				onChange={(event) => answer.write(event.currentTarget.value)}
				ref={focusTarget(focusRef)}
				value={answer.text}
			/>
			<div className="bg-popover sticky bottom-0 flex justify-end py-1">
				<Button className="pointer-coarse:h-11" disabled={answer.locked || !answer.text.trim()} size="sm" type="submit">
					Record answer
				</Button>
			</div>
		</form>
	);
}

function focusTarget(ref: RefObject<HTMLElement | null>) {
	return (element: HTMLElement | null) => {
		ref.current = element;
	};
}
