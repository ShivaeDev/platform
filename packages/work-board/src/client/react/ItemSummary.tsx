import { ClipboardList, FileText, Flag, MessageCircle, PanelsTopLeft } from "lucide-react";
import { useContext } from "react";
import type { Document } from "#browser/document/schema.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { StatusChip } from "#client/react/StatusChip.tsx";
import { Favorite } from "./Favorite.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { ItemId } from "./ItemId.tsx";
import { LinkButton } from "./LinkButton.tsx";
import { PrChip } from "./PrChip.tsx";
import { PrReferences } from "./PrReferences.tsx";

const icons = { board: PanelsTopLeft, goal: Flag, project: Flag, question: MessageCircle, report: FileText, result: FileText, task: ClipboardList };
function kindIcon(kind: string) {
	return Object.entries(icons).find(([name]) => name === kind)?.[1] ?? FileText;
}
function visibleIdentity(id: string | undefined): id is string {
	return Boolean(id) && !/[a-f\d]{64}/iu.test(id ?? "");
}
export function ItemSummary({ document }: { readonly document: Document }) {
	const fleet = useContext(FleetItemsContext);
	const fields = document.metadata;
	const item = fleet?.state === "ready" ? [...fleet.items, ...fleet.completed].find((entry) => entry.workId === document.identity) : undefined;
	const answering = fields.kind === "decision" || fields.kind === "question";
	const Icon = kindIcon(fields.kind ?? "document");
	return (
		<section aria-label="Item overview" className="item-summary space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<Icon aria-hidden="true" className="size-4" />
				<span>{fields.kind ?? "Document"}</span>
				<ItemStatus answering={answering} document={document} />
				{item !== undefined && <Badge variant="outline">Fleet · {item.stage}</Badge>}
				{item !== undefined && <PrChip url={item.prUrl} />}
				{visibleIdentity(fields.id) && (
					<ItemId href={document.identity ? `/_board/item/${encodeURIComponent(document.identity)}/` : undefined} id={fields.id} />
				)}
			</div>
			<ItemFields fields={fields} />
		</section>
	);
}

export function ItemActions({ document }: { readonly document: Document }) {
	const kind = document.metadata.kind ?? "";
	const identity = document.identity;
	return (
		<>
			<Favorite file={document.file} title={document.file} />
			{identity && !["question", "response", "handoff"].includes(kind) && (
				<LinkButton href={`/_board/handoff?item=${encodeURIComponent(identity)}`}>Prepare an agent handoff</LinkButton>
			)}
			{identity && kind === "board" && (
				<LinkButton href={`/_board/work?view=board&board=${encodeURIComponent(identity)}`}>View this board</LinkButton>
			)}
			{identity && kind === "result" && <LinkButton href={`/_board/result?item=${encodeURIComponent(identity)}`}>Review returned result</LinkButton>}
		</>
	);
}

function ItemFields({ fields }: { readonly fields: Document["metadata"] }) {
	if (!fields.id) {
		return null;
	}
	const owner = fields.owner;
	const next = fields.nextAction;
	if (!(owner || next)) {
		return null;
	}
	return (
		<p>
			{Boolean(owner) && <span>Owner: {owner}</span>}
			{Boolean(owner && next) && " · "}
			{next ? (
				<span>
					Next action: <PrReferences text={next} />
				</span>
			) : null}
		</p>
	);
}

function ItemStatus({ document, answering }: { readonly document: Document; readonly answering: boolean }) {
	const fields = document.metadata;
	const asks = document.requests.filter(
		(request) => request.open || (request.id === "answer" && request.sourceOpen && fields.kind === "question" && fields.question === undefined),
	);
	const requestState = asks.length > 0 ? askStatus(asks) : fields.status;
	return fields.id && (!answering || requestState !== undefined) ? <StatusChip status={answering ? requestState : fields.status} /> : null;
}

function askStatus(asks: Document["requests"]) {
	return asks.some((request) => request.answered === undefined) ? "needs-you" : "waiting-on-agents";
}
