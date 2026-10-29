import { ExternalLink } from "lucide-react";
import { cardContext } from "#browser/responses/cardContext.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { LinkButton } from "#client/react/LinkButton.tsx";
import { AnswerMarkdown } from "./AnswerMarkdown.tsx";

export function AnswerContext({ preview }: { readonly preview: QuestionPreview }) {
	const context = cardContext(preview.context);
	return (
		<>
			{Boolean(context.recommendation) && (
				<div className="bg-muted/60 rounded-lg px-4 py-3 text-sm">
					<p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Recommendation</p>
					<AnswerMarkdown className="answer-recommendation" file={preview.source} source={context.recommendation} />
				</div>
			)}
			{context.links.length > 0 && (
				<div className="answer-links flex flex-wrap gap-2">
					{context.links.map((link) => (
						<AnswerLink key={link.url} link={link} />
					))}
				</div>
			)}
		</>
	);
}

function AnswerLink({ link }: { readonly link: ReturnType<typeof cardContext>["links"][number] }) {
	return (
		<LinkButton className="answer-link" href={link.url} variant={link.primary ? "default" : "outline"}>
			{link.label}
			<ExternalLink aria-hidden="true" />
		</LinkButton>
	);
}
