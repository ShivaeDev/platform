import { ClipboardList, FileText, Flag, MessageCircle } from "lucide-react";
import { useContext, useState } from "react";
import type { Document } from "#browser/document/schema.ts";
import { kindLabel, statusLabel } from "#browser/views/statusLabel.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { StatusChip } from "#client/react/StatusChip.tsx";
import { Time } from "#client/react/Time.tsx";
import { ActionText } from "./ActionText.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { ItemId } from "./ItemId.tsx";
import { itemStatus } from "./itemStatus.ts";
import { PrChip } from "./PrChip.tsx";
import { AnswerJump, WaitingOn } from "./WaitingOn.tsx";

const icons = { goal: Flag, question: MessageCircle, report: FileText, task: ClipboardList };
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
	const status = itemStatus(document);
	const change = useStatusChange(document.file, status === undefined ? undefined : statusLabel(status));
	const Icon = kindIcon(fields.kind ?? "document");
	return (
		<section aria-label="Item overview" className="item-summary space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<Icon aria-hidden="true" className="size-4" />
				<span>{kindLabel(fields.kind ?? "document")}</span>
				<StatusChip status={status} />
				{fields.kind === "goal" && fields.standing ? <Badge variant="outline">Standing home</Badge> : null}
				{fields.kind === "question" && (
					<Badge variant="outline">
						{fields.scope} · {fields.urgency}
					</Badge>
				)}
				{item !== undefined && <Badge variant="outline">Fleet · {item.stage}</Badge>}
				{item !== undefined && <PrChip className="pointer-coarse:h-11 pointer-coarse:px-3" url={item.prUrl} />}
				{visibleIdentity(fields.id) && (
					<ItemId href={document.identity ? `/_board/item/${encodeURIComponent(document.identity)}/` : undefined} id={fields.id} />
				)}
				<span className="text-muted-foreground text-xs whitespace-nowrap" data-item-updated>
					updated <Time at={document.modified} />
				</span>
				<ItemGoals document={document} />
			</div>
			<div className="text-muted-foreground text-xs empty:sr-only" role="status">
				{change}
			</div>
			{item?.waitingReason !== undefined && (
				<p>
					Waiting on {item.attentionOwner === "maintainer" ? "you" : item.attentionOwner}: {item.waitingReason}
				</p>
			)}
			<WaitingOn asks={document.waitingOn ?? []} />
			<AnswerJump document={document} />
			<ItemFields document={document} />
		</section>
	);
}

function useStatusChange(file: string, label: string | undefined) {
	const [seen, setSeen] = useState({ change: "", file, label });
	if (seen.file !== file || seen.label !== label) {
		const change = seen.file === file && seen.label && label ? `Status changed: ${seen.label} → ${label}` : "";
		setSeen({ change, file, label });
	}
	return seen.change;
}

function ItemGoals({ document }: { readonly document: Document }) {
	const goals = new Map(
		(document.metadata.relationships ?? []).flatMap((link) => {
			const details = document.referenceDetails?.[link.target];
			const href = document.references[link.target]?.split("#")[0];
			return link.kind === "implements" && href && details && goalKind(details.kind) ? [[href, details.title] as const] : [];
		}),
	);
	return [...goals].map(([href, title]) => (
		<a
			className="text-muted-foreground hover:text-foreground inline-block max-w-full truncate text-sm underline underline-offset-4 pointer-coarse:min-h-11 pointer-coarse:leading-11"
			href={href}
			key={href}
		>
			Part of {title}
		</a>
	));
}

function goalKind(kind: string | undefined) {
	return kind === "goal";
}

function ItemFields({ document }: { readonly document: Document }) {
	const fields = document.metadata;
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
					Next action: <ActionText document={document} text={next} />
				</span>
			) : null}
		</p>
	);
}
