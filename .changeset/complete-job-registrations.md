---
"@shivaedev/jobs": minor
---

### Breaking

- Job registrations require complete queue definitions, queue workers or scheduled workers. Reusable collections retain service requirements in the jobs Layer instead of erasing them. Replace tag-only registrations with `defineQueue`, `.handle` or `.run` results. Replace broad `JobRegistration[]` annotations with `satisfies readonly JobRegistration[]` or `readonly JobRegistration<Services>[]`, naming the union of handler, payload-decoding and scheduled-effect services.
