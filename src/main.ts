import type { FileFormat, FileData, FormatHandler, ConvertPathNode } from "./FormatHandler.js";
import normalizeMimeType from "./normalizeMimeType.js";
import handlers from "./handlers";
import { TraversionGraph } from "./TraversionGraph.js";
import { initPWA } from "./pwa.js";
import "./pwa.css";
import { validateFileSignature, getFileExtension, type FileFormatInfo } from "./fileValidator.js";
import { initPerformanceTracking } from "./performance.js";
import { initLogging, log } from "./logging.js";

/** Initialize logging and performance tracking early for accurate metrics */
initLogging();
initPerformanceTracking({ debug: true });

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
  // Check for selection in original buttons (source of truth for virtual lists)
  let selectedInput: HTMLButtonElement | null = null;
  let selectedOutput: HTMLButtonElement | null = null;

  // Check input list
  const inputVirtual = virtualLists.get(ui.inputList);
  if (inputVirtual) {
    // For virtual lists, check original buttons
    for (const [, btn] of inputVirtual["originalButtonsMap"]) {
      if (btn.classList.contains("selected")) {
        selectedInput = btn;
        break;
      }
    }
  } else {
    selectedInput = ui.inputList.querySelector("button.selected");
  }

  // Check output list
  const outputVirtual = virtualLists.get(ui.outputList);
  if (outputVirtual) {
    for (const [, btn] of outputVirtual["originalButtonsMap"]) {
      if (btn.classList.contains("selected")) {
        selectedOutput = btn;
        break;
      }
    }
  } else {
    selectedOutput = ui.outputList.querySelector("button.selected");
  }

  let disabledReason = "Ready to convert.";
  let enabled = true;

  if (selectedFiles.length === 0) {
    enabled = false;
    disabledReason = "Choose at least one file to continue.";
  } else if (!(selectedInput instanceof HTMLButtonElement)) {
    enabled = false;
    disabledReason = "Select the source format in \"Convert from\".";
  } else if (!(selectedOutput instanceof HTMLButtonElement)) {
    enabled = false;
    disabledReason = "Select the target format in \"Convert to\".";
  }

  ui.convertButton.disabled = !enabled;
  ui.convertButton.classList.toggle("disabled", !enabled);
  ui.convertButton.setAttribute("aria-disabled", enabled ? "false" : "true");
  ui.convertHelperText.textContent = disabledReason;
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds.
 * @param func The function to debounce.
 * @param wait The number of milliseconds to delay.
 * @returns A new debounced function with cancel and flush methods.
 */
function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: () => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = (...args: Parameters<T>) => {
    lastArgs = args;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      func(...args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  debounced.flush = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      if (lastArgs !== null) {
        func(...lastArgs);
      }
    }
  };

  return debounced as ReturnType<typeof debounce>;
}

/**
 * Virtual list manager for format lists.
 * Handles efficient rendering of large lists by only showing visible items.
 * Supports 1000+ items with smooth 60fps scrolling.
 */
class VirtualFormatList {
  private container: HTMLDivElement;
  private itemHeight: number;
  private bufferSize: number;
  private originalButtons: HTMLButtonElement[] = [];
  private filteredIndices: number[] = [];
  private scrollTop: number = 0;
  private pooledElements: HTMLButtonElement[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private filterQuery: string = "";
  private rafId: number | null = null;
  private scrollContainer: HTMLDivElement | null = null;
  private contentContainer: HTMLDivElement | null = null;
  private spacer: HTMLDivElement | null = null;

  // Store original buttons for selection sync by format-index
  private originalButtonsMap = new Map<number, HTMLButtonElement>();

  constructor(container: HTMLDivElement, itemHeight: number = 54, bufferSize: number = 4) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.bufferSize = bufferSize;

    // Extract existing buttons before virtualization
    this.originalButtons = Array.from(container.children).filter(
      child => child instanceof HTMLButtonElement
    ) as HTMLButtonElement[];

    // Build map for quick lookup by format-index
    this.originalButtons.forEach((btn) => {
      const formatIndex = btn.getAttribute("format-index");
      if (formatIndex) {
        this.originalButtonsMap.set(Number.parseInt(formatIndex, 10), btn);
      }
    });

    this.setupVirtualContainer();
  }

