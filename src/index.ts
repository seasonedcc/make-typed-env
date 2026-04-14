import type { StandardSchemaV1 } from "@standard-schema/spec";

/** Options for {@link makeTypedEnv}. */
interface Options<T, R> {
  /** Transform the parsed result before returning. The return type is inferred from this function. */
  transform?: (parsed: T) => R;
  /**
   * Cache the result by args reference identity.
   * When enabled, calling with the same object (e.g. `process.env`) skips re-validation.
   * A different object triggers a fresh validation and replaces the cache.
   * @default false
   */
  cache?: boolean;
}

/**
 * Infer the return type of a configured `makeTypedEnv` getter.
 *
 * @example
 * ```ts
 * const getEnv = makeTypedEnv(schema, { transform: camelKeys })
 * type Env = InferEnv<typeof getEnv>
 * // { databaseUrl: string; sessionSecret: string }
 * ```
 */
type InferEnv<T extends (args: Record<string, unknown>) => unknown> = ReturnType<T>;

/**
 * Create a type-safe environment variable getter from any
 * {@link https://standardschema.dev/ Standard Schema} compatible schema.
 *
 * @param schema - Any Standard Schema (Zod, Valibot, ArkType, etc.)
 * @param options - Optional transform and caching configuration
 * @returns A function that validates `args` and returns the (optionally transformed) result
 * @throws {Error} When validation fails, with a message listing all issues
 * @throws {TypeError} When an async schema is passed
 *
 * @example
 * ```ts
 * import { makeTypedEnv } from "make-typed-env"
 * import { camelKeys } from "string-ts"
 * import { z } from "zod"
 *
 * const getEnv = makeTypedEnv(
 *   z.object({
 *     DATABASE_URL: z.string(),
 *     SESSION_SECRET: z.string().min(1),
 *   }),
 *   { transform: camelKeys },
 * )
 *
 * const env = getEnv(process.env)
 * // env.databaseUrl   → string
 * // env.sessionSecret → string
 * ```
 */
function makeTypedEnv<T>(
  schema: StandardSchemaV1<unknown, T>,
  options?: { cache?: boolean },
): (args: Record<string, unknown>) => T;
function makeTypedEnv<T, R>(
  schema: StandardSchemaV1<unknown, T>,
  options: { transform: (parsed: NoInfer<T>) => R; cache?: boolean },
): (args: Record<string, unknown>) => R;
function makeTypedEnv<T, R>(schema: StandardSchemaV1<unknown, T>, options?: Options<T, R>) {
  const { transform, cache = false } = options ?? {};
  let cachedArgs: Record<string, unknown> | undefined;
  let cachedResult: T | R | undefined;

  return (args: Record<string, unknown>) => {
    if (cache && cachedArgs === args) return cachedResult as R;

    const result = schema["~standard"].validate(args);
    if (result instanceof Promise) {
      throw new TypeError("Async schemas are not supported");
    }
    if (result.issues) {
      const count = result.issues.length;
      const lines = result.issues.map((i) => {
        const name = i.path?.length ? i.path.map(String).join(".") : undefined;
        return name ? `  ✗ ${name}: ${i.message}` : `  ✗ ${i.message}`;
      });
      throw new Error(
        `\n\n` +
          `  Environment validation failed (${count} ${count === 1 ? "error" : "errors"}):\n\n` +
          `${lines.join("\n")}\n`,
      );
    }
    const value = transform ? transform(result.value) : result.value;
    if (cache) {
      cachedArgs = args;
      cachedResult = value;
    }
    return value;
  };
}

export { makeTypedEnv };
export type { InferEnv, Options };
