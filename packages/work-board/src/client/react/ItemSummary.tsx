import { ClipboardList, FileText, Flag, GitPullRequest, MessageCircle, PanelsTopLeft } from "lucide-react";
import { useContext } from "react";
import type { Document } from "#browser/document/schema.ts";
import { Badge } from "#client/react/components/ui/Badge.tsx";
import { StatusChip } from "#client/react/components/ui/StatusChip.tsx";
import { Favorite } from "./Favorite.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";

const icons = { board: PanelsTopLeft, goal: Flag, question: MessageCircle, report: FileText, result: FileText, task: ClipboardList };
function kindIcon(kind: string) {
	return Object.entries(icons).find(([name]) => name === kind)?.[1] ?? FileText;
}
function visibleIdentity(id: string | undefined) {
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
				{visibleIdentity(fields.id) && (
					<a className="font-mono text-xs" href={document.identity ? `/_board/item/${encodeURIComponent(document.identity)}/` : undefined}>
						{fields.id}
					</a>
				)}
				<ItemStatus answering={answering} document={document} />
				{item !== undefined && <Badge variant="outline">Fleet · {item.stage}</Badge>}
				{item !== undefined && <PrChip url={item.prUrl} />}
			</div>
			<ItemFields answering={answering} fields={fields} />
			<div className="flex flex-wrap items-center gap-3 text-sm">
				<Favorite file={document.file} title={document.file} />
				{document.identity && !["question", "response", "handoff"].includes(fields.kind ?? "") && (
					<a href={`/_board/handoff?item=${encodeURIComponent(document.identity)}`}>Prepare an agent handoff</a>
				)}
				{document.identity && fields.kind === "board" && (
					<a href={`/_board/work?view=board&board=${encodeURIComponent(document.identity)}`}>View this board</a>
				)}
				{document.identity && fields.kind === "result" && (
					<a href={`/_board/result?item=${encodeURIComponent(document.identity)}`}>Review returned result</a>
				)}
			</div>
		</section>
	);
}

function PrChip({ url }: { readonly url: string | undefined }) {
	return url ? (
		<a href={url}>
			<Badge variant="outline">
				<GitPullRequest aria-hidden="true" />
				PR
			</Badge>
		</a>
	) : (
		<Badge variant="outline">PR not recorded</Badge>
	);
}

function ItemFields({ fields, answering }: { readonly fields: Document["metadata"]; readonly answering: boolean }) {
	if (!fields.id) {
		return null;
	}
	const owner = fields.owner ?? (answering ? undefined : "Not recorded");
	const next = fields.nextAction ?? (answering ? undefined : "Not recorded");
	if (!(owner || next)) {
		return null;
	}
	return (
		<p>
			{Boolean(owner) && <span>Owner: {owner}</span>}
			{Boolean(owner && next) && " · "}
			{Boolean(next) && <span>Next action: {next}</span>}
		</p>
	);
}

function ItemStatus({ document, answering }: { readonly document: Document; readonly answering: boolean }) {
	const fields = document.metadata;
	const requestState = document.requests.some((request) => request.open || request.sourceOpen) ? "needs-you" : fields.status;
	return fields.id && (!answering || requestState !== undefined) ? <StatusChip status={answering ? requestState : fields.status} /> : null;
}