  private setupVirtualContainer(): void {
    // Clear container and prepare for virtual scrolling
    this.container.innerHTML = "";

    // Create scroll container - this is what the user scrolls
    this.scrollContainer = document.createElement("div");
    this.scrollContainer.className = "virtual-list-scroll";
    this.scrollContainer.style.cssText = `
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      position: relative;
      -webkit-overflow-scrolling: touch;
      will-change: scroll-position;
    `;

    // Create spacer element to set total scrollable height
    this.spacer = document.createElement("div");
    this.spacer.className = "virtual-list-spacer";
    this.spacer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      pointer-events: none;
      z-index: -1;
      contain: strict;
    `;

    // Create content container for visible items
    this.contentContainer = document.createElement("div");
    this.contentContainer.className = "virtual-list-content";
    this.contentContainer.style.cssText = `
      position: relative;
      width: 100%;
      contain: layout style;
    `;

    this.scrollContainer.appendChild(this.spacer);
    this.scrollContainer.appendChild(this.contentContainer);
    this.container.appendChild(this.scrollContainer);

    // Set up scroll listener with passive for better performance
    this.scrollContainer.addEventListener("scroll", this.handleScroll.bind(this), { passive: true });

    // Set up resize observer to handle viewport changes
    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleUpdate();
    });
    this.resizeObserver.observe(this.scrollContainer);

    // Initial render
    this.updateFilteredIndices();
    this.scheduleUpdate();
  }

  private handleScroll(): void {
    if (!this.scrollContainer) return;
    this.scrollTop = this.scrollContainer.scrollTop;
    this.scheduleUpdate();
  }

  private scheduleUpdate(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.render();
    });
  }

  private render(): void {
    if (!this.scrollContainer || !this.spacer || !this.contentContainer) return;

    const viewportHeight = this.scrollContainer.clientHeight;
    const totalItems = this.filteredIndices.length;
    const totalHeight = totalItems * this.itemHeight;

    // Update spacer height for correct scroll bar
    this.spacer.style.height = `${totalHeight}px`;

    // Calculate visible range with buffer
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
    const endIndex = Math.min(totalItems, Math.ceil((this.scrollTop + viewportHeight) / this.itemHeight) + this.bufferSize);

    // Track which indices are currently rendered
    const renderedMap = new Map<number, HTMLButtonElement>();
    for (const child of Array.from(this.contentContainer.children)) {
      const idx = parseInt(child.getAttribute("data-virtual-index") || "-1", 10);
      if (idx >= 0) {
        renderedMap.set(idx, child as HTMLButtonElement);
      }
    }

    // Remove elements that are no longer in visible range
    for (const [idx, element] of renderedMap) {
      if (idx < startIndex || idx >= endIndex) {
        element.remove();
        this.returnToPool(element);
        renderedMap.delete(idx);
      }
    }

    // Add elements that should be visible but aren't
    for (let i = startIndex; i < endIndex; i++) {
      if (!renderedMap.has(i)) {
        const originalIndex = this.filteredIndices[i];
        if (originalIndex === undefined) continue;

        const button = this.getOrCreatePooledElement(originalIndex);
        button.style.transform = `translateY(${i * this.itemHeight}px)`;
        button.style.position = "absolute";
        button.style.left = "0";
        button.style.right = "0";
        button.setAttribute("data-virtual-index", i.toString());
        this.contentContainer.appendChild(button);
      }
    }
  }

  private getOrCreatePooledElement(originalIndex: number): HTMLButtonElement {
    const originalButton = this.originalButtons[originalIndex];
    if (!originalButton) {
      const placeholder = document.createElement("button");
      placeholder.type = "button";
      placeholder.disabled = true;
      placeholder.textContent = "Loading...";
      return placeholder;
    }

    // Try to get from pool for reuse
    let element = this.pooledElements.pop();

    if (!element) {
      element = document.createElement("button");
      element.type = "button";
    }

    // Copy all attributes from original button
    for (const attr of originalButton.attributes) {
      if (attr.name !== "style" && attr.name !== "data-virtual-index") {
        element.setAttribute(attr.name, attr.value);
      }
    }

    // Copy inner HTML (the spans with labels)
    element.innerHTML = originalButton.innerHTML;

    // Sync selected state from original
    const isSelected = originalButton.classList.contains("selected");
    element.classList.toggle("selected", isSelected);

    return element;
  }

  private returnToPool(element: HTMLButtonElement): void {
    // Limit pool size to prevent unbounded memory growth
    const maxPoolSize = 25;
    if (this.pooledElements.length < maxPoolSize) {
      // Clear inline styles before returning to pool
      element.removeAttribute("style");
      this.pooledElements.push(element);
    }
  }

  private updateFilteredIndices(): void {
    if (!this.filterQuery) {
      // No filter - show all items
      this.filteredIndices = this.originalButtons.map((_, i) => i);
    } else {
      // Filter by query
      const query = this.filterQuery.toLowerCase();
      this.filteredIndices = this.originalButtons
        .map((button, i) => ({ button, index: i }))
        .filter(({ button }) => {
          const formatIndex = button.getAttribute("format-index");
          let hasExtension = false;
          if (formatIndex) {
            const format = allOptions[Number.parseInt(formatIndex, 10)];
            hasExtension = format?.format.extension.toLowerCase().includes(query) ?? false;
          }
          const hasText = button.textContent?.toLowerCase().includes(query) ?? false;
          return hasExtension || hasText;
        })
        .map(({ index }) => index);
    }

    // Reset scroll position when filter changes
    if (this.scrollContainer) {
      this.scrollContainer.scrollTop = 0;
      this.scrollTop = 0;
    }
  }

  filter(query: string): void {
    this.filterQuery = query;
    this.updateFilteredIndices();
    this.scheduleUpdate();
  }

  /**
   * Get all currently rendered button elements.
   */
  private getRenderedButtons(): HTMLButtonElement[] {
    if (!this.contentContainer) return [];
    return Array.from(this.contentContainer.children).filter(
      child => child instanceof HTMLButtonElement
    ) as HTMLButtonElement[];
  }

  /**
   * Handle keyboard navigation within the virtual list.
   */
  handleKeydown(event: KeyboardEvent): boolean {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return false;

    const formatIndex = target.getAttribute("format-index");
    if (!formatIndex) return false;

    // Find current virtual index
    const currentVirtualIndex = this.filteredIndices.findIndex(idx => {
      const btn = this.originalButtons[idx];
      return btn?.getAttribute("format-index") === formatIndex;
    });

    if (currentVirtualIndex === -1) return false;

    let nextVirtualIndex = -1;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        nextVirtualIndex = Math.min(currentVirtualIndex + 1, this.filteredIndices.length - 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        nextVirtualIndex = Math.max(currentVirtualIndex - 1, 0);
        break;
      case "Home":
        event.preventDefault();
        nextVirtualIndex = 0;
        break;
      case "End":
        event.preventDefault();
        nextVirtualIndex = this.filteredIndices.length - 1;
        break;
      case "PageDown":
        event.preventDefault();
        if (this.scrollContainer) {
          const viewportItems = Math.ceil(this.scrollContainer.clientHeight / this.itemHeight);
          nextVirtualIndex = Math.min(currentVirtualIndex + viewportItems - 1, this.filteredIndices.length - 1);
        }
        break;
      case "PageUp":
        event.preventDefault();
        if (this.scrollContainer) {
          const viewportItems = Math.ceil(this.scrollContainer.clientHeight / this.itemHeight);
          nextVirtualIndex = Math.max(currentVirtualIndex - viewportItems + 1, 0);
        }
        break;
      default:
        return false;
    }

    if (nextVirtualIndex !== -1 && nextVirtualIndex !== currentVirtualIndex) {
      const nextOriginalIndex = this.filteredIndices[nextVirtualIndex];
      const nextButton = this.originalButtons[nextOriginalIndex];

      if (nextButton) {
        // Trigger click on the next button (this will handle selection)
        nextButton.click();

        // Ensure the newly selected item is visible
        this.scrollToFormat(
          Number.parseInt(nextButton.getAttribute("format-index") || "0", 10),
          "nearest"
        );

        // Focus the newly selected item in the virtual list
        requestAnimationFrame(() => {
          const renderedButtons = this.getRenderedButtons();
          const focusedButton = renderedButtons.find(btn =>
            btn.getAttribute("format-index") === nextButton.getAttribute("format-index")
          );
          if (focusedButton) {
            focusedButton.focus();
          }
        });

        return true;
      }
    }

    return false;
  }

  /**
   * Sync selection state from original buttons to virtual display.
   * Call this after selection changes to update the virtual display.
   */
  syncSelection(): void {
    if (!this.contentContainer) return;

    for (const child of Array.from(this.contentContainer.children)) {
      if (!(child instanceof HTMLButtonElement)) continue;

      const formatIndex = child.getAttribute("format-index");
      if (formatIndex) {
        const idx = Number.parseInt(formatIndex, 10);
        const original = this.originalButtonsMap.get(idx);
        if (original) {
          const isSelected = original.classList.contains("selected");
          child.classList.toggle("selected", isSelected);
        }
      }
    }
  }

  /**
   * Scroll to a specific item by format index.
   * @param formatIndex The format-index attribute value
   * @param alignment Where to position the item
   */
  scrollToFormat(formatIndex: number, alignment: "start" | "center" | "end" | "nearest" = "nearest"): void {
    const virtualIndex = this.filteredIndices.findIndex(idx => {
      const btn = this.originalButtons[idx];
      return btn?.getAttribute("format-index") === formatIndex.toString();
    });

    if (virtualIndex === -1 || !this.scrollContainer) return;

    const viewportHeight = this.scrollContainer.clientHeight;
    let targetScroll = virtualIndex * this.itemHeight;

    switch (alignment) {
      case "center":
        targetScroll -= viewportHeight / 2 - this.itemHeight / 2;
        break;
      case "end":
        targetScroll -= viewportHeight - this.itemHeight;
        break;
      case "nearest":
        if (targetScroll >= this.scrollTop && targetScroll + this.itemHeight <= this.scrollTop + viewportHeight) {
          return; // Already visible
        }
        if (targetScroll < this.scrollTop) {
          // Above viewport, scroll to top
        } else {
          // Below viewport, scroll to show at bottom
          targetScroll -= viewportHeight - this.itemHeight;
        }
        break;
    }

    const maxScroll = Math.max(0, this.filteredIndices.length * this.itemHeight - viewportHeight);
    targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));

    this.scrollContainer.scrollTo({ top: targetScroll, behavior: "smooth" });
  }

  /**
   * Get the original button for a format index.
   * This is used for querying selection state.
   */
  getOriginalButton(formatIndex: number): HTMLButtonElement | undefined {
    return this.originalButtonsMap.get(formatIndex);
  }

  getFilteredCount(): number {
    return this.filteredIndices.length;
  }

  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Restore original buttons (for mode switching, etc.)
    this.container.innerHTML = "";
    for (const button of this.originalButtons) {
      const clone = button.cloneNode(true) as HTMLButtonElement;
      this.container.appendChild(clone);
    }

    this.pooledElements = [];
    this.originalButtonsMap.clear();
  }
}

// Map to store virtual list instances
const virtualLists = new WeakMap<HTMLDivElement, VirtualFormatList>();

/**
 * Filters a list of buttons to exclude those not matching a substring.
 * Works with both virtualized and non-virtualized lists.
 * @param list Button list (div) to filter.
 * @param query Substring for which to search.
 */
const filterButtonList = (list: HTMLDivElement, query: string) => {
  const virtualList = virtualLists.get(list);
  if (virtualList) {
    virtualList.filter(query);
    return;
  }

  // Fallback for non-virtualized lists
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

interface DebouncedSearchState {
  debouncedSearch: ReturnType<typeof debounce>;
  inputElement: HTMLInputElement;
  targetList: HTMLDivElement;
  isLoading: boolean;
}

const searchStates = new Map<HTMLInputElement, DebouncedSearchState>();

/**
 * Sets loading state on a search input.
 */
function setSearchLoading(inputElement: HTMLInputElement, isLoading: boolean): void {
  inputElement.classList.toggle("search-loading", isLoading);
  inputElement.setAttribute("aria-busy", isLoading ? "true" : "false");

  const state = searchStates.get(inputElement);
  if (state) {
    state.isLoading = isLoading;
  }
}

/**
 * Executes the search filter operation.
 */
function executeSearch(inputElement: HTMLInputElement, targetList: HTMLDivElement): void {
  const query = inputElement.value.toLowerCase();
  filterButtonList(targetList, query);
  setSearchLoading(inputElement, false);
}

/**
 * Handles search box input with debouncing.
 * @param event Input event from an {@link HTMLInputElement}
 */
const searchHandler = (event: Event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  const targetParentList = target.parentElement?.querySelector(".format-list");
  if (!(targetParentList instanceof HTMLDivElement)) return;

  let state = searchStates.get(target);

  if (!state) {
    const debouncedSearch = debounce(
      () => executeSearch(target, targetParentList),
      250
    );

    state = {
      debouncedSearch,
      inputElement: target,
      targetList: targetParentList,
      isLoading: false
    };
    searchStates.set(target, state);
  }

  setSearchLoading(target, true);
  state.debouncedSearch();
};

/**
 * Handles Enter key in search inputs for immediate search.
 */
const searchKeydownHandler = (event: KeyboardEvent) => {
  if (event.key !== "Enter") return;

  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  const state = searchStates.get(target);
  if (state?.isLoading) {
    state.debouncedSearch.cancel();
    executeSearch(target, state.targetList);
  }
};

// Assign search handlers to both search boxes
ui.inputSearch.addEventListener("input", searchHandler);
ui.inputSearch.addEventListener("keydown", searchKeydownHandler);
ui.outputSearch.addEventListener("input", searchHandler);
ui.outputSearch.addEventListener("keydown", searchKeydownHandler);

// Event delegation for format list button clicks
function formatListClickHandler(event: Event) {
  const target = event.target;
  const button = target instanceof HTMLButtonElement
    ? target
    : (target instanceof HTMLElement ? target.closest("button") : null);
  if (!(button instanceof HTMLButtonElement)) return;
  const parent = button.parentElement;

  // Get the format-index from the clicked button
  const formatIndex = button.getAttribute("format-index");
  if (!formatIndex) return;

  // Find and update the original button (source of truth)
  const list = parent?.closest(".format-list") as HTMLDivElement | null;
  if (!list) return;

  const virtualList = virtualLists.get(list);
  let originalButton: HTMLButtonElement | undefined;

  if (virtualList) {
    originalButton = virtualList.getOriginalButton(Number.parseInt(formatIndex, 10));
  } else {
    // Non-virtualized: find original button in list
    originalButton = Array.from(list.children).find(
      btn => btn instanceof HTMLButtonElement && btn.getAttribute("format-index") === formatIndex
    ) as HTMLButtonElement | undefined;
  }

  // Update all original buttons in both lists to remove previous selection
  for (const currentList of [ui.inputList, ui.outputList]) {
    const vList = virtualLists.get(currentList);
    if (vList) {
      // For virtual lists, update the original buttons
      for (const [, btn] of vList["originalButtonsMap"]) {
        btn.classList.remove("selected");
      }
    } else {
      // For non-virtual lists, update directly
      const previous = currentList.querySelector("button.selected");
      if (previous instanceof HTMLButtonElement) previous.classList.remove("selected");
    }
  }

  // Set selected on the original button
  if (originalButton) {
    originalButton.classList.add("selected");
  }

  // Sync virtual display
  if (virtualList) {
    virtualList.syncSelection();
  }

  updateConvertButtonState();
}

// Event delegation for format list keyboard navigation
function formatListKeydownHandler(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const parent = target.parentElement;
  const list = parent?.closest(".format-list") as HTMLDivElement | null;
  if (!list) return;

  const virtualList = virtualLists.get(list);
  if (virtualList && event instanceof KeyboardEvent) {
    virtualList.handleKeydown(event);
  }
}

ui.inputList.addEventListener("click", formatListClickHandler);
ui.outputList.addEventListener("click", formatListClickHandler);
ui.inputList.addEventListener("keydown", formatListKeydownHandler);
ui.outputList.addEventListener("keydown", formatListKeydownHandler);

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
 * Validates file signatures to prevent MIME type spoofing attacks.
 * Checks the actual file content against the declared extension.
 * @param files Array of files to validate
 * @returns Object with validation result and details
 */
async function validateFileSignatures(files: File[]): Promise<{ valid: boolean; errors: string[]; detectedFormats: FileFormatInfo[] }> {
  const errors: string[] = [];
  const detectedFormats: FileFormatInfo[] = [];

  for (const file of files) {
    const result = await validateFileSignature(file);

    if (!result.valid) {
      errors.push(`"${file.name}": ${result.error}`);
    }

    if (result.detectedFormat) {
      detectedFormats.push(result.detectedFormat);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    detectedFormats
  };
}

/**
 * Validates and stores user selected files. Works for both manual
 * selection and file drag-and-drop.
 * @param event Either a file input element's "change" event,
 * or a "drop" event.
 */
const fileSelectHandler = async (event: Event) => {

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

  // Perform file signature validation to prevent MIME spoofing
  showBusyPopup("Validating files", "Checking file signatures for security…");
  const signatureValidation = await validateFileSignatures(files);

  if (!signatureValidation.valid) {
    const errorMessages = signatureValidation.errors.slice(0, 3).join("\n\n");
    const additionalErrors = signatureValidation.errors.length > 3
      ? `\n\n... and ${signatureValidation.errors.length - 3} more file(s)`
      : "";
    showErrorPopup(
      `File validation failed:\n\n${errorMessages}${additionalErrors}`,
      "Security check failed"
    );
    return;
  }

  // Check that all files have matching detected formats
  if (signatureValidation.detectedFormats.length > 0) {
    const firstFormat = signatureValidation.detectedFormats[0];
    const hasMismatch = signatureValidation.detectedFormats.some(format =>
      format.mime !== firstFormat.mime && format.extension !== firstFormat.extension
    );

    if (hasMismatch) {
      showErrorPopup(
        "All input files must be of the same type. Please select files with matching formats.",
        "Mixed file types detected"
      );
      return;
    }
  }

  files.sort((a, b) => a.name === b.name ? 0 : (a.name < b.name ? -1 : 1));
  selectedFiles = files;

  renderSelectedFiles(files);

  // Use detected MIME type from signature validation for accurate format detection
  let mimeType = files[0].type;
  let detectedExtension = getFileExtension(files[0].name);
  if (signatureValidation.detectedFormats.length > 0) {
    mimeType = signatureValidation.detectedFormats[0].mime;
    detectedExtension = signatureValidation.detectedFormats[0].extension;
  } else {
    // Fallback to browser MIME type with normalization
    mimeType = normalizeMimeType(files[0].type);
  }

  // Find a button matching the input MIME type.
  // Check both virtual and non-virtual lists
  const inputVirtual = virtualLists.get(ui.inputList);
  let buttonMimeType: HTMLButtonElement | undefined;

  if (inputVirtual) {
    // For virtual lists, search original buttons
    for (const [, btn] of inputVirtual["originalButtonsMap"]) {
      if (btn.getAttribute("mime-type") === mimeType) {
        buttonMimeType = btn;
        break;
      }
    }
  } else {
    // For non-virtual lists, search DOM
    buttonMimeType = Array.from(ui.inputList.children).find(button => {
      if (!(button instanceof HTMLButtonElement)) return false;
      return button.getAttribute("mime-type") === mimeType;
    }) as HTMLButtonElement | undefined;
  }

  // Click button with matching MIME type.
  if (mimeType && buttonMimeType) {
    buttonMimeType.click();
    ui.inputSearch.value = mimeType;
    filterButtonList(ui.inputList, ui.inputSearch.value);
    if (inputVirtual) inputVirtual.syncSelection();
    updateConvertButtonState();
    return;
  }

  // Fall back to matching format by detected file extension if MIME type wasn't found.
  const fileExtension = detectedExtension;

  let buttonExtension: HTMLButtonElement | undefined;

  if (inputVirtual) {
    for (const [, btn] of inputVirtual["originalButtonsMap"]) {
      const formatIndex = btn.getAttribute("format-index");
      if (!formatIndex) continue;
      const format = allOptions[Number.parseInt(formatIndex, 10)];
      if (format?.format.extension.toLowerCase() === fileExtension) {
        buttonExtension = btn;
        break;
      }
    }
  } else {
    buttonExtension = Array.from(ui.inputList.children).find(button => {
      if (!(button instanceof HTMLButtonElement)) return false;
      const formatIndex = button.getAttribute("format-index");
      if (!formatIndex) return false;
      const format = allOptions[Number.parseInt(formatIndex, 10)];
      return format?.format.extension.toLowerCase() === fileExtension;
    }) as HTMLButtonElement | undefined;
  }

  if (buttonExtension) {
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

  // Destroy any existing virtual lists before rebuilding
  const existingInputVirtual = virtualLists.get(ui.inputList);
  const existingOutputVirtual = virtualLists.get(ui.outputList);
  if (existingInputVirtual) existingInputVirtual.destroy();
  if (existingOutputVirtual) existingOutputVirtual.destroy();
  virtualLists.delete(ui.inputList);
  virtualLists.delete(ui.outputList);

  allOptions.length = 0;
  ui.inputList.innerHTML = "";
  ui.outputList.innerHTML = "";

  const inputFragment = document.createDocumentFragment();
  const outputFragment = document.createDocumentFragment();
  const seenInputs = new Set<string>();
  const seenOutputs = new Set<string>();

  for (const handler of handlers) {
    if (!window.supportedFormatCache.has(handler.name)) {
      log.debug("handler", `Cache miss for formats of handler "${handler.name}"`);
      try {
        await handler.init();
        log.trackHandler(handler.name, true);
      } catch (initError) {
        log.trackHandler(handler.name, false);
        log.error("handler", `Initialization failed for "${handler.name}"`, initError instanceof Error ? initError : undefined);
        continue;
      }
      if (handler.supportedFormats) {
        window.supportedFormatCache.set(handler.name, handler.supportedFormats);
        log.debug("handler", `Updated supported format cache for "${handler.name}"`);
      }
    }
    const supportedFormats = window.supportedFormatCache.get(handler.name);
    if (!supportedFormats) {
      log.warn("handler", `Handler "${handler.name}" doesn't support any formats`);
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

  // Enable virtualization for both format lists if they have many items
  // Threshold: virtualize if more than 30 items for better performance
  const VIRTUALIZATION_THRESHOLD = 30;

  if (ui.inputList.children.length > VIRTUALIZATION_THRESHOLD) {
    const inputVirtual = new VirtualFormatList(ui.inputList);
    virtualLists.set(ui.inputList, inputVirtual);
  }
  if (ui.outputList.children.length > VIRTUALIZATION_THRESHOLD) {
    const outputVirtual = new VirtualFormatList(ui.outputList);
    virtualLists.set(ui.outputList, outputVirtual);
  }

  filterButtonList(ui.inputList, ui.inputSearch.value);
  filterButtonList(ui.outputList, ui.outputSearch.value);
  updateConvertButtonState();

  window.hidePopup();

}

// Initialize PWA
void initPWA();

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

async function attemptConvertPath(
  files: FileData[],
  path: ConvertPathNode[],
  _inputFormat: FileFormat,
  _outputFormat: FileFormat,
  _startTime: number
): Promise<{ files: FileData[]; path: ConvertPathNode[] } | null> {
  if (path.length < 2) {
    log.error("conversion", "Invalid path: requires at least 2 nodes");
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
        log.error("conversion", `No handler found for path segment ${i}`, { pathIndex: i });
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
          log.trackHandler(handler.name, true);
        } catch (initError) {
          log.trackHandler(handler.name, false);
          log.warn("conversion", `Handler "${handler.name}" initialization failed at step ${i}`, { error: initError instanceof Error ? initError.message : String(initError) });
          return null;
        }
        if (handler.supportedFormats) {
          window.supportedFormatCache.set(handler.name, handler.supportedFormats);
          supportedFormats = handler.supportedFormats;
        }
      }

