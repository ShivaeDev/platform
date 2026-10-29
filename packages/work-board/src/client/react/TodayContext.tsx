import { cn } from "cn";
import { ChevronRight } from "lucide-react";
import { cardContext } from "#browser/responses/cardContext.ts";
import { reasonMarkdown } from "#browser/responses/reasonMarkdown.ts";
import { buttonVariants } from "#client/react/components/ui/button.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#client/react/components/ui/collapsible.tsx";
import { AnswerMarkdown } from "./AnswerMarkdown.tsx";
import type { Inline } from "./todayInline.ts";

export function TodayContext({ inline }: { readonly inline: Inline }) {
	const context = cardContext(inline.preview.context);
	const choices = inline.mode === "text" ? context.choices : [];
	let label = "Item context";
	if (context.recommendation) {
		label = "Recommendation in the question";
	}
	if (choices.length > 0) {
		label = `Options in the question (${choices.length})`;
	}
	return (
		<Collapsible className="group/context">
			<CollapsibleTrigger className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "-ml-2 h-7 text-xs")}>
				<ChevronRight aria-hidden="true" className="transition-transform group-data-open/context:rotate-90" />
				{label}
			</CollapsibleTrigger>
			<CollapsibleContent className="space-y-2 pt-1 text-xs">
				<AnswerMarkdown file={inline.preview.source} source={reasonMarkdown(inline.preview.reason)} />
				{choices.length > 0 ? (
					<ul className="m-0 list-none space-y-2 p-0">
						{choices.map((choice) => (
							<ContextChoice choice={choice} file={inline.preview.source} key={choice.label} />
						))}
					</ul>
				) : null}
				{context.recommendation ? (
					<div className="bg-muted/60 rounded-md px-3 py-2">
						<p className="text-muted-foreground m-0 mb-1 font-medium">Recommendation</p>
						<AnswerMarkdown file={inline.preview.source} source={context.recommendation} />
					</div>
				) : null}
			</CollapsibleContent>
		</Collapsible>
	);
}

function ContextChoice({ choice, file }: { readonly choice: ReturnType<typeof cardContext>["choices"][number]; readonly file: string }) {
	return (
		<li className="rounded-md border px-3 py-2">
			<span className="block font-medium">
				{choice.label}
				{choice.recommended ? " · Recommended" : null}
			</span>
			{choice.description ? <AnswerMarkdown className="text-muted-foreground" file={file} source={choice.description} /> : null}
		</li>
	);
}
