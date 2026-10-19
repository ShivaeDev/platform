import { Option } from "effect";
import { useEffect, useRef } from "react";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { inProgress } from "#browser/views/inProgress.ts";
import type { InboxProjection } from "#browser/views/schema.ts";
import { fileUrl } from "#files/url.ts";
import { LinkButton } from "./LinkButton.tsx";
import { LoadingCards } from "./loading.tsx";
import { PageHeader } from "./PageHeader.tsx";
import { navigationQuery, routeQueryOptions } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";
import { TodayGoals } from "./TodayGoals.tsx";
import { TodayAnswered, TodayLater } from "./TodayNeeds.tsx";
import { TodayNeedsYou } from "./TodayNeedsYou.tsx";
import { TodayProgress } from "./TodayProgress.tsx";
import { TodaySummary } from "./TodaySummary.tsx";
import { todayIds } from "./todayIds.ts";
import { useSavedAnswers } from "./useSavedAnswers.ts";

export function TodayPage({ api, data }: { readonly api: ShellApi; readonly data: InboxProjection }) {
	const query = useQuery(api.goals.query(undefined, routeQueryOptions), { keepPreviousData: true });
	const goals = Option.getOrUndefined(query.data);
	const fleetQuery = useQuery(api.fleetItems.query(undefined, routeQueryOptions), { keepPreviousData: true });
	const fleet = Option.getOrUndefined(fleetQuery.data);
	const progress = inProgress(fleet);
	const navigation = useQuery(navigationQuery(api), { keepPreviousData: true });
	const home = Option.getOrUndefined(navigation.data)?.home;
	const answering = useSavedAnswers(data.you);
	useArrivalFocus(data.answered);
	return (
		<div className="today-page min-w-0 space-y-3 md:space-y-6">
			<PageHeader
				actions={home !== undefined && <LinkButton href={fileUrl(home.file)}>Workspace notes</LinkButton>}
				summary={
					<TodaySummary
						goals={goals?.goals.length}
						goalsFailed={Option.isSome(query.cause)}
						issues={data.issues}
						needs={data.complete ? answering.items.length : undefined}
						progress={progress?.rows.length}
						progressFromFiles={progress?.source === "files"}
						progressUnavailable={fleet?.state === "unavailable" || Option.isSome(fleetQuery.cause)}
					/>
				}
				title="Today"
			/>
			<div className="today-grid grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<div className="min-w-0 space-y-6">
					<TodayNeedsYou answering={answering} api={api} complete={data.complete} />
					{data.complete && data.answered.length > 0 && (
						<Answered fleet={Option.isSome(fleetQuery.cause) ? undefined : fleet} items={data.answered} />
					)}
					<section className="min-w-0" id={todayIds.progress}>
						<h2 className="mt-0 mb-3 font-semibold text-lg">In progress</h2>
						<TodayProgress data={fleet} failed={Option.isSome(fleetQuery.cause)} />
					</section>
					{data.complete && data.later.length > 0 && <Later items={data.later} />}
				</div>
				<section className="min-w-0" id={todayIds.goals}>
					<h2 className="mt-0 mb-3 font-semibold text-lg">Goals</h2>
					{goals ? <TodayGoals data={goals} /> : null}
					{goals === undefined && Option.isSome(query.cause) ? <p role="status">Goals unavailable.</p> : null}
					{goals === undefined && Option.isNone(query.cause) ? <LoadingCards cards={2} columns={1} label="Loading goals" /> : null}
					{goals && Option.isSome(query.cause) && <p role="status">Goal refresh failed. Displayed goals are retained.</p>}
				</section>
			</div>
		</div>
	);
}

function Answered({ fleet, items }: { readonly fleet: FleetItemsProjection | undefined; readonly items: InboxProjection["answered"] }) {
	return (
		<section className="min-w-0" id={todayIds.answered}>
			<h2 className="mt-0 mb-3 font-semibold text-lg">Answered, waiting for Fleet</h2>
			<TodayAnswered fleet={fleet} items={items} />
		</section>
	);
}

function useArrivalFocus(items: InboxProjection["answered"]) {
	const seenRef = useRef(new Set(items.map((item) => item.id)));
	useEffect(() => {
		const arrived = items.find((item) => !seenRef.current.has(item.id));
		seenRef.current = new Set(items.map((item) => item.id));
		const resting =
			document.activeElement === null || document.activeElement === document.body || document.activeElement.id === todayIds.needsHeading;
		if (arrived !== undefined && resting) {
			const row = [...document.querySelectorAll<HTMLElement>("[data-answered-id]")].find((element) => element.dataset.answeredId === arrived.id);
			row?.querySelector("a")?.focus();
		}
	}, [items]);
}

function Later({ items }: { readonly items: InboxProjection["later"] }) {
	return (
		<section className="min-w-0" id={todayIds.later}>
			<details>
				<summary className="mb-3 cursor-pointer">
					<h2 className="m-0 inline font-semibold text-lg">Later</h2>
					<span className="ml-2 text-muted-foreground text-sm tabular-nums">{items.length}</span>
				</summary>
				<TodayLater items={items} />
			</details>
		</section>
	);
}
