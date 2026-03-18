import type { StandardSchemaV1 } from "@standard-schema/spec";

function makeTypedEnv<T>(
  schema: StandardSchemaV1<unknown, T>,
): (args: Record<string, unknown>) => T;
function makeTypedEnv<T, R>(
  schema: StandardSchemaV1<unknown, T>,
  transform: (parsed: T) => R,
): (args: Record<string, unknown>) => R;
function makeTypedEnv<T, R>(schema: StandardSchemaV1<unknown, T>, transform?: (parsed: T) => R) {
  return (args: Record<string, unknown>) => {
    const result = schema["~standard"].validate(args);
    if (result instanceof Promise) {
      throw new TypeError("Async schemas are not supported");
    }
    if (result.issues) {
      throw new Error(
        `Environment validation failed:\n${result.issues.map((i) => `  - ${i.message}`).join("\n")}`,
      );
    }
    return transform ? transform(result.value) : result.value;
  };
}

export { makeTypedEnv };
