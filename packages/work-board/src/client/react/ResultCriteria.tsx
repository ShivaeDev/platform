import type { ReactNode } from "react";
import type { Document } from "#browser/document/schema.ts";
import type { ResultProjection } from "#browser/views/ResultProjection.ts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#client/react/components/ui/table.tsx";
import { ClaimCells } from "./ClaimCells.tsx";
import { keyed } from "./keyed.ts";
import { SectionCard } from "./SectionCard.tsx";
import { StatusChip } from "./StatusChip.tsx";
import { shellIds } from "./shellIds.ts";

type Target = ResultProjection["targets"][number];
type Criterion = Target["criteria"][number];

export function ResultCriteria({ data, targets }: { readonly data: ResultProjection; readonly targets: readonly Target[] }) {
	return (
		<SectionCard
			description="What the agent says it checked for each linked item. These are the agent's own claims: the Board doesn't verify them, can't tell whether they are still current, and doesn't compare revisions with your checkout. This result doesn't change the linked work's status."
			id={shellIds.resultCriteria}
			title="Checks and evidence"
		>
			{keyed(targets, (target) => target.link.label).map(({ key, value }) => (
				<TargetChecks document={data.document} key={key} target={value} />
			))}
		</SectionCard>
	);
}

function TargetChecks({ document, target }: { readonly document: Document; readonly target: Target }) {
	const title = document.referenceDetails?.[target.link.label]?.title ?? target.link.label;
	let body: ReactNode;
	if (!target.available) {
		body = <p className="m-0 text-muted-foreground">This item can't be read, so its checks aren't shown.</p>;
	} else if (target.criteria.length === 0) {
		body = <p className="m-0 text-muted-foreground">This item lists no checks.</p>;
	} else {
		body = (
			<Table aria-label={`Checks for ${title}`}>
				<TableHeader>
					<TableRow>
						<TableHead>Check</TableHead>
						<TableHead>Evidence</TableHead>
						<TableHead>Outcome</TableHead>
						<TableHead>Method</TableHead>
						<TableHead>Revision checked</TableHead>
						<TableHead>Observed</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{keyed(target.criteria, (entry) => entry.link.label).map(({ key, value }) => (
						<CriterionRows criterion={value} key={key} />
					))}
				</TableBody>
			</Table>
		);
	}
	return (
		<section aria-label={title} className="min-w-0 space-y-2">
			<div className="flex flex-wrap items-center gap-2">
				<a className="font-medium" href={target.link.href}>
					{title}
				</a>
				<StatusChip status={target.status} />
			</div>
			{body}
		</section>
	);
}

function CriterionRows({ criterion }: { readonly criterion: Criterion }) {
	const check = <CheckCell criterion={criterion} />;
	if (!criterion.link.href) {
		return (
			<TableRow>
				{check}
				<TableCell className="whitespace-normal text-muted-foreground" colSpan={5}>
					Another check has the same ID, so evidence can't be matched to this one.
				</TableCell>
			</TableRow>
		);
	}
	if (criterion.claims.length === 0) {
		return (
			<TableRow>
				{check}
				<TableCell className="whitespace-normal text-muted-foreground" colSpan={5}>
					No evidence recorded
				</TableCell>
			</TableRow>
		);
	}
	return keyed(criterion.claims, (entry) => entry.source.label).map(({ key, value, index }) => (
		<TableRow key={key}>
			{index === 0 ? check : <TableCell />}
			<ClaimCells claim={value} />
		</TableRow>
	));
}

function CheckCell({ criterion }: { readonly criterion: Criterion }) {
	return (
		<TableCell className="min-w-40 whitespace-normal">
			{criterion.link.href ? <a href={criterion.link.href}>{criterion.text}</a> : criterion.text}
		</TableCell>
	);
}
