import type { MergeQueueResult } from "#MergeQueueResult.ts";
import type { FleetRecord } from "#model.ts";

const STALLED_AFTER = 5 * 60_000;
type Window = NonNullable<FleetRecord["releaseWindow"]>;

export function observeReleaseWindow(previous: Window | undefined, status: MergeQueueResult, now: number): Window | undefined {
	if (typeof status === "string" || status.status !== "held") {
		return undefined;
	}
	const progress = status.releaseProgress ?? status.releasePr;
	const reason = status.releaseStuckReason;
	const unchanged = previous?.pr === status.releasePr && previous.progress === progress && previous.reason === reason;
	const since = unchanged ? (previous.since ?? now) : now;
	return {
		observedAt: now,
		pr: status.releasePr,
		progress,
		reason,
		since: reason === undefined ? undefined : since,
	};
}

export function releaseWindowAttention<A extends Pick<FleetRecord, "workId" | "blocker" | "releaseWindow"> & { readonly step: string }>(
	records: readonly A[],
): readonly A[] {
	const groups = new Map<string, A[]>();
	for (const record of records) {
		if (record.step === "waiting" && record.releaseWindow && record.blocker?.startsWith("Waiting for release PR #")) {
			const group = groups.get(record.releaseWindow.pr) ?? [];
			group.push(record);
			groups.set(record.releaseWindow.pr, group);
		}
	}
	const waits = new Map<string, string>();
	for (const [pr, group] of groups) {
		const latest = group
			.map((record) => record.releaseWindow)
			.filter((window) => window !== undefined)
			.sort((a, b) => b.observedAt - a.observedAt)[0];
		const leader = group.toSorted((a, b) => a.workId.localeCompare(b.workId))[0];
		const since = Math.min(
			...group.flatMap(({ releaseWindow }) =>
				releaseWindow?.progress === latest?.progress && releaseWindow?.reason === latest?.reason && releaseWindow?.since !== undefined
					? [releaseWindow.since]
					: [],
			),
		);
		if (leader && latest?.reason && latest.observedAt - since >= STALLED_AFTER) {
			waits.set(
				leader.workId,
				`Release PR #${pr.split("/").at(-1)} (${pr}) is stuck: ${latest.reason}; holds ${group.length} PR${group.length === 1 ? "" : "s"}`,
			);
		}
	}
	return records.map((record) => {
		const blocker = waits.get(record.workId);
		return blocker === undefined ? record : { ...record, attentionOwner: "orchestrator" as const, blocker };
	});
}
