import { ExternalLink } from "lucide-react";
import { cardContext } from "#browser/responses/cardContext.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { buttonVariants } from "#client/react/components/ui/buttonVariants.ts";
import { cn } from "#client/react/lib/cn.ts";
import { AnswerMarkdown } from "./AnswerMarkdown.tsx";

export function AnswerContext({ preview }: { readonly preview: QuestionPreview }) {
	const context = cardContext(preview.context);
	return (
		<>
			{Boolean(context.recommendation) && (
				<div className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
					<p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">Recommendation</p>
					<AnswerMarkdown className="answer-recommendation" file={preview.source} source={context.recommendation} />
				</div>
			)}
			{context.links.length > 0 && (
				<div className="answer-links flex flex-wrap gap-2">
					{context.links.map((link) => (
						<a
							className={cn(buttonVariants({ size: "sm", variant: link.primary ? "default" : "outline" }), "answer-link")}
							href={link.url}
							key={link.url}
						>
							{link.label}
							<ExternalLink aria-hidden="true" />
						</a>
					))}
				</div>
			)}
		</>
	);
}
