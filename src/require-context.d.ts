/** webpack's require.context, used by src/scenes.ts to auto-discover scene JSON. */
declare function require(path: string): unknown;
declare namespace require {
  function context(
    directory: string,
    useSubdirectories?: boolean,
    regExp?: RegExp,
  ): {
    keys(): string[];
    (id: string): unknown;
  };
}
