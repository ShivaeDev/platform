import { useEffect, useRef, useState } from "react";
import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import { statusLabel } from "#browser/views/statusLabel.ts";
import type { ClosedDraft } from "./ClosedDraftCard.tsx";

interface Draft {
	readonly text: string;
	readonly title: string | undefined;
}

export function useClosedDrafts(data: Document) {
	const draftsRef = useRef(new Map<string, Draft>());
	const [closed, setClosed] = useState<readonly ClosedDraft[]>([]);
	useEffect(() => {
		const open = new Set(data.requests.filter((request) => request.open).map((request) => request.id));
		const gone = [...draftsRef.current].filter(([id]) => !open.has(id));
		for (const [id] of gone) {
			draftsRef.current.delete(id);
		}
		const written = gone.filter(([, draft]) => draft.text);
		setClosed((current) => {
			const kept = current.filter((entry) => !(open.has(entry.id) || written.some(([id]) => id === entry.id)));
			return kept.length === current.length && written.length === 0
				? current
				: [...kept, ...written.map(([id, draft]) => ({ ...draft, id, reason: closedReason(data, id) }))];
		});
	}, [data]);
	function record(request: DocumentRequest, text: string) {
		draftsRef.current.set(request.id, { text, title: request.title });
	}
	return { closed, record };
}

function closedReason(data: Document, id: string) {
	const attention = data.metadata.attention?.find((entry) => entry.id === id);
	if (attention && attention.state !== "open") {
		return `Its file now marks this request ${attention.state}.`;
	}
	if (id === "answer" && data.metadata.kind === "question" && data.metadata.status) {
		return `Its file now marks the question ${statusLabel(data.metadata.status).toLowerCase()}.`;
	}
	return "Its file no longer asks for an answer.";
}
