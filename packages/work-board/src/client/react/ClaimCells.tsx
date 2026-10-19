import { TriangleAlert } from "lucide-react";
import type { ResultProjection } from "#browser/views/ResultProjection.ts";
import { TableCell } from "#client/react/components/ui/table.tsx";
import { Version } from "./Version.tsx";

type Claim = ResultProjection["targets"][number]["criteria"][number]["claims"][number];

export function ClaimCells({ claim }: { readonly claim: Claim }) {
	return (
		<>
			<TableCell className="min-w-32 whitespace-normal">
				<a href={claim.source.href}>{claim.source.label}</a>
				<EvidenceProblem problem={claim.problem} />
			</TableCell>
			<Reported value={claim.outcome} />
			<Reported value={claim.method} />
			{claim.checkedRevision ? (
				<TableCell>
					<Version kind="Git revision" revision={claim.checkedRevision} />
				</TableCell>
			) : (
				<NotRecorded />
			)}
			<Reported value={claim.observedAt} />
		</>
	);
}

function Reported({ value }: { readonly value: string | undefined }) {
	return value ? <TableCell className="whitespace-normal">{value}</TableCell> : <NotRecorded />;
}

function NotRecorded() {
	return <TableCell className="text-muted-foreground">Not recorded</TableCell>;
}

const evidenceProblems: Readonly<Record<string, string>> = {
	" (missing Markdown source)": "File not found",
	" (source unavailable)": "File can't be read",
};

function EvidenceProblem({ problem }: { readonly problem: string }) {
	if (!problem) {
		return null;
	}
	return (
		<span className="mt-1 flex items-center gap-1 text-muted-foreground" data-evidence-problem>
			<TriangleAlert aria-hidden="true" className="size-3 shrink-0 text-needs-you" />
			{evidenceProblems[problem] ?? problem.trim()}
		</span>
	);
}
