# Constraint failures at the application boundary

Use `mapSqlError` from `@shivaedev/sql/mapSqlError.ts` to map named unique, foreign-key and check violations to the owning application's errors. Every other SQL failure goes to the supplied fallback. The result type is the union of the mapped domain errors and the fallback, with no `SqlError` remaining.

```ts
import { mapSqlError } from "@shivaedev/sql/mapSqlError.ts";
import { transact } from "@shivaedev/sql/transact.ts";

const onSqlError = mapSqlError({
	constraints: {
		"orders_name_key": () => new NameTaken(),
		"orders_customer_fkey": () => new CustomerMissing(),
		"orders_total_check": () => new InvalidTotal(),
	},
	fallback: (error) => new ServiceUnavailable({ cause: error }),
});

const saved = save.pipe(transact({ onSqlError }));
```

The migration owns the constraint names; the application owns the error types and messages. Each callback receives the original `SqlError`. An unknown constraint, a violation without a recognized name, or any other SQL failure uses `fallback`. PostgreSQL supplies foreign-key and check constraint names through the native driver's cause; `UniqueViolation` supplies its constraint directly. PostgreSQL clips identifiers to 63 bytes at a character boundary, so declare the full name and the mapper matches the clipped name PostgreSQL reports. Other drivers may not identify constraints with the same precision.

For an Effect that fails with `SqlError`, including generic `Effect<A, SqlError, R>` code, use the same mapper with `Effect.mapError`:

```ts
const saved = sql.withTransaction(save).pipe(Effect.mapError(onSqlError));
```

`transact` also retains non-SQL typed failures from the operation. Prefer it for repository writes that announce changes. Do not expose raw driver errors to users or classify every database error as a field rejection.

Place recovery outside the transaction so a rejected write rolls back all prior writes in that operation. PostgreSQL marks a transaction failed after a statement error; catching that error inside the transaction does not restore the database transaction. A deliberate nested transaction/savepoint is a separate choice.

Two transactions that race to insert the same unique key can use the mapped domain error to read the winner after the losing transaction rolls back:

```ts
const getOrCreate = insertOrder.pipe(
	transact({ onSqlError }),
	Effect.catchTag("NameTaken", () => findOrderByName(name)),
);
```
