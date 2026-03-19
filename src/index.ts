import type { StandardSchemaV1 } from "@standard-schema/spec";

interface Options<T, R> {
  transform?: (parsed: T) => R;
  cache?: boolean;
}

function makeTypedEnv<T>(
  schema: StandardSchemaV1<unknown, T>,
  options?: Options<T, never>,
): (args: Record<string, unknown>) => T;
function makeTypedEnv<T, R>(
  schema: StandardSchemaV1<unknown, T>,
  options: Options<T, R> & { transform: (parsed: T) => R },
): (args: Record<string, unknown>) => R;
function makeTypedEnv<T, R>(schema: StandardSchemaV1<unknown, T>, options?: Options<T, R>) {
  const { transform, cache = false } = options ?? {};
  let cachedArgs: Record<string, unknown> | undefined;
  let cachedResult: T | R | undefined;

  return (args: Record<string, unknown>) => {
    if (cache && cachedArgs === args) return cachedResult!;

    const result = schema["~standard"].validate(args);
    if (result instanceof Promise) {
      throw new TypeError("Async schemas are not supported");
    }
    if (result.issues) {
      throw new Error(
        `Environment validation failed:\n${result.issues.map((i) => `  - ${i.message}`).join("\n")}`,
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
export type { Options };
