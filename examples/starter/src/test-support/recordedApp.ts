import type { AppConnection, ClientApp } from "@shivaedev/react/client/app.ts";

// The app connects inside the session boundary, so a kit learns of each session's connection, and its activity, as it is made.
export function recordedApp(app: ClientApp, record: (connection: AppConnection) => void): ClientApp {
	return {
		...app,
		connect: (session, registry) => {
			const connection = app.connect(session, registry);
			record(connection);
			return connection;
		},
	};
}
