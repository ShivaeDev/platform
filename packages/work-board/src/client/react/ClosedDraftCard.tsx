import { MessageCircleX } from "lucide-react";
import { CopyButton } from "#client/react/CopyButton.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { Textarea } from "#client/react/components/ui/textarea.tsx";
import { useCopy } from "#client/react/useCopy.ts";
import { answerTextClass } from "./answerTextClass.ts";

export interface ClosedDraft {
	readonly id: string;
	readonly reason: string;
	readonly text: string;
	readonly title: string | undefined;
}

export function ClosedDraftCard({ draft }: { readonly draft: ClosedDraft }) {
	const { fieldRef, handleCopy, status } = useCopy<HTMLTextAreaElement>(draft.text, { copied: "Copied.", selected: "draft" });
	return (
		<section
			aria-labelledby={`answer-title-${draft.id}`}
			className="response-panel max-w-[72ch] space-y-4 rounded-xl border bg-card p-5 text-card-foreground shadow-sm"
			data-closed-draft=""
			id={`answer-card-${draft.id}`}
			tabIndex={-1}
		>
			<h2 className="flex items-center gap-2 font-medium text-muted-foreground text-sm" id={`answer-title-${draft.id}`}>
				<MessageCircleX aria-hidden="true" className="size-4" />
				Closed while you were writing: {draft.title ?? "this question"}
			</h2>
			<p className="rounded-md bg-muted px-3 py-2 text-sm" role="status">
				{draft.reason} Your draft was not sent.
			</p>
			<div className="grid gap-2">
				<Label className="font-normal" htmlFor={`closed-draft-${draft.id}`}>
					Your unsent draft
				</Label>
				<Textarea className={answerTextClass(true)} id={`closed-draft-${draft.id}`} readOnly ref={fieldRef} value={draft.text} />
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<CopyButton onClick={handleCopy}>Copy draft</CopyButton>
				<p className="m-0 text-muted-foreground text-xs" data-copy-status role="status">
					{status}
				</p>
			</div>
		</section>
	);
}
