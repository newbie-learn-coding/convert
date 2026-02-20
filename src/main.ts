import { ConvertPathNode, type FileFormat, type FileData, type FormatHandler } from "./FormatHandler.js";
import normalizeMimeType from "./normalizeMimeType.js";
import handlers from "./handlers";
import { TraversionGraph } from "./TraversionGraph.js";
import { initPWA } from "./pwa.js";
import "./pwa.css";
import { validateFileSignature, getFileExtension, type FileFormatInfo } from "./fileValidator.js";
import { initPerformanceTracking } from "./performance.js";
import { initLogging, log, LOG_ENDPOINT } from "./logging.js";

/** Initialize logging and performance tracking early for accurate metrics */
initLogging();
initPerformanceTracking({
  reportEndpoint: LOG_ENDPOINT,
  debug: Boolean(import.meta.env?.DEV)
});

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
  fileAreaIcon: document.querySelector("#file-area-icon") as HTMLSpanElement,
  fileAreaTitle: document.querySelector("#file-area-title") as HTMLHeadingElement,
  dropHintText: document.querySelector("#drop-hint-text") as HTMLParagraphElement,
  fileSelectionStatus: document.querySelector("#file-selection-status") as HTMLParagraphElement,
  inputCategoryTabs: document.querySelector("#from-category-tabs") as HTMLDivElement,
  outputCategoryTabs: document.querySelector("#to-category-tabs") as HTMLDivElement,
  convertButton: document.querySelector("#convert-button") as HTMLButtonElement,
  convertHelperText: document.querySelector("#convert-helper") as HTMLParagraphElement,
  quickConversionsPanel: document.querySelector("#quick-conversions") as HTMLDivElement,
  quickConversionList: document.querySelector("#quick-conversion-list") as HTMLDivElement,
  quickConversionEmpty: document.querySelector("#quick-conversion-empty") as HTMLParagraphElement,
  pathPreview: document.querySelector("#conversion-path-preview") as HTMLDivElement,
  pathPreviewSummary: document.querySelector("#conversion-path-summary") as HTMLParagraphElement,
  pathPreviewPills: document.querySelector("#conversion-path-pills") as HTMLDivElement,
  modeToggleButton: document.querySelector("#mode-button") as HTMLButtonElement,
  workflowSteps: {
    file: document.querySelector('[data-workflow-step="file"]') as HTMLSpanElement,
    formats: document.querySelector('[data-workflow-step="formats"]') as HTMLSpanElement,
    convert: document.querySelector('[data-workflow-step="convert"]') as HTMLSpanElement
  },
  inputList: document.querySelector("#from-list") as HTMLDivElement,
  outputList: document.querySelector("#to-list") as HTMLDivElement,
  inputSearch: document.querySelector("#search-from") as HTMLInputElement,
  outputSearch: document.querySelector("#search-to") as HTMLInputElement,
  popupBox: document.querySelector("#popup") as HTMLDivElement,
  popupBackground: document.querySelector("#popup-bg") as HTMLDivElement
};

const POPUP_TONE_CLASSES = ["popup-error", "popup-success", "popup-busy"];
const persistentDownloadUrls: string[] = [];
let popupReturnFocus: HTMLElement | null = null;

const allOptions: Array<{ format: FileFormat, handler: FormatHandler }> = [];
const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  image: "Image",
  video: "Video",
  audio: "Audio",
  document: "Document",
  text: "Text",
  archive: "Archive",
  code: "Code",
  other: "Other"
};
const listFilterStates = new WeakMap<HTMLDivElement, {
  query: string;
  category: string;
  allowedMimes: Set<string> | null;
}>();
let recommendedOutputMimes: Set<string> = new Set();
let pathPreviewRequestToken = 0;

type WorkflowStepKey = "file" | "formats" | "convert";
type WorkflowState = "pending" | "active" | "complete";

function setWorkflowStepState(step: WorkflowStepKey, state: WorkflowState): void {
  const element = ui.workflowSteps[step];
  if (!(element instanceof HTMLSpanElement)) return;

  element.classList.toggle("is-active", state === "active");
  element.classList.toggle("is-complete", state === "complete");
  element.dataset.state = state;
  if (state === "active") {
    element.setAttribute("aria-current", "step");
  } else {
    element.removeAttribute("aria-current");
  }
}

