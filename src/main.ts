import type { FileFormat, FileData, FormatHandler, ConvertPathNode } from "./FormatHandler.js";
import normalizeMimeType from "./normalizeMimeType.js";
import handlers from "./handlers";
import { TraversionGraph } from "./TraversionGraph.js";

/** Files currently selected for conversion */
let selectedFiles: File[] = [];
/**
 * Whether to use "simple" mode.
 * - In **simple** mode, the input/output lists are grouped by file format.
 * - In **advanced** mode, these lists are grouped by format handlers, which
 *   requires the user to manually select the tool that processes the output.
 */
let simpleMode = true;

const MAX_UPLOAD_FILES = 100;
const MAX_SINGLE_FILE_SIZE = 256 * 1024 * 1024; // 256 MB
const MAX_TOTAL_FILE_SIZE = 512 * 1024 * 1024; // 512 MB

const ui = {
  fileInput: document.querySelector("#file-input") as HTMLInputElement,
  fileSelectArea: document.querySelector("#file-area") as HTMLDivElement,
  convertButton: document.querySelector("#convert-button") as HTMLButtonElement,
  convertHelperText: document.querySelector("#convert-helper") as HTMLParagraphElement,
  modeToggleButton: document.querySelector("#mode-button") as HTMLButtonElement,
  inputList: document.querySelector("#from-list") as HTMLDivElement,
  outputList: document.querySelector("#to-list") as HTMLDivElement,
  inputSearch: document.querySelector("#search-from") as HTMLInputElement,
  outputSearch: document.querySelector("#search-to") as HTMLInputElement,
  popupBox: document.querySelector("#popup") as HTMLDivElement,
  popupBackground: document.querySelector("#popup-bg") as HTMLDivElement
};

const POPUP_TONE_CLASSES = ["popup-error", "popup-success", "popup-busy"];
const persistentDownloadUrls: string[] = [];

const allOptions: Array<{ format: FileFormat, handler: FormatHandler }> = [];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanFormatName(name: string): string {
  return name
    .split("(").join(")").split(")")
    .filter((_, index) => index % 2 === 0)
    .filter(part => part !== "")
    .join(" ")
    .trim();
}

function formatOptionExtension(format: FileFormat): string {
  const extension = (format.extension || format.format).replace(/^\./, "").toUpperCase();
  return `.${extension}`;
}

function releasePersistentDownloadUrls(): void {
  while (persistentDownloadUrls.length > 0) {
    const url = persistentDownloadUrls.pop();
    if (url) URL.revokeObjectURL(url);
  }
}

window.addEventListener("beforeunload", releasePersistentDownloadUrls);

function validateSelectedFiles(files: File[]): string | null {
  if (files.length > MAX_UPLOAD_FILES) {
    return `You selected ${files.length} files. Limit is ${MAX_UPLOAD_FILES} files per conversion.`;
  }

  const tooLargeFile = files.find(file => file.size > MAX_SINGLE_FILE_SIZE);
  if (tooLargeFile) {
    return `File "${tooLargeFile.name}" is ${formatBytes(tooLargeFile.size)}. ` +
      `Maximum single file size is ${formatBytes(MAX_SINGLE_FILE_SIZE)}.`;
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_FILE_SIZE) {
    return `Selected files total ${formatBytes(totalBytes)}. ` +
      `Maximum total size is ${formatBytes(MAX_TOTAL_FILE_SIZE)}.`;
  }

  return null;
}

function renderSelectedFiles(files: File[]) {
  const title = document.createElement("h2");
  title.appendChild(document.createTextNode(files[0].name));
  if (files.length > 1) {
    title.appendChild(document.createElement("br"));
    title.appendChild(document.createTextNode(`... and ${files.length - 1} more`));
  }
  ui.fileSelectArea.replaceChildren(title);
}

