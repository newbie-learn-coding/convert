import type { ParseOptions as StableParseOptions } from "./parse.js";
import { type ImplicitType, type SchemaType } from "./_schema.js";
import type { KindType, RepresentFn, Type } from "./_type.js";
export type { ImplicitType, KindType, RepresentFn, SchemaType, Type };
/** Options for {@linkcode parse}. */ export type ParseOptions = StableParseOptions & {
  /**
   * Extra types to be added to the schema.
   */ extraTypes?: ImplicitType[];
};
/**
 * Parse and return a YAML string as a parsed YAML document object.
 *
 * Note: This does not support functions. Untrusted data is safe to parse.
 *
 * @example Usage
 * ```ts
 * import { parse } from "@std/yaml/parse";
 * import { assertEquals } from "@std/assert";
 *
 * const data = parse(`
 * id: 1
 * name: Alice
 * `);
 *
 * assertEquals(data, { id: 1, name: "Alice" });
 * ```
 *
 * @throws {SyntaxError} Throws error on invalid YAML.
 * @param content YAML string to parse.
 * @param options Parsing options.
 * @returns Parsed document.
 */ export declare function parse(content: string, options?: ParseOptions): unknown;
/**
 * Same as {@linkcode parse}, but understands multi-document YAML sources, and
 * returns multiple parsed YAML document objects.
 *
 * @example Usage
 * ```ts
 * import { parseAll } from "@std/yaml/parse";
 * import { assertEquals } from "@std/assert";
 *
 * const data = parseAll(`
 * ---
 * id: 1
 * name: Alice
 * ---
 * id: 2
 * name: Bob
 * ---
 * id: 3
 * name: Eve
 * `);
 * assertEquals(data, [ { id: 1, name: "Alice" }, { id: 2, name: "Bob" }, { id: 3, name: "Eve" }]);
 * ```
 *
 * @param content YAML string to parse.
 * @param options Parsing options.
 * @returns Array of parsed documents.
 */ export declare function parseAll(content: string, options?: ParseOptions): unknown;
//# sourceMappingURL=unstable_parse.d.ts.map