import type { Document } from "#browser/document/schema.ts";
import { optionText } from "#browser/responses/cardContext.ts";
import { type Inline, inlineReason } from "./todayInline.ts";

const READ_ONLY = "Answering is turned off on this Board.";

export function TodayReadOnly({ document: data, inline }: { readonly document: Document; readonly inline: Inline }) {
	const { heading, reason } = inlineReason(inline);
	return (
		<div className="space-y-3 px-2 pb-1">
			{Boolean(reason) && <p className="m-0 text-sm font-medium">{reason}</p>}
			{heading ? <p className="text-muted-foreground m-0 text-xs">{heading}</p> : null}
			{inline.mode === "options" ? (
				<ul className="m-0 list-none space-y-2 p-0">
					{inline.prompt.options.map((option, index) => (
						<ReadOnlyOption document={data} index={index} key={option.id} option={option} />
					))}
				</ul>
			) : null}
			<p className="text-muted-foreground m-0 text-xs">{READ_ONLY}</p>
		</div>
	);
}

function ReadOnlyOption({
	document: data,
	index,
	option,
}: {
	readonly document: Document;
	readonly index: number;
	readonly option: { readonly id: string; readonly source: string };
}) {
	const authored = optionText(option.id, option.source);
	const label = data.metadata.options?.[index]?.label ?? authored.label;
	const description = data.metadata.options?.[index]?.description ?? authored.description;
	return (
		<li className="rounded-md border px-3 py-2">
			<span className="block text-xs font-medium">
				{label}
				{data.metadata.recommended === label ? " · Recommended" : null}
			</span>
			{description ? <span className="text-muted-foreground block text-xs">{description}</span> : null}
		</li>
	);
}