function updateConvertButtonState(): void {
  const selectedInput = ui.inputList.querySelector("button.selected");
  const selectedOutput = ui.outputList.querySelector("button.selected");

  let disabledReason = "Ready to convert.";
  let enabled = true;

  if (selectedFiles.length === 0) {
    enabled = false;
    disabledReason = "Choose at least one file to continue.";
  } else if (!(selectedInput instanceof HTMLButtonElement)) {
    enabled = false;
    disabledReason = "Select the source format in “Convert from”.";
  } else if (!(selectedOutput instanceof HTMLButtonElement)) {
    enabled = false;
    disabledReason = "Select the target format in “Convert to”.";
  }

  ui.convertButton.disabled = !enabled;
  ui.convertButton.classList.toggle("disabled", !enabled);
  ui.convertButton.setAttribute("aria-disabled", enabled ? "false" : "true");
  ui.convertHelperText.textContent = disabledReason;
}

/**
 * Filters a list of buttons to exclude those not matching a substring.
 * @param list Button list (div) to filter.
 * @param query Substring for which to search.
 */
const filterButtonList = (list: HTMLDivElement, query: string) => {
  for (const button of Array.from(list.children)) {
    if (!(button instanceof HTMLButtonElement)) continue;
    const formatIndex = button.getAttribute("format-index");
    let hasExtension = false;
    if (formatIndex) {
      const format = allOptions[Number.parseInt(formatIndex, 10)];
      hasExtension = format?.format.extension.toLowerCase().includes(query) ?? false;
    }
    const hasText = button.textContent?.toLowerCase().includes(query) ?? false;
    button.classList.toggle("hidden", !hasExtension && !hasText);
  }
};

/**
 * Handles search box input by filtering its parent container.
 * @param event Input event from an {@link HTMLInputElement}
 */
const searchHandler = (event: Event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  const targetParentList = target.parentElement?.querySelector(".format-list");
  if (!(targetParentList instanceof HTMLDivElement)) return;

  const query = target.value.toLowerCase();
  filterButtonList(targetParentList, query);
};

// Assign search handler to both search boxes
ui.inputSearch.oninput = searchHandler;
ui.outputSearch.oninput = searchHandler;

// Event delegation for format list button clicks
function formatListClickHandler(event: Event) {
  const target = event.target;
  const button = target instanceof HTMLButtonElement
    ? target
    : (target instanceof HTMLElement ? target.closest("button") : null);
  if (!(button instanceof HTMLButtonElement)) return;
  const parent = button.parentElement;
  const previous = parent?.querySelector("button.selected");
  if (previous instanceof HTMLButtonElement) previous.classList.remove("selected");
  button.classList.add("selected");
  updateConvertButtonState();
}
ui.inputList.addEventListener("click", formatListClickHandler);
ui.outputList.addEventListener("click", formatListClickHandler);

// Map clicks in the file selection area to the file input element
ui.fileSelectArea.onclick = () => {
  ui.fileInput.click();
};

function renderPopupHtml(html: string, tone: "info" | "error" | "success" = "info", busy = false): void {
  ui.popupBox.classList.remove(...POPUP_TONE_CLASSES);
  if (tone === "error") ui.popupBox.classList.add("popup-error");
  if (tone === "success") ui.popupBox.classList.add("popup-success");
  if (busy) ui.popupBox.classList.add("popup-busy");

  ui.popupBox.setAttribute("role", tone === "error" ? "alertdialog" : "dialog");
  ui.popupBox.setAttribute("aria-live", tone === "error" ? "assertive" : "polite");
  ui.popupBox.setAttribute("aria-busy", busy ? "true" : "false");

  ui.popupBox.innerHTML = html;
  ui.popupBox.hidden = false;
  ui.popupBackground.hidden = false;

  const dismissButtons = ui.popupBox.querySelectorAll("[data-popup-dismiss]");
  for (const button of dismissButtons) {
    button.addEventListener("click", () => window.hidePopup());
  }
}

function buildPopupMarkup(
  title: string,
  message: string,
  options: {
    busy?: boolean;
    dismissLabel?: string;
    detailsHtml?: string;
    dismissible?: boolean;
  } = {}
): string {
  const { busy = false, dismissLabel = "Dismiss", detailsHtml = "", dismissible = true } = options;
  return [
    `<h2 id="popup-title">${escapeHtml(title)}</h2>`,
    busy ? `<div class="popup-progress" role="status"><span class="popup-spinner" aria-hidden="true"></span><span>Working…</span></div>` : "",
    `<p>${escapeHtml(message)}</p>`,
    detailsHtml,
    dismissible
      ? `<div class="popup-actions"><button type="button" aria-label="${escapeHtml(dismissLabel)}" data-popup-dismiss>${escapeHtml(dismissLabel)}</button></div>`
      : ""
  ].join("");
}

