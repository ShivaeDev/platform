import type { FleetView } from "#model.ts";

export function sessionStatus(session: (typeof FleetView.Type)["sessions"][number]): string {
	const times: readonly [string, number | undefined][] = [
		["last progress", session.lastProgressAt],
		["Fleet steer requested", session.steeredAt],
		["Fleet interrupt requested", session.interruptRequestedAt],
		["Fleet interrupt acknowledged", session.interruptedAt],
	];
	return [
		`session ${session.sessionId} turn ${session.turnId}`,
		...times.flatMap(([label, time]) => (time === undefined ? [] : [`${label} ${new Date(time).toISOString()}`])),
	].join("; ");
}
