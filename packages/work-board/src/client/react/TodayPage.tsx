import { Option } from "effect";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import type { InboxProjection } from "#browser/views/schema.ts";
import { navigationQuery, routeQueryOptions } from "#client/page/routeQuery.ts";
import { fileUrl } from "#files/url.ts";
import { inProgressItems } from "./inProgressItems.ts";
import type { ShellApi } from "./ShellApi.ts";
import { TodayGoals } from "./TodayGoals.tsx";
import { TodayNeeds } from "./TodayNeeds.tsx";
import { TodayProgress } from "./TodayProgress.tsx";

const todayIds = { goals: "today-goals", needs: "needs-you", progress: "in-progress" };

export function TodayPage({ api, data }: { readonly api: ShellApi; readonly data: InboxProjection }) {
	const query = useQuery(api.goals.query(undefined, routeQueryOptions), { keepPreviousData: true });
	const goals = Option.getOrUndefined(query.data);
	const fleetQuery = useQuery(api.fleetItems.query(undefined, routeQueryOptions), { keepPreviousData: true });
	const fleet = Option.getOrUndefined(fleetQuery.data);
	const progress = inProgressItems(fleet);
	const navigation = useQuery(navigationQuery(api), { keepPreviousData: true });
	const home = Option.getOrUndefined(navigation.data)?.home;
	return (
		<div className="today-page min-w-0 space-y-3 md:space-y-6">
			<header className="flex items-center justify-between gap-3">
				<h1 className="m-0 font-semibold text-2xl">Today</h1>
				{home !== undefined && (
					<a className="text-sm" href={fileUrl(home.file)}>
						Workspace notes
					</a>
				)}
			</header>
			<nav aria-label="Today summary" className="today-strip flex items-center gap-1 whitespace-nowrap text-xs tabular-nums sm:gap-2 sm:text-sm">
				<a href={`#${todayIds.needs}`}>{data.complete ? data.you.length : "?"} need you</a>
				<span aria-hidden="true">·</span>
				<a href={`#${todayIds.progress}`}>{progress?.length ?? "?"} in progress</a>
				<span aria-hidden="true">·</span>
				<a href={`#${todayIds.goals}`}>{goals?.goals.length ?? "?"} active goals</a>
			</nav>
			<div className="today-grid grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<section className="min-w-0" id={todayIds.needs}>
					<h2 className="mt-0 mb-3 font-semibold text-lg">Needs you</h2>
					<TodayNeeds api={api} data={data} />
					{data.complete && data.you.length === 0 && (
						<a className="text-sm" href="/_board/start">
							Getting started
						</a>
					)}
				</section>
				<section className="min-w-0 xl:col-start-1" id={todayIds.progress}>
					<h2 className="mt-0 mb-3 font-semibold text-lg">In progress</h2>
					<TodayProgress data={fleet} failed={Option.isSome(fleetQuery.cause)} />
				</section>
				<section className="min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1" id={todayIds.goals}>
					<h2 className="mt-0 mb-3 font-semibold text-lg">Goals</h2>
					{goals ? <TodayGoals data={goals} /> : <p role="status">{Option.isSome(query.cause) ? "Goals unavailable." : "Loading goals…"}</p>}
					{goals && Option.isSome(query.cause) && <p role="status">Goal refresh failed. Displayed goals are retained.</p>}
				</section>
			</div>
		</div>
	);
}
