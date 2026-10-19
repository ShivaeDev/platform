import type { InboxProjection } from "#browser/views/schema.ts";
import { LoadingText } from "./loading.tsx";
import { SOURCE_PROBLEMS_ID, sourceProblemsSummary } from "./sourceProblems.ts";
import { todayIds } from "./todayIds.ts";

export function TodaySummary({
	needs,
	progress,
	progressFromFiles,
	progressUnavailable,
	goals,
	goalsFailed,
	issues,
}: {
	readonly needs: number | undefined;
	readonly progress: number | undefined;
	readonly progressFromFiles: boolean;
	readonly progressUnavailable: boolean;
	readonly goals: number | undefined;
	readonly goalsFailed: boolean;
	readonly issues: InboxProjection["issues"];
}) {
	return (
		<nav aria-label="Today summary" className="today-strip flex flex-wrap items-center gap-1 whitespace-nowrap tabular-nums sm:gap-2">
			<a href={`#${todayIds.needs}`}>{needs === undefined ? "Needs you unavailable" : `${needs} need you`}</a>
			<span aria-hidden="true">·</span>
			{progress === undefined && !progressUnavailable ? (
				<LoadingText label="Loading work in progress" />
			) : (
				<a href={`#${todayIds.progress}`}>{progressSummary(progress, progressFromFiles)}</a>
			)}
			<span aria-hidden="true">·</span>
			{goals === undefined && !goalsFailed ? <LoadingText label="Loading goals" /> : <a href={`#${todayIds.goals}`}>{goalsSummary(goals)}</a>}
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

function progressSummary(count: number | undefined, fromFiles: boolean) {
	if (count === undefined) {
		return "Fleet unavailable";
	}
	return fromFiles ? `${count} in progress in task files` : `${count} in progress`;
}

function goalsSummary(count: number | undefined) {
	return count === undefined ? "Goals unavailable" : `${count} active ${count === 1 ? "goal" : "goals"}`;
}
