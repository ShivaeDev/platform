import type { InboxProjection } from "#browser/views/schema.ts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#client/react/components/ui/card.tsx";
import { fileUrl } from "#files/url.ts";
import { keyed } from "./keyed.ts";
import { SOURCE_PROBLEMS_ID } from "./sourceProblems.ts";

type Issues = InboxProjection["issues"];

export function SystemSourceProblems({ issues, failed }: { readonly issues: Issues | undefined; readonly failed: boolean }) {
	return (
		<article aria-labelledby={`${SOURCE_PROBLEMS_ID}-title`} className="min-w-0 scroll-mt-4" id={SOURCE_PROBLEMS_ID}>
			<Card>
				<CardHeader>
					<CardTitle>
						<h2 className="text-lg" id={`${SOURCE_PROBLEMS_ID}-title`}>
							Source problems
						</h2>
					</CardTitle>
					<CardDescription>Workspace files the Board could not read in full. Open a file to fix it.</CardDescription>
				</CardHeader>
				<CardContent>
					<Problems failed={failed} issues={issues} />
				</CardContent>
			</Card>
		</article>
	);
}

function Problems({ issues, failed }: { readonly issues: Issues | undefined; readonly failed: boolean }) {
	if (issues === undefined) {
		return <p role="status">{failed ? "Source problems unavailable." : "Loading source problems…"}</p>;
	}
	if (issues.length === 0) {
		return <p className="text-muted-foreground text-sm">Every workspace file reads cleanly.</p>;
	}
	return (
		<ul className="m-0 list-none divide-y p-0">
			{keyed(issues, (issue) => `${issue.file}:${issue.line}:${issue.message}`).map(({ key, value: issue }) => (
				<li className="min-w-0 space-y-1 py-3 text-sm [overflow-wrap:anywhere]" data-source-problem={issue.file} key={key}>
					<p className="m-0">
						<a className="font-medium font-mono" href={fileUrl(issue.file)}>
							{issue.file}
						</a>{" "}
						<span className="text-muted-foreground text-xs">line {issue.line}</span>
					</p>
					<p className="m-0">{issue.message}</p>
				</li>
			))}
		</ul>
	);
}
