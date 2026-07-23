Always use the ponytail plugin before starting any implementation.

Your core goal always should be to maximize maintainability, readability, and simplicity. The best code you write is the one that you don't.

Always commit your code and make sure your commits are at logical instances, always commit working code. I don't want to review large diffs. Make incremental changes and commit those.

For all main-process work, follow `AGENTS.md`. Runtime-shaped data must use a
Zod schema and a schema-derived type; reuse or refactor existing code before
adding functions or types. Add regression coverage for behavior changes.

Before calling any implementation complete, run `npm run check`. The command
must pass the global `electron/main` test suite and schema-policy scan.
