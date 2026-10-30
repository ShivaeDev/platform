import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { database } from "#test/postgres/database.ts";
import { noServerTls } from "#test/postgres/traits.ts";

database.it(
	"a connection string without sslmode starts the runtime on connections without TLS",
	[noServerTls],
	function* ({ connectionsOf, startWithSslMode, startup }) {
		yield* startWithSslMode("plain", [], undefined);

		yield* outcomes({
			"connections": [connectionsOf("plain"), "all without TLS"],
			"startup": [startup("plain"), "started"],
		});
	},
);

database.it(
	"sslmode=require against a server without TLS fails to start with the server's TLS refusal and leaves no connection open",
	[noServerTls],
	function* ({ connectionsOf, startWithSslMode, startup }) {
		yield* startWithSslMode("secure", [], "require");

		yield* outcomes({
			"connections": [connectionsOf("secure"), "none"],
			"startup": [startup("secure"), "start failed with The server does not support SSL connections"],
		});
	},
);
