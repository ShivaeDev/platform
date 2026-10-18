import type { InboxProjection } from "#browser/views/schema.ts";
import { SOURCE_PROBLEMS_ID, sourceProblemsSummary } from "./sourceProblems.ts";
import { todayIds } from "./todayIds.ts";

export function TodaySummary({
	needs,
	progress,
	progressUnavailable,
	goals,
	goalsFailed,
	issues,
}: {
	readonly needs: number | undefined;
	readonly progress: number | undefined;
	readonly progressUnavailable: boolean;
	readonly goals: number | undefined;
	readonly goalsFailed: boolean;
	readonly issues: InboxProjection["issues"];
}) {
	return (
		<nav aria-label="Today summary" className="today-strip flex flex-wrap items-center gap-1 whitespace-nowrap tabular-nums sm:gap-2">
			<a href={`#${todayIds.needs}`}>{needs === undefined ? "Needs you unavailable" : `${needs} need you`}</a>
			<span aria-hidden="true">·</span>
			<a href={`#${todayIds.progress}`}>{progressSummary(progress, progressUnavailable)}</a>
			<span aria-hidden="true">·</span>
			<a href={`#${todayIds.goals}`}>{goalsSummary(goals, goalsFailed)}</a>
			{issues.length > 0 && (
				<>
					<span aria-hidden="true">·</span>
					<a className="text-needs-you" data-source-problems href={`/_board/system#${SOURCE_PROBLEMS_ID}`}>
						{sourceProblemsSummary(issues)}
					</a>
				</>
			)}
		</nav>
	);
}

function progressSummary(count: number | undefined, unavailable: boolean) {
	if (count !== undefined) {
		return `${count} in progress`;
	}
	return unavailable ? "Fleet unavailable" : "Loading Fleet…";
}

function goalsSummary(count: number | undefined, failed: boolean) {
	if (count !== undefined) {
		return `${count} active goals`;
	}
	return failed ? "Goals unavailable" : "Loading goals…";
}
