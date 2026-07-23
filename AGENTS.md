# Implementation rules

## Main-process schema policy

The global main-process suite is `npm run test:main`. It discovers every
`*.test.ts` and `*.test.tsx` under `electron/main`; its schema-policy regression
also scans every production TypeScript file in that tree.

- Reuse an existing Zod schema before introducing a type that describes runtime
  data.
- Data from IPC, files, JSON, network calls, tools, model output, or
  string/regex parsing must have a Zod schema. Parse it at the boundary and
  derive its TypeScript type with `z.infer`, `z.input`, or `z.output`.
- Purely compile-time object types, such as callback registries or generic type
  maps, may use `// @compile-time-only: <specific reason>`. Do not use that
  marker for data that exists at runtime.
- Search for existing functions, schemas, and types before adding new ones.
  Prefer extending or refactoring the existing path over parallel helpers,
  duplicate types, wrappers, or speculative abstractions.
- Preserve existing behavior and add the smallest regression test to the
  nearest main-process `*.test.ts` file.

Before calling an implementation complete, run `npm run check`. Do not finish
with failing type checks, main-process tests, or schema-policy violations.
