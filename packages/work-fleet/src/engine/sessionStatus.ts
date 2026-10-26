import type { FleetView } from "#model.ts";

export function sessionStatus(session: (typeof FleetView.Type)["sessions"][number]): string {
	return [
		`session ${session.sessionId} turn ${session.turnId}`,
		...(session.lastProgressAt === undefined ? [] : [`last progress ${new Date(session.lastProgressAt).toISOString()}`]),
		...(session.briefSteers ?? []).map((steer) =>
			steer.steeredAt === undefined
				? `brief edit steer requested ${new Date(steer.requestedAt).toISOString()}; ${steer.error === undefined ? "delivery unconfirmed" : `failed: ${steer.error}`}`
				: `brief edit steered ${new Date(steer.steeredAt).toISOString()}`,
		),
	].join("; ");
}
