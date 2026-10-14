import { cardContext } from "#browser/responses/cardContext.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { ResponseMarkdown } from "./ResponseMarkdown.tsx";

export function AnswerContext({ preview }: { readonly preview: QuestionPreview }) {
	const context = cardContext(preview.context);
	return (
		<>
			{Boolean(context.recommendation) && (
				<div className="answer-recommendation">
					<ResponseMarkdown file={preview.source} source={context.recommendation} />
				</div>
			)}
			{context.links.length > 0 && (
				<div className="answer-links flex flex-wrap gap-2">
					{context.links.map((link) => (
						<a
							className={`answer-link ${link.primary ? "bg-primary text-primary-foreground" : "border border-border"} inline-flex items-center rounded-md px-4 py-2 font-medium`}
							href={link.url}
							key={link.url}
						>
							{link.label}
						</a>
					))}
				</div>
			)}
		</>
	);
}