      if (!supportedFormats) {
        log.error("conversion", `Handler "${handler.name}" doesn't support any formats`);
        return null;
      }

      const inputFormat = supportedFormats.find(f => f.mime === currentNode.format.mime && f.from);
      if (!inputFormat) {
        log.error("conversion", `No valid input format found for ${currentNode.format.mime}`, { mime: currentNode.format.mime });
        return null;
      }

      const [convertedFiles] = await Promise.all([
        handler.doConvert(files, inputFormat, nextNode.format),
        new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      ]);

      if (!Array.isArray(convertedFiles) || convertedFiles.some(file => !file.bytes?.length)) {
        log.warn("conversion", `Conversion produced empty output at step ${i}`, { handler: handler.name });
        showBusyPopup("Finding conversion route", "This path failed. Looking for a valid route…");
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return null;
      }

      files = convertedFiles;
    }

    return { files, path };
  } catch (error) {
    log.error("conversion", "Conversion path failed", error instanceof Error ? error : undefined, {
      pathLength: path.length,
      handler: path[path.length - 1]?.handler?.name
    });
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
    const attempt = await attemptConvertPath(files, path, from.format, to.format, Date.now());
    if (attempt) return attempt;
  }
  return null;
};

function downloadFile(bytes: Uint8Array, name: string, mime: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const objectURL = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectURL;
  link.download = name;
  link.style.display = "none";

  try {
    document.body.appendChild(link);
    link.click();
  } catch (error) {
    console.error("Failed to download file:", error);
    showErrorPopup(`Failed to download "${name}". Please try again.`);
  } finally {
    // Use setTimeout to ensure the download starts before cleanup
    setTimeout(() => {
      URL.revokeObjectURL(objectURL);
      link.remove();
    }, 100);
  }
}

