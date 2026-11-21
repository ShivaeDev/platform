---
"@shivaedev/vitest-rerun": minor
---

### Breaking

- Tests run through `vitest-rerun` with `NODE_ENV` unset now see `NODE_ENV=test`, as under `vitest run`. Before, `createVitest` left it unset and Vite set it to `development`, so a CI run through `vitest-rerun` tested development behaviour that a local `vitest run` did not, such as a host's development trace store. A value the caller sets is kept. A test that needs development behaviour sets `NODE_ENV=development` itself, for example in the Vitest project's `test.env` or in the environment its kit gives the process under test.
