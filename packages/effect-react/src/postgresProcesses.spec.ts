import { processes, twoServersAndWorker } from "#test/postgres-example/processKit.ts";

processes.it(
	"commits from two HTTP servers and a pg-boss worker wake both servers; rollback stays silent and listener loss resyncs",
	[twoServersAndWorker()],
	function* ({
		clientsStartWithResync,
		saveFromServer,
		saveFromWorker,
		rejectedWriteStaysSilent,
		loseListener,
		allLocalClientsResync,
		saveAfterReconnect,
	}) {
		yield* clientsStartWithResync();
		yield* saveFromServer("a", "server one");
		yield* saveFromServer("b", "server two");
		yield* saveFromWorker();
		yield* rejectedWriteStaysSilent();
		yield* loseListener();
		yield* allLocalClientsResync();
		yield* saveAfterReconnect();
	},
	30_000,
);