ui.convertButton.onclick = async function () {

  if (ui.convertButton.disabled) {
    log.trackInteraction("convert_attempt", false);
    return;
  }

  log.trackInteraction("convert_attempt");

  const inputFiles = selectedFiles;

  if (inputFiles.length === 0) {
    log.trackInteraction("convert_no_files", false);
    showErrorPopup("Select an input file.");
    return;
  }

  const fileValidationError = validateSelectedFiles(inputFiles);
  if (fileValidationError) {
    log.trackInteraction("convert_validation_failed", false);
    showErrorPopup(fileValidationError, "Upload limit reached");
    return;
  }

  const inputButton = ui.inputList.querySelector("button.selected");
  if (!(inputButton instanceof HTMLButtonElement)) {
    log.trackInteraction("convert_no_input_format", false);
    showErrorPopup("Specify input file format.");
    return;
  }

  const outputButton = ui.outputList.querySelector("button.selected");
  if (!(outputButton instanceof HTMLButtonElement)) {
    log.trackInteraction("convert_no_output_format", false);
    showErrorPopup("Specify output file format.");
    return;
  }

  const inputIndex = Number.parseInt(inputButton.getAttribute("format-index") || "", 10);
  const outputIndex = Number.parseInt(outputButton.getAttribute("format-index") || "", 10);

  const inputOption = allOptions[inputIndex];
  const outputOption = allOptions[outputIndex];

  if (!inputOption || !outputOption) {
    log.trackInteraction("convert_invalid_format", false);
    showErrorPopup("Selected formats are unavailable. Please reselect formats and try again.");
    return;
  }

  const inputFormat = inputOption.format;
  const outputFormat = outputOption.format;
  const conversionStartTime = Date.now();
  const totalFileSize = inputFiles.reduce((sum, f) => sum + f.size, 0);

  log.trackConversion.attempt(inputFormat.format, outputFormat.format, inputFiles.length, totalFileSize);

  try {
    releasePersistentDownloadUrls();

    const inputFileData: FileData[] = [];
    for (const inputFile of inputFiles) {
      const inputBuffer = await inputFile.arrayBuffer();
      const inputBytes = new Uint8Array(inputBuffer);
      inputFileData.push({ name: inputFile.name, bytes: inputBytes });
    }

    if (inputFormat.mime === outputFormat.mime) {
      const duration = Date.now() - conversionStartTime;
      log.trackConversion.success(inputFormat.format, outputFormat.format, duration, inputFiles.length, totalFileSize, "direct");
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
      log.trackConversion.failure(inputFormat.format, outputFormat.format, "no_route_found", inputFiles.length);
      log.trackInteraction("convert_no_route", false);
      showErrorPopup("Failed to find a valid conversion route. Try another target format or switch conversion mode.", "No route found");
      return;
    }

    const duration = Date.now() - conversionStartTime;
    const handlerName = output.path[output.path.length - 1]?.handler?.name;
    log.trackConversion.success(inputFormat.format, outputFormat.format, duration, inputFiles.length, totalFileSize, handlerName);

    for (const file of output.files) {
      downloadFile(file.bytes, file.name, outputFormat.mime);
    }

    showConversionSuccessPopup(inputFormat, outputFormat, output.path, output.files, outputFormat.mime);
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "unknown";
    log.trackConversion.failure(inputFormat.format, outputFormat.format, errorType, inputFiles.length);
    log.trackInteraction("convert_error", false, error instanceof Error ? error : undefined);
    const errorText = error instanceof Error ? error.message : String(error);
    showErrorPopup(`Unexpected error while converting: ${errorText}`, "Conversion failed");
  }

};

updateConvertButtonState();
