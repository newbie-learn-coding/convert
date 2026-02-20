import type { FileFormat, FileData, ConvertPathNode, FormatHandler } from "./FormatHandler.js";
import type { TraversionGraph } from "./TraversionGraph.js";

declare global {
  interface Window {
    /**
     * Cache of supported formats per handler.
     * Maps handler name to array of supported FileFormat objects.
     */
    supportedFormatCache: Map<string, FileFormat[]>;

    /**
     * Global instance of the traversion graph for finding conversion paths.
     */
    traversionGraph: TraversionGraph;

    /**
     * Prints the current format cache as a JSON string for debugging.
     */
    printSupportedFormatCache: () => string;

    /**
     * Shows a modal popup with the given HTML content.
     * @param html - HTML content to display in the popup.
     */
    showPopup: (html: string) => void;

    /**
     * Hides the currently visible modal popup.
     */
    hidePopup: () => void;

    /**
     * Attempts to convert files by traversing the conversion graph.
     * @param files - Array of input files to convert.
     * @param from - Source format node.
     * @param to - Target format node.
     * @returns Promise resolving to converted files and path, or null if no path found.
     */
    tryConvertByTraversing: (
      files: FileData[],
      from: ConvertPathNode,
      to: ConvertPathNode
    ) => Promise<{
      files: FileData[];
      path: ConvertPathNode[];
    } | null>;

    /**
     * Application version from build environment.
     */
    APP_VERSION?: string;

    /**
     * Access to the logger instance for debugging.
     */
    __logger?: {
      getMetrics: () => {
        conversionsAttempted: number;
        conversionsSucceeded: number;
        conversionsFailed: number;
        handlersInitialized: number;
        handlersFailed: number;
        wasmLoadsFailed: number;
        userInteractions: number;
        userInteractionErrors: number;
      };
      getSessionId: () => string;
      flush: () => Promise<void>;
    };
  }

  /**
   * Type definition for the conversion result.
   */
  type ConversionResult = {
    files: FileData[];
    path: ConvertPathNode[];
  };

  /**
   * Type for conversion options.
   */
  type ConversionOptions = {
    inputFormat: FileFormat;
    outputFormat: FileFormat;
    handler: FormatHandler;
  };
}

/**
 * Vite-specific module declarations for binary and CSS imports.
 */
declare module "*?url" {
  const src: string;
  export default src;
}

declare module "./batToExe/exe65824head.bin?url" {
  const src: string;
  export default src;
}

declare module "./batToExe/exe65824foot.bin?url" {
  const src: string;
  export default src;
}

declare module "./handlers/batToExe/exe65824head.bin?url" {
  const src: string;
  export default src;
}

declare module "./handlers/batToExe/exe65824foot.bin?url" {
  const src: string;
  export default src;
}

declare module "*/exe65824head.bin?url" {
  const src: string;
  export default src;
}

declare module "*/exe65824foot.bin?url" {
  const src: string;
  export default src;
}

declare module "*.bin" {
  const content: ArrayBuffer;
  export default content;
}

declare module "*.css" {
  const content: string;
  export default content;
}

declare module "*.css?inline" {
  const content: string;
  export default content;
}

/**
 * Ensure this file is treated as a module.
 */
export { };
