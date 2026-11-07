import { listSessions, revokeSession } from "#server/better-auth/sessionAdministration.ts";
import { Sessions } from "#sessions.ts";

export const sessionsHandlers = Sessions.application.toLayer({
	"identity.sessions.list": listSessions,
	"identity.sessions.revoke": ({ id }) => revokeSession(id),
});
