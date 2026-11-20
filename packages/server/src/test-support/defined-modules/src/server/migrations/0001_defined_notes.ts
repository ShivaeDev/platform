import { SqlClient } from "effect/sql";

export default SqlClient.SqlClient.use((sql) => sql`create table defined_notes (id serial primary key, title text not null)`);