function showErrorPopup(message: string, title = "Can’t continue"): void {
  renderPopupHtml(
    buildPopupMarkup(title, message, { dismissLabel: "Close" }),
    "error"
  );
}

function showBusyPopup(title: string, message: string): void {
  renderPopupHtml(
    buildPopupMarkup(title, message, { busy: true, dismissible: false }),
    "info",
    true
  );
}

function showConversionSuccessPopup(
  inputFormat: FileFormat,
  outputFormat: FileFormat,
  path: ConvertPathNode[],
  files: FileData[],
  outputMime: string,
  note?: string
): void {
  releasePersistentDownloadUrls();

  const downloadsHtml = files.map(file => {
    const blob = new Blob([file.bytes as BlobPart], { type: outputMime });
    const objectUrl = URL.createObjectURL(blob);
    persistentDownloadUrls.push(objectUrl);

    const safeName = escapeHtml(file.name);
    const safeSize = escapeHtml(formatBytes(file.bytes.length));

    return `<li class="popup-download-item">` +
      `<a class="popup-download-link" href="${objectUrl}" download="${safeName}">${safeName}</a>` +
      `<span class="popup-file-size">${safeSize}</span>` +
      `</li>`;
  }).join("");

  const routeUsed = path.length > 0
    ? path.map(step => step.format.format.toUpperCase()).join(" → ")
    : `${inputFormat.format.toUpperCase()} (direct)`;

  const details = [
    `<p class="popup-path">Path used: <b>${escapeHtml(routeUsed)}</b></p>`,
    note ? `<p>${escapeHtml(note)}</p>` : "",
    `<ul class="popup-download-list">${downloadsHtml}</ul>`
  ].join("");

  renderPopupHtml(
    buildPopupMarkup(
      `Converted ${inputFormat.format.toUpperCase()} → ${outputFormat.format.toUpperCase()}`,
      "Downloads started automatically. Re-download from the links below.",
      { detailsHtml: details, dismissLabel: "Done" }
    ),
    "success"
  );
}

/**
 * Display an on-screen popup.
 * @param html HTML content of the popup box.
 */
window.showPopup = function (html: string) {
  renderPopupHtml(html);
};
/**
 * Hide the on-screen popup.
 */
window.hidePopup = function () {
  ui.popupBox.hidden = true;
  ui.popupBackground.hidden = true;
  ui.popupBox.classList.remove(...POPUP_TONE_CLASSES);
  ui.popupBox.removeAttribute("aria-busy");
};

ui.popupBackground.addEventListener("click", () => {
  if (!ui.popupBox.classList.contains("popup-busy")) {
    window.hidePopup();
  }
});

const clearDragFeedback = () => {
  ui.fileSelectArea.classList.remove("is-dragover");
};