function updateWorkflowProgress(hasFiles: boolean, hasInput: boolean, hasOutput: boolean, canConvert: boolean): void {
  setWorkflowStepState("file", hasFiles ? "complete" : "active");
  if (!hasFiles) {
    setWorkflowStepState("formats", "pending");
    setWorkflowStepState("convert", "pending");
    return;
  }

  const hasFormats = hasInput && hasOutput;
  setWorkflowStepState("formats", hasFormats ? "complete" : "active");
  if (!hasFormats) {
    setWorkflowStepState("convert", "pending");
    return;
  }

  setWorkflowStepState("convert", canConvert ? "complete" : "active");
}

function setFormatButtonSelection(button: HTMLButtonElement, isSelected: boolean): void {
  button.classList.toggle("selected", isSelected);
  button.setAttribute("aria-pressed", isSelected ? "true" : "false");
}

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

function getFormatCategories(format: FileFormat): string[] {
  const base = format.mime.split("/")[0] || "other";
  if (!format.category) return [base];
  const categories = Array.isArray(format.category) ? format.category : [format.category];
  return categories
    .map(category => category.trim().toLowerCase())
    .filter(category => category.length > 0);
}

function getPrimaryCategory(format: FileFormat): string {
  const categories = getFormatCategories(format);
  return categories[0] ?? "other";
}

function getListFilterState(list: HTMLDivElement): { query: string; category: string; allowedMimes: Set<string> | null } {
  let state = listFilterStates.get(list);
  if (!state) {
    state = { query: "", category: "all", allowedMimes: null };
    listFilterStates.set(list, state);
  }
  return state;
}

function getAllListButtons(list: HTMLDivElement): HTMLButtonElement[] {
  const virtualList = virtualLists.get(list);
  if (virtualList) {
    return virtualList.getAllOriginalButtons();
  }
  return Array.from(list.children).filter(
    child => child instanceof HTMLButtonElement
  ) as HTMLButtonElement[];
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

function setFileAreaState(hasFiles: boolean): void {
  ui.fileSelectArea.classList.toggle("has-files", hasFiles);
  ui.fileSelectArea.classList.toggle("is-ready", hasFiles);
  ui.fileAreaIcon.textContent = hasFiles ? "✓" : "⇪";
}

function renderSelectedFiles(files: File[]) {
  const primaryName = files[0].name;
  ui.fileAreaTitle.textContent = primaryName;
  if (files.length > 1) {
    ui.dropHintText.textContent = `${files.length} files selected`;
    ui.fileSelectionStatus.textContent = `${files.length} files ready. Next: choose input and output formats.`;
  } else {
    ui.dropHintText.textContent = "Ready. Next: choose input and output formats.";
    ui.fileSelectionStatus.textContent = `1 file selected: ${primaryName}.`;
  }
  setFileAreaState(true);
}

function getSelectedFormatButton(list: HTMLDivElement): HTMLButtonElement | null {
  const virtualList = virtualLists.get(list);
  if (virtualList) {
    for (const button of virtualList.getAllOriginalButtons()) {
      if (button.classList.contains("selected")) return button;
    }
    return null;
  }
  const selected = list.querySelector("button.selected");
  return selected instanceof HTMLButtonElement ? selected : null;
}

function updateConvertButtonState(): void {
  const selectedInput = getSelectedFormatButton(ui.inputList);
  const selectedOutput = getSelectedFormatButton(ui.outputList);

  let disabledReason = "Ready to convert.";
  let enabled = true;
  const hasFiles = selectedFiles.length > 0;
  const hasInput = selectedInput instanceof HTMLButtonElement;
  const hasOutput = selectedOutput instanceof HTMLButtonElement;

  if (!hasFiles) {
    enabled = false;
    disabledReason = "Step 1 of 3: choose at least one file.";
  } else if (!hasInput) {
    enabled = false;
    disabledReason = "Step 2 of 3: select the source format in \"Convert from\".";
  } else if (!hasOutput) {
    enabled = false;
    disabledReason = "Step 2 of 3: select the target format in \"Convert to\".";
  } else {
    disabledReason = "Step 3 of 3: ready to convert.";
  }

  ui.convertButton.disabled = !enabled;
  ui.convertButton.classList.toggle("disabled", !enabled);
  ui.convertButton.setAttribute("aria-disabled", enabled ? "false" : "true");
  ui.convertHelperText.textContent = disabledReason;
  updateWorkflowProgress(hasFiles, hasInput, hasOutput, enabled);
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
 * Throttle function for scroll events.
 * Ensures function is called at most once per wait period.
 */
function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  let rafId: number | null = null;

  return (...args: Parameters<T>) => {
    const now = performance.now();
    const elapsed = now - lastTime;

    if (elapsed >= wait) {
      lastTime = now;
      func(...args);
    } else if (!rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        lastTime = performance.now();
        func(...args);
      });
    }
  };
}

