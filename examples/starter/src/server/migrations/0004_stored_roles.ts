import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql.unsafe(`do $auth_migration$
begin

alter table "user" alter column role set default 'user';
update "user" set role = 'user' where role is null;
alter table "user" alter column role set not null;
end;
$auth_migration$;`);
});
