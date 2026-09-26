# Constraint failures at the application boundary

Effect SQL already gives us a useful vocabulary. In the pinned rc.112 release,
`SqlError.reason` distinguishes `UniqueViolation`, `ConstraintError`, transaction
conflicts and other categories. `UniqueViolation.constraint` identifies the
violated constraint. We do not need a second framework-wide SQL error hierarchy.

Map a known constraint to a domain error at the owning operation:

```ts
sql.withTransaction(save).pipe(
  Effect.catchTag("SqlError", (error): Effect.Effect<never, NameTaken | SqlError> =>
    error.reason._tag === "UniqueViolation" &&
    error.reason.constraint === "orders_name_key"
      ? Effect.fail(new NameTaken())
      : Effect.fail(error),
  ),
)
```

The constraint name belongs to the application's migration and operation. The
public RPC contract can expose `NameTaken`; the UI owns its message. Do not expose
raw driver errors to users or classify every database error as a field rejection.

Place recovery outside the transaction so a rejected write rolls back all prior
writes in that operation. PostgreSQL marks a transaction failed after a statement
error; catching that error inside the transaction does not restore the database
transaction. A deliberate nested transaction/savepoint is a separate choice.

[The PostgreSQL test](../../packages/effect-sql/test/postgres-constraints.test.ts)
checks a duplicate after an earlier insert, verifies rollback through repository
reads, and verifies an unrelated check violation retains its native SQL error.
Constraint names and reason precision are driver-specific: this proof does not
promise that SQLite and PostgreSQL identify every constraint identically.