/**
 * Virtual list manager for format lists.
 * Handles efficient rendering of large lists by only showing visible items.
 * Supports 1000+ items with smooth 60fps scrolling.
 * Optimized with Intersection Observer for lazy loading and throttled scroll handling.
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
  private intersectionObserver: IntersectionObserver | null = null;
  private filterQuery: string = "";
  private categoryFilter = "all";
  private allowedMimes: Set<string> | null = null;
  private rafId: number | null = null;
  private scrollContainer: HTMLDivElement | null = null;
  private contentContainer: HTMLDivElement | null = null;
  private spacer: HTMLDivElement | null = null;
  private isVisible = true;
  private throttledScrollHandler: (() => void) | null = null;

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
      contain: layout style paint;
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
      will-change: transform;
    `;

    this.scrollContainer.appendChild(this.spacer);
    this.scrollContainer.appendChild(this.contentContainer);
    this.container.appendChild(this.scrollContainer);

    // Set up throttled scroll handler for better performance
    this.throttledScrollHandler = throttle(() => {
      this.handleScroll();
    }, 16); // Throttle to ~60fps

    // Set up scroll listener with passive for better performance
    this.scrollContainer.addEventListener("scroll", this.throttledScrollHandler, { passive: true });

    // Set up Intersection Observer for lazy loading
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          this.isVisible = entry.isIntersecting;
          if (this.isVisible) {
            this.scheduleUpdate();
          }
        }
      },
      { root: null, rootMargin: "100px", threshold: 0 }
    );
    this.intersectionObserver.observe(this.scrollContainer);

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
    // Skip updates if not visible (lazy loading optimization)
    if (!this.isVisible) return;

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

    // Use DocumentFragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    const elementsToAdd: HTMLButtonElement[] = [];

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
        elementsToAdd.push(button);
        fragment.appendChild(button);
      } else {
        const originalIndex = this.filteredIndices[i];
        if (originalIndex === undefined) continue;

        const button = renderedMap.get(i);
        if (!button) continue;

        const originalButton = this.originalButtons[originalIndex];
        if (!originalButton) continue;

        const expectedFormatIndex = originalButton.getAttribute("format-index");
        if (button.getAttribute("format-index") !== expectedFormatIndex) {
          this.populatePooledElement(button, originalButton);
        }
        button.style.transform = `translateY(${i * this.itemHeight}px)`;
        button.style.position = "absolute";
        button.style.left = "0";
        button.style.right = "0";
        button.setAttribute("data-virtual-index", i.toString());
      }
    }

    // Batch append all new elements
    if (elementsToAdd.length > 0) {
      this.contentContainer.appendChild(fragment);
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

    this.populatePooledElement(element, originalButton);

    return element;
  }

  private populatePooledElement(element: HTMLButtonElement, originalButton: HTMLButtonElement): void {
    // Clear stale attributes from previous pool usage
    for (const attr of Array.from(element.attributes)) {
      if (attr.name !== "style" && attr.name !== "data-virtual-index") {
        element.removeAttribute(attr.name);
      }
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
    element.setAttribute("aria-pressed", isSelected ? "true" : "false");
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
    const query = this.filterQuery.toLowerCase();
    const hasQuery = query.length > 0;

    this.filteredIndices = this.originalButtons
      .map((button, index) => ({ button, index }))
      .filter(({ button }) => {
        if (this.categoryFilter !== "all" && button.getAttribute("data-category") !== this.categoryFilter) {
          return false;
        }

        if (this.allowedMimes && !this.allowedMimes.has(button.getAttribute("mime-type") ?? "")) {
          return false;
        }

        if (!hasQuery) return true;

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

  setCategoryFilter(category: string): void {
    this.categoryFilter = category;
    this.updateFilteredIndices();
    this.scheduleUpdate();
  }

  setAllowedMimes(allowedMimes: Set<string> | null): void {
    this.allowedMimes = allowedMimes;
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
        const nextFormatIndex = Number.parseInt(nextButton.getAttribute("format-index") || "", 10);
        if (!Number.isFinite(nextFormatIndex)) return false;
        selectFormatInList(this.container, nextFormatIndex);

        // Ensure the newly selected item is visible
        this.scrollToFormat(
          nextFormatIndex,
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
          this.populatePooledElement(child, original);
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

  getAllOriginalButtons(): HTMLButtonElement[] {
    return [...this.originalButtons];
  }

  getFilteredCount(): number {
    return this.filteredIndices.length;
  }

  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.throttledScrollHandler && this.scrollContainer) {
      this.scrollContainer.removeEventListener("scroll", this.throttledScrollHandler);
      this.throttledScrollHandler = null;
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

function isButtonVisibleForState(
  button: HTMLButtonElement,
  state: { query: string; category: string; allowedMimes: Set<string> | null }
): boolean {
  if (state.category !== "all" && button.getAttribute("data-category") !== state.category) {
    return false;
  }

  if (state.allowedMimes && !state.allowedMimes.has(button.getAttribute("mime-type") ?? "")) {
    return false;
  }

  if (!state.query) return true;

  const formatIndex = button.getAttribute("format-index");
  let hasExtension = false;
  if (formatIndex) {
    const format = allOptions[Number.parseInt(formatIndex, 10)];
    hasExtension = format?.format.extension.toLowerCase().includes(state.query) ?? false;
  }
  const hasText = button.textContent?.toLowerCase().includes(state.query) ?? false;
  return hasExtension || hasText;
}

function applyListFilters(list: HTMLDivElement): void {
  const state = getListFilterState(list);
  const virtualList = virtualLists.get(list);
  if (virtualList) {
    virtualList.filter(state.query);
    virtualList.setCategoryFilter(state.category);
    virtualList.setAllowedMimes(state.allowedMimes);
    virtualList.syncSelection();
    return;
  }

  for (const button of getAllListButtons(list)) {
    button.classList.toggle("hidden", !isButtonVisibleForState(button, state));
  }
}

function setListQueryFilter(list: HTMLDivElement, query: string): void {
  const state = getListFilterState(list);
  state.query = query.toLowerCase().trim();
  applyListFilters(list);
}

function setListCategoryFilter(list: HTMLDivElement, category: string): void {
  const state = getListFilterState(list);
  state.category = category;
  applyListFilters(list);
}

function setListAllowedMimeFilter(list: HTMLDivElement, allowedMimes: Set<string> | null): void {
  const state = getListFilterState(list);
  state.allowedMimes = allowedMimes;
  applyListFilters(list);
}

function getButtonByFormatIndex(list: HTMLDivElement, formatIndex: number): HTMLButtonElement | undefined {
  const virtualList = virtualLists.get(list);
  if (virtualList) {
    return virtualList.getOriginalButton(formatIndex);
  }
  return getAllListButtons(list).find(button => button.getAttribute("format-index") === formatIndex.toString());
}

function getSelectedOption(list: HTMLDivElement): { button: HTMLButtonElement; option: { format: FileFormat; handler: FormatHandler }; index: number } | null {
  const button = getSelectedFormatButton(list);
  if (!button) return null;
  const formatIndex = Number.parseInt(button.getAttribute("format-index") || "", 10);
  if (!Number.isFinite(formatIndex)) return null;
  const option = allOptions[formatIndex];
  if (!option) return null;
  return { button, option, index: formatIndex };
}

function renderCategoryTabs(container: HTMLDivElement, list: HTMLDivElement): void {
  const state = getListFilterState(list);
  const currentCategory = state.category;
  const categories = new Set<string>();
  for (const button of getAllListButtons(list)) {
    categories.add(button.getAttribute("data-category") || "other");
  }

  const ordered = Object.keys(CATEGORY_LABELS)
    .filter(category => category !== "all" && categories.has(category));
  const additional = [...categories]
    .filter(category => !ordered.includes(category))
    .sort((a, b) => a.localeCompare(b));
  const tabs = ["all", ...ordered, ...additional];
  if (!tabs.includes(currentCategory)) {
    state.category = "all";
  }
  container.hidden = tabs.length <= 1;

  container.innerHTML = "";
  for (const category of tabs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-tab";
    button.textContent = CATEGORY_LABELS[category] ?? category;
    button.setAttribute("data-category", category);
    const isActive = category === state.category;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.addEventListener("click", () => {
      setListCategoryFilter(list, category);
      renderCategoryTabs(container, list);
      renderQuickConversionsPanel();
      schedulePathPreview();
    });
    container.appendChild(button);
  }
}

function markRecommendedOutputs(recommendedMimes: Set<string>): void {
  recommendedOutputMimes = recommendedMimes;
  for (const button of getAllListButtons(ui.outputList)) {
    const mimeType = button.getAttribute("mime-type") ?? "";
    const isRecommended = recommendedMimes.has(mimeType);
    button.toggleAttribute("data-recommended", isRecommended);
    if (isRecommended) {
      button.setAttribute("data-recommended-label", "Recommended");
    } else {
      button.removeAttribute("data-recommended-label");
    }
  }

  const outputVirtual = virtualLists.get(ui.outputList);
  outputVirtual?.syncSelection();
}

function updateOutputAvailability(): void {
  const selectedInput = getSelectedOption(ui.inputList);
  if (!selectedInput) {
    setListAllowedMimeFilter(ui.outputList, null);
    markRecommendedOutputs(new Set());
    return;
  }

  const inputMime = selectedInput.option.format.mime;
  const reachable = window.traversionGraph.getReachableOutputMimes(inputMime);
  const recommended = window.traversionGraph.getRecommendedOutputMimes(inputMime);

  setListAllowedMimeFilter(ui.outputList, reachable);
  markRecommendedOutputs(recommended);

  const selectedOutputButton = getSelectedFormatButton(ui.outputList);
  if (selectedOutputButton) {
    const selectedMime = selectedOutputButton.getAttribute("mime-type") ?? "";
    if (!reachable.has(selectedMime)) {
      setFormatButtonSelection(selectedOutputButton, false);
      virtualLists.get(ui.outputList)?.syncSelection();
    }
  }
}

function renderQuickConversionsPanel(): void {
  const hasFiles = selectedFiles.length > 0;
  ui.quickConversionsPanel.hidden = !hasFiles;
  ui.quickConversionsPanel.classList.toggle("is-visible", hasFiles);
  if (!hasFiles) {
    ui.quickConversionList.innerHTML = "";
    return;
  }

  const selectedInput = getSelectedOption(ui.inputList);
  if (!selectedInput) {
    ui.quickConversionList.innerHTML = "";
    ui.quickConversionEmpty.hidden = false;
    ui.quickConversionEmpty.textContent = "Select an input format to get one-tap conversion suggestions.";
    return;
  }

  const inputExt = formatOptionExtension(selectedInput.option.format);
  const seenMimes = new Set<string>();
  const preferred: HTMLButtonElement[] = [];
  const fallback: HTMLButtonElement[] = [];
  const outputFilterState = getListFilterState(ui.outputList);

  for (const button of getAllListButtons(ui.outputList)) {
    const mime = button.getAttribute("mime-type") ?? "";
    if (!mime || mime === selectedInput.option.format.mime || seenMimes.has(mime)) continue;
    if (!isButtonVisibleForState(button, outputFilterState)) continue;
    seenMimes.add(mime);

    if (recommendedOutputMimes.has(mime)) {
      preferred.push(button);
    } else {
      fallback.push(button);
    }
  }

  const quickTargets = [...preferred, ...fallback].slice(0, 6);
  ui.quickConversionList.innerHTML = "";
  ui.quickConversionEmpty.hidden = quickTargets.length > 0;
  ui.quickConversionEmpty.textContent = "No quick suggestions for this format yet.";

  for (const target of quickTargets) {
    const formatIndex = target.getAttribute("format-index");
    if (!formatIndex) continue;
    const option = allOptions[Number.parseInt(formatIndex, 10)];
    if (!option) continue;

    const quickButton = document.createElement("button");
    quickButton.type = "button";
    quickButton.className = "quick-conversion-button";
    quickButton.setAttribute("data-format-index", formatIndex);
    quickButton.innerHTML = [
      `<span class="quick-conversion-route">${escapeHtml(inputExt)} → ${escapeHtml(formatOptionExtension(option.format))}</span>`,
      `<span class="quick-conversion-meta">${escapeHtml(cleanFormatName(option.format.name))}</span>`,
      `<span class="quick-conversion-badge ${option.format.lossless ? "is-lossless" : "is-lossy"}">${option.format.lossless ? "Lossless" : "Lossy"}</span>`
    ].join("");
    ui.quickConversionList.appendChild(quickButton);
  }
}

function renderPathPreview(path: ConvertPathNode[] | null, details: string): void {
  if (!path || path.length === 0) {
    ui.pathPreview.hidden = true;
    ui.pathPreviewPills.innerHTML = "";
    ui.pathPreviewSummary.textContent = "";
    return;
  }

  const isLossyPath = path.slice(1).some(step => !step.format.lossless);
  ui.pathPreview.hidden = false;
  ui.pathPreview.classList.toggle("is-lossy", isLossyPath);
  ui.pathPreviewSummary.textContent = details;
  ui.pathPreviewPills.innerHTML = "";

  path.forEach((step, index) => {
    const pill = document.createElement("span");
    pill.className = "path-pill";
    if (index > 0 && !step.format.lossless) {
      pill.classList.add("is-lossy");
    }
    pill.textContent = formatOptionExtension(step.format);
    ui.pathPreviewPills.appendChild(pill);
  });
}

async function updatePathPreviewNow(): Promise<void> {
  const selectedInput = getSelectedOption(ui.inputList);
  const selectedOutput = getSelectedOption(ui.outputList);
  if (!selectedInput || !selectedOutput) {
    renderPathPreview(null, "");
    return;
  }

  const requestToken = ++pathPreviewRequestToken;

  if (selectedInput.option.format.mime === selectedOutput.option.format.mime) {
    renderPathPreview(
      [new ConvertPathNode(selectedInput.option.handler, selectedInput.option.format)],
      "Same-format route: no conversion step needed."
    );
    return;
  }

  let previewPath: ConvertPathNode[] | null = null;
  for await (const path of window.traversionGraph.searchPath(selectedInput.option, selectedOutput.option, simpleMode)) {
    previewPath = path;
    break;
  }

  if (requestToken !== pathPreviewRequestToken) return;
  if (!previewPath) {
    renderPathPreview(null, "");
    return;
  }

  const steps = Math.max(0, previewPath.length - 1);
  const isLossyPath = previewPath.slice(1).some(step => !step.format.lossless);
  renderPathPreview(
    previewPath,
    `${steps} step${steps === 1 ? "" : "s"} • ${isLossyPath ? "lossy route" : "lossless-preferred route"}`
  );
}

const schedulePathPreview = debounce(() => {
  void updatePathPreviewNow();
}, 220);

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
  setListQueryFilter(targetList, query);
  renderQuickConversionsPanel();
  setSearchLoading(inputElement, false);
}

/**
 * Handles search box input with debouncing.
 * Uses 300ms delay for optimal UX and performance.
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
      300 // 300ms debounce for optimal performance
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

ui.quickConversionList.addEventListener("click", event => {
  const target = event.target;
  const quickButton = target instanceof HTMLButtonElement
    ? target
    : (target instanceof HTMLElement ? target.closest("button.quick-conversion-button") : null);
  if (!(quickButton instanceof HTMLButtonElement)) return;

  const formatIndex = Number.parseInt(quickButton.getAttribute("data-format-index") || "", 10);
  if (!Number.isFinite(formatIndex)) return;

  selectFormatInList(ui.outputList, formatIndex);
});

function selectFormatInList(list: HTMLDivElement, formatIndex: number): boolean {
  const virtualList = virtualLists.get(list);
  const originalButton = getButtonByFormatIndex(list, formatIndex);
  if (!originalButton) return false;

  if (virtualList) {
    for (const button of virtualList.getAllOriginalButtons()) {
      setFormatButtonSelection(button, false);
    }
  } else {
    const previous = list.querySelector("button.selected");
    if (previous instanceof HTMLButtonElement) {
      setFormatButtonSelection(previous, false);
    }
  }

  setFormatButtonSelection(originalButton, true);
  virtualList?.syncSelection();

  if (list === ui.inputList) {
    updateOutputAvailability();
  }

  renderQuickConversionsPanel();
  schedulePathPreview();
  updateConvertButtonState();
  return true;
}

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

  const list = parent?.closest(".format-list") as HTMLDivElement | null;
  if (!list) return;
  selectFormatInList(list, Number.parseInt(formatIndex, 10));
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

ui.fileSelectArea.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  ui.fileInput.click();
});

function renderPopupHtml(html: string, tone: "info" | "error" | "success" = "info", busy = false): void {
  if (ui.popupBox.hidden) {
    const activeElement = document.activeElement;
    popupReturnFocus = activeElement instanceof HTMLElement ? activeElement : null;
  }

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

  const focusTarget = ui.popupBox.querySelector("[data-popup-dismiss]") as HTMLElement | null;
  if (focusTarget) {
    focusTarget.focus();
  } else {
    ui.popupBox.setAttribute("tabindex", "-1");
    ui.popupBox.focus();
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
  ui.popupBox.removeAttribute("tabindex");

  if (popupReturnFocus instanceof HTMLElement && document.contains(popupReturnFocus)) {
    popupReturnFocus.focus();
  }
  popupReturnFocus = null;
};

ui.popupBackground.addEventListener("click", () => {
  if (!ui.popupBox.classList.contains("popup-busy")) {
    window.hidePopup();
  }
});

window.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (ui.popupBox.hidden || ui.popupBox.classList.contains("popup-busy")) return;
  event.preventDefault();
  window.hidePopup();
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
    for (const btn of inputVirtual.getAllOriginalButtons()) {
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
    const formatIndex = Number.parseInt(buttonMimeType.getAttribute("format-index") || "", 10);
    if (Number.isFinite(formatIndex)) {
      selectFormatInList(ui.inputList, formatIndex);
    }
    ui.inputSearch.value = mimeType;
    setListQueryFilter(ui.inputList, ui.inputSearch.value);
    if (inputVirtual) inputVirtual.syncSelection();
    window.hidePopup();
    return;
  }

  // Fall back to matching format by detected file extension if MIME type wasn't found.
  const fileExtension = detectedExtension;

  let buttonExtension: HTMLButtonElement | undefined;

  if (inputVirtual) {
    for (const btn of inputVirtual.getAllOriginalButtons()) {
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
    const formatIndex = Number.parseInt(buttonExtension.getAttribute("format-index") || "", 10);
    if (Number.isFinite(formatIndex)) {
      selectFormatInList(ui.inputList, formatIndex);
    }
    ui.inputSearch.value = buttonExtension.getAttribute("mime-type") || "";
  } else {
    ui.inputSearch.value = fileExtension || "";
  }

  setListQueryFilter(ui.inputList, ui.inputSearch.value);
  window.hidePopup();

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

function createFormatBadge(className: string, text: string): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = className;
  badge.appendChild(document.createTextNode(text));
  return badge;
}

function createFormatOptionButton(format: FileFormat, handler: FormatHandler, formatIndex: number): HTMLButtonElement {
  const newOption = document.createElement("button");
  newOption.type = "button";
  newOption.setAttribute("format-index", formatIndex.toString());
  newOption.setAttribute("mime-type", format.mime);
  newOption.setAttribute("aria-pressed", "false");

  const categories = getFormatCategories(format);
  const primaryCategory = getPrimaryCategory(format);
  newOption.setAttribute("data-category", primaryCategory);
  newOption.setAttribute("data-categories", categories.join(","));
  newOption.setAttribute("data-lossless", format.lossless ? "true" : "false");

  const extensionLabel = formatOptionExtension(format);
  const readableName = simpleMode ? cleanFormatName(format.name) : format.name;
  const supportingDetails = simpleMode ? format.mime : `${format.mime} • ${handler.name}`;

  newOption.setAttribute(
    "aria-label",
    `Format ${extensionLabel}, ${readableName}, MIME ${format.mime}${simpleMode ? "" : `, handler ${handler.name}`}`
  );

  const meta = document.createElement("span");
  meta.className = "format-meta";
  const iconSlot = document.createElement("span");
  iconSlot.className = "format-icon-slot";
  iconSlot.setAttribute("aria-hidden", "true");
  meta.appendChild(iconSlot);

  const badges = document.createElement("span");
  badges.className = "format-badges";
  badges.appendChild(
    createFormatBadge(
      `format-badge ${format.lossless ? "format-badge-lossless" : "format-badge-lossy"}`,
      format.lossless ? "Lossless" : "Lossy"
    )
  );
  badges.appendChild(createFormatBadge("format-badge format-badge-category", CATEGORY_LABELS[primaryCategory] ?? primaryCategory));
  meta.appendChild(badges);

  newOption.appendChild(createFormatLabelSpan("format-label-primary", extensionLabel));
  newOption.appendChild(createFormatLabelSpan("format-label-secondary", readableName));
  newOption.appendChild(createFormatLabelSpan("format-label-mime", supportingDetails));
  newOption.appendChild(meta);

  return newOption;
}

function getListedSupportedFormats(handler: FormatHandler): FileFormat[] | undefined {
  if (!Array.isArray(handler.supportedFormats) || handler.supportedFormats.length === 0) {
    return undefined;
  }
  return handler.supportedFormats;
}

async function resolveSupportedFormatsForListing(handler: FormatHandler): Promise<FileFormat[] | undefined> {
  const cachedFormats = window.supportedFormatCache.get(handler.name);
  if (cachedFormats && cachedFormats.length > 0) {
    return cachedFormats;
  }

  const listedFormats = getListedSupportedFormats(handler);
  if (listedFormats) {
    if (!cachedFormats) {
      log.debug("handler", `Using advertised formats for handler "${handler.name}"`);
    }
    window.supportedFormatCache.set(handler.name, listedFormats);
    return listedFormats;
  }

  log.debug("handler", `Cache miss for formats of handler "${handler.name}"`);
  try {
    await handler.init();
    log.trackHandler(handler.name, true);
  } catch (initError) {
    log.trackHandler(handler.name, false);
    log.error("handler", `Initialization failed for "${handler.name}"`, initError instanceof Error ? initError : undefined);
    return undefined;
  }

  const initializedFormats = getListedSupportedFormats(handler);
  if (initializedFormats) {
    window.supportedFormatCache.set(handler.name, initializedFormats);
    log.debug("handler", `Updated supported format cache for "${handler.name}"`);
  }
  return initializedFormats;
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
    const supportedFormats = await resolveSupportedFormatsForListing(handler);
    if (!supportedFormats || supportedFormats.length === 0) {
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

      const newOption = createFormatOptionButton(format, handler, allOptions.length - 1);

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

  renderCategoryTabs(ui.inputCategoryTabs, ui.inputList);
  renderCategoryTabs(ui.outputCategoryTabs, ui.outputList);

  setListQueryFilter(ui.inputList, ui.inputSearch.value);
  setListQueryFilter(ui.outputList, ui.outputSearch.value);
  setListAllowedMimeFilter(ui.outputList, null);
  updateOutputAvailability();
  renderQuickConversionsPanel();
  schedulePathPreview();
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
    ui.modeToggleButton.setAttribute("aria-label", "Switch to advanced mode");
    ui.modeToggleButton.setAttribute("aria-pressed", "false");
    document.body.style.setProperty("--highlight-color", "#1C77FF");
  } else {
    ui.modeToggleButton.textContent = "Simple mode";
    ui.modeToggleButton.setAttribute("aria-label", "Switch to simple mode");
    ui.modeToggleButton.setAttribute("aria-pressed", "true");
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

  const inputButton = getSelectedFormatButton(ui.inputList);
  if (!(inputButton instanceof HTMLButtonElement)) {
    log.trackInteraction("convert_no_input_format", false);
    showErrorPopup("Specify input file format.");
    return;
  }

  const outputButton = getSelectedFormatButton(ui.outputList);
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
  ui.convertButton.setAttribute("aria-busy", "true");
  ui.convertButton.classList.add("is-working");
  ui.convertButton.disabled = true;
  ui.convertButton.setAttribute("aria-disabled", "true");
  ui.convertHelperText.textContent = "Converting… keep this tab open.";

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
  } finally {
    ui.convertButton.removeAttribute("aria-busy");
    ui.convertButton.classList.remove("is-working");
    updateConvertButtonState();
  }

};

setFileAreaState(false);
renderQuickConversionsPanel();
updateConvertButtonState();
