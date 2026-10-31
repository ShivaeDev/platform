import { Sessions } from "#sessions.ts";
import { listSessions, revokeSession } from "./sessionAdministration.ts";

export const sessionsHandlers = Sessions.application.toLayer({
	"identity.sessions.list": listSessions,
	"identity.sessions.revoke": ({ id }) => revokeSession(id),
});