ui.fileSelectArea.addEventListener("dragenter", event => {
  if (!event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  ui.fileSelectArea.classList.add("is-dragover");
});
ui.fileSelectArea.addEventListener("dragover", event => {
  if (!event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  ui.fileSelectArea.classList.add("is-dragover");
});
ui.fileSelectArea.addEventListener("dragleave", event => {
  event.preventDefault();
  const relatedTarget = event.relatedTarget;
  if (!(relatedTarget instanceof Node) || !ui.fileSelectArea.contains(relatedTarget)) {
    clearDragFeedback();
  }
});

/**
 * Validates and stores user selected files. Works for both manual
 * selection and file drag-and-drop.
 * @param event Either a file input element's "change" event,
 * or a "drop" event.
 */
const fileSelectHandler = (event: Event) => {

  let inputFiles;

  if (event instanceof DragEvent) {
    inputFiles = event.dataTransfer?.files;
    if (inputFiles) event.preventDefault();
  } else if (event instanceof ClipboardEvent) {
    inputFiles = event.clipboardData?.files;
  } else {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    inputFiles = target.files;
  }

  if (!inputFiles) return;
  const files = Array.from(inputFiles);
  if (files.length === 0) return;

  const fileValidationError = validateSelectedFiles(files);
  if (fileValidationError) {
    showErrorPopup(fileValidationError, "Upload limit reached");
    return;
  }

  if (files.some(file => file.type !== files[0].type)) {
    showErrorPopup("All input files must be of the same type.");
    return;
  }

  files.sort((a, b) => a.name === b.name ? 0 : (a.name < b.name ? -1 : 1));
  selectedFiles = files;

  renderSelectedFiles(files);

  // Common MIME type adjustments (to match "mime" library)
  const mimeType = normalizeMimeType(files[0].type);

  // Find a button matching the input MIME type.
  const buttonMimeType = Array.from(ui.inputList.children).find(button => {
    if (!(button instanceof HTMLButtonElement)) return false;
    return button.getAttribute("mime-type") === mimeType;
  });
  // Click button with matching MIME type.
  if (mimeType && buttonMimeType instanceof HTMLButtonElement) {
    buttonMimeType.click();
    ui.inputSearch.value = mimeType;
    filterButtonList(ui.inputList, ui.inputSearch.value);
    updateConvertButtonState();
    return;
  }

  // Fall back to matching format by file extension if MIME type wasn't found.
  const fileExtension = files[0].name.split(".").pop()?.toLowerCase();

  const buttonExtension = Array.from(ui.inputList.children).find(button => {
    if (!(button instanceof HTMLButtonElement)) return false;
    const formatIndex = button.getAttribute("format-index");
    if (!formatIndex) return false;
    const format = allOptions[Number.parseInt(formatIndex, 10)];
    return format?.format.extension.toLowerCase() === fileExtension;
  });
  if (buttonExtension instanceof HTMLButtonElement) {
    buttonExtension.click();
    ui.inputSearch.value = buttonExtension.getAttribute("mime-type") || "";
  } else {
    ui.inputSearch.value = fileExtension || "";
  }

  filterButtonList(ui.inputList, ui.inputSearch.value);
  updateConvertButtonState();

};

// Add the file selection handler to both the file input element and to
// the window as a drag-and-drop event, and to the clipboard paste event.
ui.fileInput.addEventListener("change", fileSelectHandler);
window.addEventListener("drop", event => {
  clearDragFeedback();
  fileSelectHandler(event);
});
window.addEventListener("dragover", event => event.preventDefault());
window.addEventListener("dragend", clearDragFeedback);
window.addEventListener("paste", fileSelectHandler);

window.supportedFormatCache = new Map();
window.traversionGraph = new TraversionGraph();

window.printSupportedFormatCache = () => {
  const entries = [];
  for (const entry of window.supportedFormatCache) {
    entries.push(entry);
  }
  return JSON.stringify(entries, null, 2);
};

function createFormatLabelSpan(className: string, text: string): HTMLSpanElement {
  const label = document.createElement("span");
  label.className = className;
  label.appendChild(document.createTextNode(text));
  return label;
}

async function buildOptionList() {

  showBusyPopup("Loading formats", "Preparing available conversion options…");

  allOptions.length = 0;
  ui.inputList.innerHTML = "";
  ui.outputList.innerHTML = "";

  const inputFragment = document.createDocumentFragment();
  const outputFragment = document.createDocumentFragment();
  const seenInputs = new Set<string>();
  const seenOutputs = new Set<string>();

  for (const handler of handlers) {
    if (!window.supportedFormatCache.has(handler.name)) {
      console.warn(`Cache miss for formats of handler "${handler.name}".`);
      try {
        await handler.init();
      } catch {
        continue;
      }
      if (handler.supportedFormats) {
        window.supportedFormatCache.set(handler.name, handler.supportedFormats);
        console.info(`Updated supported format cache for "${handler.name}".`);
      }
    }
    const supportedFormats = window.supportedFormatCache.get(handler.name);
    if (!supportedFormats) {
      console.warn(`Handler "${handler.name}" doesn't support any formats.`);
      continue;
    }
    for (const format of supportedFormats) {

      if (!format.mime) continue;

      allOptions.push({ format, handler });

      // In simple mode, display each input/output format only once
      const formatKey = `${format.mime}\0${format.format}`;
      let addToInputs = true;
      let addToOutputs = true;
      if (simpleMode) {
        addToInputs = !seenInputs.has(formatKey);
        addToOutputs = !seenOutputs.has(formatKey);
        if ((!format.from || !addToInputs) && (!format.to || !addToOutputs)) continue;
      }

      const newOption = document.createElement("button");
      newOption.type = "button";
      newOption.setAttribute("format-index", (allOptions.length - 1).toString());
      newOption.setAttribute("mime-type", format.mime);

      const extensionLabel = formatOptionExtension(format);
      const readableName = simpleMode ? cleanFormatName(format.name) : format.name;
      const supportingDetails = simpleMode ? format.mime : `${format.mime} • ${handler.name}`;

      newOption.setAttribute(
        "aria-label",
        `Format ${extensionLabel}, ${readableName}, MIME ${format.mime}${simpleMode ? "" : `, handler ${handler.name}`}`
      );

      newOption.appendChild(createFormatLabelSpan("format-label-primary", extensionLabel));
      newOption.appendChild(createFormatLabelSpan("format-label-secondary", readableName));
      newOption.appendChild(createFormatLabelSpan("format-label-mime", supportingDetails));

      if (format.from && addToInputs) {
        const clone = newOption.cloneNode(true) as HTMLButtonElement;
        inputFragment.appendChild(clone);
        if (simpleMode) seenInputs.add(formatKey);
      }
      if (format.to && addToOutputs) {
        const clone = newOption.cloneNode(true) as HTMLButtonElement;
        outputFragment.appendChild(clone);
        if (simpleMode) seenOutputs.add(formatKey);
      }

    }
  }

  ui.inputList.appendChild(inputFragment);
  ui.outputList.appendChild(outputFragment);
  window.traversionGraph.init(window.supportedFormatCache, handlers);

  filterButtonList(ui.inputList, ui.inputSearch.value);
  filterButtonList(ui.outputList, ui.outputSearch.value);
  updateConvertButtonState();

  window.hidePopup();

}

(async () => {
  try {
    const cacheJSON = await fetch("cache.json").then(r => r.json());
    window.supportedFormatCache = new Map(cacheJSON);
  } catch {
    console.warn(
      "Missing supported format precache.\n\n" +
      "Consider saving the output of printSupportedFormatCache() to cache.json."
    );
  } finally {
    await buildOptionList();
    console.log("Built initial format list.");
  }
})();

ui.modeToggleButton.addEventListener("click", () => {
  simpleMode = !simpleMode;
  if (simpleMode) {
    ui.modeToggleButton.textContent = "Advanced mode";
    document.body.style.setProperty("--highlight-color", "#1C77FF");
  } else {
    ui.modeToggleButton.textContent = "Simple mode";
    document.body.style.setProperty("--highlight-color", "#FF6F1C");
  }
  void buildOptionList();
});

async function attemptConvertPath(files: FileData[], path: ConvertPathNode[]): Promise<{ files: FileData[]; path: ConvertPathNode[] } | null> {
  if (path.length < 2) {
    console.error("Invalid path: requires at least 2 nodes");
    return null;
  }

  const route = path.map(step => step.format.format.toUpperCase()).join(" → ");
  showBusyPopup("Finding conversion route", `Trying ${route}…`);

  try {
    for (let i = 0; i < path.length - 1; i++) {
      const currentNode = path[i];
      const nextNode = path[i + 1];
      const handler = nextNode.handler;

      if (!handler) {
        console.error(`No handler found for path segment ${i}`);
        return null;
      }

      showBusyPopup(
        "Converting",
        `Step ${i + 1} of ${path.length - 1}: ${currentNode.format.format.toUpperCase()} → ${nextNode.format.format.toUpperCase()}`
      );

      let supportedFormats = window.supportedFormatCache.get(handler.name);

      if (!handler.ready) {
        try {
          await handler.init();
        } catch (initError) {
          console.warn(`Handler "${handler.name}" initialization failed:`, initError);
          return null;
        }
        if (handler.supportedFormats) {
          window.supportedFormatCache.set(handler.name, handler.supportedFormats);
          supportedFormats = handler.supportedFormats;
        }
      }

      if (!supportedFormats) {
        console.error(`Handler "${handler.name}" doesn't support any formats.`);
        return null;
      }

      const inputFormat = supportedFormats.find(f => f.mime === currentNode.format.mime && f.from);
      if (!inputFormat) {
        console.error(`No valid input format found for ${currentNode.format.mime}`);
        return null;
      }

      const [convertedFiles] = await Promise.all([
        handler.doConvert(files, inputFormat, nextNode.format),
        new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      ]);

      if (!Array.isArray(convertedFiles) || convertedFiles.some(file => !file.bytes?.length)) {
        console.warn(`Conversion produced empty output at step ${i}`);
        showBusyPopup("Finding conversion route", "This path failed. Looking for a valid route…");
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return null;
      }

      files = convertedFiles;
    }

    return { files, path };
  } catch (error) {
    console.error("Conversion path failed:", error);
    return null;
  }
}

window.tryConvertByTraversing = async function (
  files: FileData[],
  from: ConvertPathNode,
  to: ConvertPathNode
) {
  for await (const path of window.traversionGraph.searchPath(from, to, simpleMode)) {
    // Use exact output format if the target handler supports it
    if (path.at(-1)?.handler === to.handler) {
      path[path.length - 1] = to;
    }
    const attempt = await attemptConvertPath(files, path);
    if (attempt) return attempt;
  }
  return null;
};

function downloadFile(bytes: Uint8Array, name: string, mime: string): void {
  try {
    const blob = new Blob([bytes as BlobPart], { type: mime });
    const objectURL = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectURL;
    link.download = name;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    // Use setTimeout to ensure the download starts before cleanup
    setTimeout(() => {
      URL.revokeObjectURL(objectURL);
      link.remove();
    }, 100);
  } catch (error) {
    console.error("Failed to download file:", error);
    showErrorPopup(`Failed to download “${name}”. Please try again.`);
  }
}

ui.convertButton.onclick = async function () {

  if (ui.convertButton.disabled) return;

  const inputFiles = selectedFiles;

  if (inputFiles.length === 0) {
    showErrorPopup("Select an input file.");
    return;
  }

  const fileValidationError = validateSelectedFiles(inputFiles);
  if (fileValidationError) {
    showErrorPopup(fileValidationError, "Upload limit reached");
    return;
  }

  const inputButton = ui.inputList.querySelector("button.selected");
  if (!(inputButton instanceof HTMLButtonElement)) {
    showErrorPopup("Specify input file format.");
    return;
  }

  const outputButton = ui.outputList.querySelector("button.selected");
  if (!(outputButton instanceof HTMLButtonElement)) {
    showErrorPopup("Specify output file format.");
    return;
  }

  const inputIndex = Number.parseInt(inputButton.getAttribute("format-index") || "", 10);
  const outputIndex = Number.parseInt(outputButton.getAttribute("format-index") || "", 10);

  const inputOption = allOptions[inputIndex];
  const outputOption = allOptions[outputIndex];

  if (!inputOption || !outputOption) {
    showErrorPopup("Selected formats are unavailable. Please reselect formats and try again.");
    return;
  }

  const inputFormat = inputOption.format;
  const outputFormat = outputOption.format;

  try {
    releasePersistentDownloadUrls();

    const inputFileData: FileData[] = [];
    for (const inputFile of inputFiles) {
      const inputBuffer = await inputFile.arrayBuffer();
      const inputBytes = new Uint8Array(inputBuffer);
      inputFileData.push({ name: inputFile.name, bytes: inputBytes });
    }

    if (inputFormat.mime === outputFormat.mime) {
      for (const file of inputFileData) {
        downloadFile(file.bytes, file.name, inputFormat.mime);
      }
      showConversionSuccessPopup(
        inputFormat,
        outputFormat,
        [],
        inputFileData,
        outputFormat.mime,
        "Input and output formats are the same, so no conversion route was needed."
      );
      return;
    }

    showBusyPopup("Finding conversion route", "Preparing conversion…");
    // Delay for a bit to give the browser time to render
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const output = await window.tryConvertByTraversing(inputFileData, inputOption, outputOption);
    if (!output) {
      showErrorPopup("Failed to find a valid conversion route. Try another target format or switch conversion mode.", "No route found");
      return;
    }

    for (const file of output.files) {
      downloadFile(file.bytes, file.name, outputFormat.mime);
    }

    showConversionSuccessPopup(inputFormat, outputFormat, output.path, output.files, outputFormat.mime);
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    showErrorPopup(`Unexpected error while converting: ${errorText}`, "Conversion failed");
    console.error(error);
  }

};

updateConvertButtonState();
