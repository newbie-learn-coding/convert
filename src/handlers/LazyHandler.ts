import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

/**
 * Wraps a handler behind a dynamic import so its dependencies are only
 * fetched when the user actually needs that conversion path.
 */
export function lazyHandler(
  meta: {
    name: string;
    supportedFormats: FileFormat[];
    supportAnyInput?: boolean;
  },
  loader: () => Promise<{ default: new () => FormatHandler }>,
): FormatHandler {
  let instance: FormatHandler | null = null;

  return {
    name: meta.name,
    supportedFormats: meta.supportedFormats,
    supportAnyInput: meta.supportAnyInput,
    ready: false,

    async init() {
      if (!instance) {
        const mod = await loader();
        instance = new mod.default();
      }
      await instance.init();
      this.ready = instance.ready;
      if (instance.supportedFormats) {
        this.supportedFormats = instance.supportedFormats;
      }
    },

    async doConvert(
      inputFiles: FileData[],
      inputFormat: FileFormat,
      outputFormat: FileFormat,
      args?: string[],
    ): Promise<FileData[]> {
      if (!instance) {
        await this.init();
      }
      return instance!.doConvert(inputFiles, inputFormat, outputFormat, args);
    },
  };
}
