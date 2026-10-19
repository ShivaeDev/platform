import { ChevronDown, Pencil } from "lucide-react";
import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { AnswerForm } from "./AnswerForm.tsx";
import { AnswerOff } from "./AnswerOff.tsx";

export function AnswerControls({
	answered,
	onDraft,
	open,
	preview,
	request,
	source,
}: {
	readonly answered: boolean;
	readonly onDraft: (text: string) => void;
	readonly open: boolean;
	readonly preview: NonNullable<DocumentRequest["preview"]>;
	readonly request: DocumentRequest;
	readonly source: Document;
}) {
	if (!source.writable) {
		return open && !answered ? <AnswerOff document={source} request={request} /> : null;
	}
	if (!answered) {
		return open ? <AnswerForm document={source} onDraft={onDraft} preview={preview} request={request} /> : null;
	}
	return (
		<details className="group/change space-y-4" data-key="change-answer">
			<Button
				className="w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden"
				nativeButton={false}
				render={<summary />}
				size="sm"
				variant="outline"
			>
				<Pencil aria-hidden="true" />
				Change your answer
				<ChevronDown aria-hidden="true" className="transition-transform group-open/change:rotate-180" />
			</Button>
			<AnswerForm document={source} onDraft={onDraft} preview={preview} request={request} />
		</details>
	);
}
