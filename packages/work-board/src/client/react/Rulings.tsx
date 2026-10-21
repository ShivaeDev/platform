import type { Document } from "#browser/document/schema.ts";
import { AnswerMarkdown } from "./AnswerMarkdown.tsx";

export function Rulings({ document }: { readonly document: Document }) {
	return document.rulings?.map((ruling) => (
		<section aria-label="Ruling" key={ruling.href}>
			<h2>
				<a href={ruling.href}>{ruling.title}</a>
			</h2>
			<AnswerMarkdown file={document.file} source={ruling.answer} />
		</section>
	));
}
