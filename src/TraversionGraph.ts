import { ConvertPathNode, type FileFormat, type FormatHandler } from "./FormatHandler.ts";
import { PriorityQueue } from './PriorityQueue.ts';

interface QueueNode {
    index: number;
    cost: number;
    path: ConvertPathNode[];
    visitedBorder: number;
};
interface CategoryChangeCost {
    from: string;
    to: string;
    handler?: string; // Optional handler name to specify that this cost only applies when using a specific handler for the category change. If not specified, the cost applies to all handlers for that category change.
    cost: number;
};

interface CategoryAdaptiveCost {
    categories: string[]; // List of sequential categories
    cost: number; // Cost to apply when a conversion involves all of the specified categories in sequence.
}

interface CacheEntry {
    path: ConvertPathNode[];
    timestamp: number;
    hits: number;
}

interface PerformanceMetrics {
    cacheHits: number;
    cacheMisses: number;
    totalSearches: number;
    averageSearchTime: number;
    timeoutCount: number;
    longestSearch: number;
}

// LRU Cache implementation for conversion paths
class PathCache {
    private cache: Map<string, CacheEntry> = new Map();
    private maxSize: number;
    private metrics: PerformanceMetrics = {
        cacheHits: 0,
        cacheMisses: 0,
        totalSearches: 0,
        averageSearchTime: 0,
        timeoutCount: 0,
        longestSearch: 0
    };

    constructor(maxSize: number = 1000) {
        this.maxSize = maxSize;
    }

    private generateKey(fromMime: string, toMime: string, simpleMode: boolean): string {
        return `${fromMime}|${toMime}|${simpleMode}`;
    }

    get(fromMime: string, toMime: string, simpleMode: boolean): ConvertPathNode[] | null {
        const key = this.generateKey(fromMime, toMime, simpleMode);
        const entry = this.cache.get(key);

        if (entry) {
            entry.hits++;
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, entry);
            this.metrics.cacheHits++;
            return entry.path;
        }

        this.metrics.cacheMisses++;
        return null;
    }

    set(fromMime: string, toMime: string, simpleMode: boolean, path: ConvertPathNode[]): void {
        const key = this.generateKey(fromMime, toMime, simpleMode);

        // Evict oldest entry if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            path,
            timestamp: Date.now(),
            hits: 1
        });
    }

    recordSearch(duration: number, timedOut: boolean): void {
        this.metrics.totalSearches++;
        this.metrics.averageSearchTime =
            (this.metrics.averageSearchTime * (this.metrics.totalSearches - 1) + duration) /
            this.metrics.totalSearches;

        if (duration > this.metrics.longestSearch) {
            this.metrics.longestSearch = duration;
        }

        if (timedOut) {
            this.metrics.timeoutCount++;
        }
    }

    getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    getCacheSize(): number {
        return this.cache.size;
    }

    clear(): void {
        this.cache.clear();
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            totalSearches: 0,
            averageSearchTime: 0,
            timeoutCount: 0,
            longestSearch: 0
        };
    }

    getHitRate(): number {
        const total = this.metrics.cacheHits + this.metrics.cacheMisses;
        return total > 0 ? this.metrics.cacheHits / total : 0;
    }
}


// Parameters for pathfinding algorithm.
const DEPTH_COST: number = 1; // Base cost for each conversion step. Higher values will make the algorithm prefer shorter paths more strongly.
const DEFAULT_CATEGORY_CHANGE_COST : number = 0.6; // Default cost for category changes not specified in CATEGORY_CHANGE_COSTS
const LOSSY_COST_MULTIPLIER : number = 1.4; // Cost multiplier for lossy conversions. Higher values will make the algorithm prefer lossless conversions more strongly.
const HANDLER_PRIORITY_COST : number = 0.2; // Cost multiplier for handler priority. Higher values will make the algorithm prefer handlers with higher priority more strongly.
const FORMAT_PRIORITY_COST : number = 0.05; // Cost multiplier for format priority. Higher values will make the algorithm prefer formats with higher priority more strongly.

const LOG_FREQUENCY = 1000;
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_CACHE_SIZE = 1000;

export interface Node {
    mime: string;
    edges: Array<number>;
};

export interface Edge {
    from: {format: FileFormat, index: number};
    to: {format: FileFormat, index: number};
    handler: string;
    cost: number;
};

export type { PerformanceMetrics };

export class TraversionGraph {
    constructor(disableSafeChecks: boolean = false) {
        this.disableSafeChecks = disableSafeChecks;
    }
    private disableSafeChecks: boolean;
    private nodes: Node[] = [];
    private edges: Edge[] = [];
    private nodeIndexMap: Map<string, number> = new Map();
    private handlerMap: Map<string, FormatHandler> = new Map();
    private pathCache: PathCache = new PathCache(MAX_CACHE_SIZE);
    private searchTimeout: number = DEFAULT_TIMEOUT_MS;
    private categoryChangeCosts: CategoryChangeCost[] = [
        {from: "image", to: "video", cost: 0.2}, // Almost lossless
        {from: "video", to: "image", cost: 0.4}, // Potentially lossy and more complex
        {from: "image", to: "audio", handler: "ffmpeg", cost: 100}, // FFMpeg can't convert images to audio
        {from: "audio", to: "image", handler: "ffmpeg", cost: 100}, // FFMpeg can't convert audio to images
        {from: "text", to: "audio", handler: "ffmpeg", cost: 100}, // FFMpeg can't convert text to audio
        {from: "audio", to: "text", handler: "ffmpeg", cost: 100}, // FFMpeg can't convert audio to text
        {from: "image", to: "audio", cost: 1.4}, // Extremely lossy
        {from: "audio", to: "image", cost: 1}, // Very lossy
        {from: "video", to: "audio", cost: 1.4}, // Might be lossy 
        {from: "audio", to: "video", cost: 1}, // Might be lossy
        {from: "text", to: "image", cost: 0.5}, // Depends on the content and method, but can be relatively efficient for simple images
        {from: "image", to: "text", cost: 0.5}, // Depends on the content and method, but can be relatively efficient for simple images
    ];
    private categoryAdaptiveCosts: CategoryAdaptiveCost[] = [
        { categories: ["image", "video", "audio"], cost: 10000 }, // Converting from image to audio through video is especially lossy
        { categories: ["audio", "video", "image"], cost: 10000 }, // Converting from audio to image through video is especially lossy
    ];

    public addCategoryChangeCost(from: string, to: string, cost: number, handler?: string, updateIfExists: boolean = true) : boolean {
        if (this.hasCategoryChangeCost(from, to, handler)) {
            if (updateIfExists) {
                this.updateCategoryChangeCost(from, to, cost, handler)
                return true;
            }
            return false;
        }
        this.categoryChangeCosts.push({from, to, cost, handler: handler?.toLowerCase()});
        return true;
    }
    public removeCategoryChangeCost(from: string, to: string, handler?: string) : boolean {
        const initialLength = this.categoryChangeCosts.length;
        this.categoryChangeCosts = this.categoryChangeCosts.filter(c => !(c.from === from && c.to === to && c.handler === handler?.toLowerCase()));
        return this.categoryChangeCosts.length < initialLength;
    }
    public updateCategoryChangeCost(from: string, to: string, cost: number, handler?: string) {
        const costEntry = this.categoryChangeCosts.find(c => c.from === from && c.to === to && c.handler === handler?.toLowerCase());
        if (costEntry) costEntry.cost = cost;
        else this.addCategoryChangeCost(from, to, cost, handler);
    }
    public hasCategoryChangeCost(from: string, to: string, handler?: string) {
        return this.categoryChangeCosts.some(c => c.from === from && c.to === to && c.handler === handler?.toLowerCase());
    }


    public addCategoryAdaptiveCost(categories: string[], cost: number, updateIfExists: boolean = true) : boolean {
        if (this.hasCategoryAdaptiveCost(categories)) {
            if (updateIfExists) {
                this.updateCategoryAdaptiveCost(categories, cost);
                return true;
            }
            return false;
        }
        this.categoryAdaptiveCosts.push({categories, cost});
        return true;
    }
    public removeCategoryAdaptiveCost(categories: string[]) : boolean {
        const initialLength = this.categoryAdaptiveCosts.length;
        this.categoryAdaptiveCosts = this.categoryAdaptiveCosts.filter(c => !(c.categories.length === categories.length && c.categories.every((cat, index) => cat === categories[index])));
        return this.categoryAdaptiveCosts.length < initialLength;
    }
    public updateCategoryAdaptiveCost(categories: string[], cost: number) {
        const costEntry = this.categoryAdaptiveCosts.find(c => c.categories.length === categories.length && c.categories.every((cat, index) => cat === categories[index]));
        if (costEntry) costEntry.cost = cost;
        else this.addCategoryAdaptiveCost(categories, cost);
    }
    public hasCategoryAdaptiveCost(categories: string[]) {
        return this.categoryAdaptiveCosts.some(c => c.categories.length === categories.length && c.categories.every((cat, index) => cat === categories[index]));
    }

    /**
     * Initializes the traversion graph based on the supported formats and handlers. This should be called after all handlers have been registered and their supported formats have been cached in window.supportedFormatCache. The graph is built by creating nodes for each unique file format and edges for each possible conversion between formats based on the handlers' capabilities. 
     * @param strictCategories If true, the algorithm will apply category change costs more strictly, even when formats share categories. This can lead to more accurate pathfinding at the cost of potentially longer paths and increased search time. If false, category change costs will only be applied when formats do not share any categories, allowing for more flexible pathfinding that may yield shorter paths but with less nuanced cost calculations.
     */
    public init(supportedFormatCache: Map<string, FileFormat[]>, handlers: FormatHandler[], strictCategories: boolean = false) {
        this.nodes.length = 0;
        this.edges.length = 0;
        this.nodeIndexMap.clear();
        this.handlerMap.clear();
        this.pathCache.clear();

        console.log("Initializing traversion graph...");
        const startTime = performance.now();

        for (const handler of handlers) {
            this.handlerMap.set(handler.name, handler);
        }

        let handlerIndex = 0;
        supportedFormatCache.forEach((formats, handler) => {
            const fromIndices: Array<{format: FileFormat, index: number}> = [];
            const toIndices: Array<{format: FileFormat, index: number}> = [];

            for (const format of formats) {
                let index = this.nodeIndexMap.get(format.mime);
                if (index === undefined) {
                    index = this.nodes.length;
                    this.nodes.push({ mime: format.mime, edges: [] });
                    this.nodeIndexMap.set(format.mime, index);
                }
                if (format.from) fromIndices.push({format, index});
                if (format.to) toIndices.push({format, index});
            }

            const handlerLower = handler.toLowerCase();
            for (const from of fromIndices) {
                for (const to of toIndices) {
                    if (from.index === to.index) continue;
                    this.edges.push({
                        from: from,
                        to: to,
                        handler: handler,
                        cost: this.costFunction(
                            from,
                            to,
                            strictCategories,
                            handlerLower,
                            handlerIndex
                        )
                    });
                    this.nodes[from.index].edges.push(this.edges.length - 1);
                }
            }
            handlerIndex++;
        });
        const endTime = performance.now();
        console.log(`Traversion graph initialized in ${(endTime - startTime).toFixed(2)} ms with ${this.nodes.length} nodes and ${this.edges.length} edges.`);
    }
    /**
     * Cost function for calculating the cost of converting from one format to another using a specific handler.
     */
    private costFunction(
        from: { format: FileFormat; index: number; },
        to: { format: FileFormat; index: number; },
        strictCategories: boolean,
        handlerLower: string,
        handlerIndex: number
    ) {
        let cost = DEPTH_COST;

        const fromCategory = from.format.category || from.format.mime.split("/")[0];
        const toCategory = to.format.category || to.format.mime.split("/")[0];

        if (fromCategory && toCategory) {
            const fromCategories = Array.isArray(fromCategory) ? fromCategory : [fromCategory];
            const toCategories = Array.isArray(toCategory) ? toCategory : [toCategory];

            if (strictCategories) {
                let handlerSpecificCost: number | null = null;
                let genericCost: number | null = null;

                for (const c of this.categoryChangeCosts) {
                    if (fromCategories.includes(c.from) && toCategories.includes(c.to)) {
                        if (c.handler === handlerLower) {
                            handlerSpecificCost = c.cost;
                        } else if (!c.handler) {
                            genericCost = c.cost;
                        }
                    }
                }

                if (handlerSpecificCost !== null) {
                    cost += handlerSpecificCost;
                } else if (genericCost !== null) {
                    cost += genericCost;
                } else {
                    cost += DEFAULT_CATEGORY_CHANGE_COST;
                }
            } else if (!fromCategories.some(c => toCategories.includes(c))) {
                // Find the most specific cost for this category change
                // Priority: 1) handler-specific cost, 2) generic cost, 3) default cost
                let handlerSpecificCost: number | null = null;
                let genericCost: number | null = null;

                for (const c of this.categoryChangeCosts) {
                    if (fromCategories.includes(c.from) && toCategories.includes(c.to)) {
                        if (c.handler === handlerLower) {
                            // Handler-specific cost takes highest priority
                            handlerSpecificCost = c.cost;
                        } else if (!c.handler) {
                            // Generic cost (no handler specified)
                            genericCost = c.cost;
                        }
                    }
                }

                if (handlerSpecificCost !== null) {
                    cost += handlerSpecificCost;
                } else if (genericCost !== null) {
                    cost += genericCost;
                } else {
                    cost += DEFAULT_CATEGORY_CHANGE_COST;
                }
            }
        } else if (fromCategory || toCategory) {
            cost += DEFAULT_CATEGORY_CHANGE_COST;
        }

        cost += HANDLER_PRIORITY_COST * handlerIndex;

        const handlerObj = this.handlerMap.get(handlerLower);
        if (handlerObj?.supportedFormats) {
            for (let i = 0; i < handlerObj.supportedFormats.length; i++) {
                if (handlerObj.supportedFormats[i].mime === to.format.mime) {
                    cost += FORMAT_PRIORITY_COST * i;
                    break;
                }
            }
        }

        if (!to.format.lossless) cost *= LOSSY_COST_MULTIPLIER;

        return cost;
    }

    /**
     * Returns a copy of the graph data, including nodes, edges, category change costs, and category adaptive costs. This can be used for debugging, visualization, or analysis purposes. The returned data is a deep copy to prevent external modifications from affecting the internal state of the graph.
     */
    public getData(): { nodes: Node[]; edges: Edge[]; categoryChangeCosts: CategoryChangeCost[]; categoryAdaptiveCosts: CategoryAdaptiveCost[]; nodeIndexMap: Record<string, number> } {
        return {
            nodes: this.nodes.map(node => ({ mime: node.mime, edges: [...node.edges] })),
            edges: this.edges.map(edge => ({
                from: { format: { ...edge.from.format }, index: edge.from.index },
                to: { format: { ...edge.to.format }, index: edge.to.index },
                handler: edge.handler,
                cost: edge.cost
            })),
            categoryChangeCosts: this.categoryChangeCosts.map(c => ({ from: c.from, to: c.to, handler: c.handler, cost: c.cost })),
            categoryAdaptiveCosts: this.categoryAdaptiveCosts.map(c => ({ categories: [...c.categories], cost: c.cost })),
            nodeIndexMap: Object.fromEntries(this.nodeIndexMap)
        };
    }
    /**
     * @coverageIgnore
     */
    public print() {
        let output = "Nodes:\n";
        this.nodes.forEach((node, index) => {
            output += `${index}: ${node.mime}\n`;
        });
        output += "Edges:\n";
        this.edges.forEach((edge, index) => {
            output += `${index}: ${edge.from.format.mime} -> ${edge.to.format.mime} (handler: ${edge.handler}, cost: ${edge.cost})\n`;
        });
        console.log(output);
    }

    private listeners: Array<(state: string, path: ConvertPathNode[]) => void> = [];
    public addPathEventListener(listener: (state: string, path: ConvertPathNode[]) => void) {
        this.listeners.push(listener);
    }

    private dispatchEvent(state: string, path: ConvertPathNode[]) {
        this.listeners.forEach(l => l(state, path));
    }

    public async* searchPath(from: ConvertPathNode, to: ConvertPathNode, simpleMode: boolean): AsyncGenerator<ConvertPathNode[]> {
        const fromIndex = this.nodeIndexMap.get(from.format.mime);
        const toIndex = this.nodeIndexMap.get(to.format.mime);

        if (fromIndex === undefined || toIndex === undefined) {
            return;
        }

        // Check cache first for direct conversions (common case optimization)
        if (fromIndex === toIndex) {
            yield [from];
            return;
        }

        const startTime = performance.now();
        const cacheKey = `${from.format.mime}|${to.format.mime}|${simpleMode}`;

        // Check cache for existing path
        const cachedPath = this.pathCache.get(from.format.mime, to.format.mime, simpleMode);
        if (cachedPath) {
            if (process.env.NODE_ENV !== 'production') {
                console.log(`Cache HIT for ${cacheKey}`);
            }
            yield cachedPath;
            return;
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log(`Cache MISS for ${cacheKey}`);
        }

        let timedOut = false;
        const timeoutId = setTimeout(() => {
            timedOut = true;
            if (process.env.NODE_ENV !== 'production') {
                console.warn(`Path search from ${from.format.mime} to ${to.format.mime} timed out after ${this.searchTimeout}ms`);
            }
        }, this.searchTimeout);

        const queue = new PriorityQueue<QueueNode>(
            1000,
            (a: QueueNode, b: QueueNode) => a.cost - b.cost
        );

        const visitedSet = new Set<number>();
        const visited: number[] = [];

        queue.add({ index: fromIndex, cost: 0, path: [from], visitedBorder: 0 });

        if (process.env.NODE_ENV !== 'production') {
            console.log(`Starting path search from ${from.format.mime}(${from.handler?.name}) to ${to.format.mime}(${to.handler?.name}) (simple mode: ${simpleMode})`);
        }

        let iterations = 0;
        let pathsFound = 0;
        let bestPath: ConvertPathNode[] | null = null;
        let bestCost = Infinity;
        const directPaths: ConvertPathNode[][] = [];

        // Early exit flag for simple mode
        let shouldExit = false;

        while (queue.size() > 0 && !timedOut && !shouldExit) {
            iterations++;
            const current = queue.poll()!;

            // Timeout check
            if (performance.now() - startTime > this.searchTimeout) {
                timedOut = true;
                break;
            }

            if (current.index !== fromIndex && visitedSet.has(current.index)) {
                this.dispatchEvent("skipped", current.path);
                continue;
            }

            if (current.index === toIndex) {
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Found path at iteration ${iterations} with cost ${current.cost}: ${current.path.map(p => p.handler.name + "(" + p.format.mime + ")").join(" -> ")}`);
                }

                if (!this.disableSafeChecks) {
                    let found = false;
                    for (let i = 0; i < current.path.length - 2; i++) {
                        const curr = current.path[i];
                        const next = current.path[i + 1];
                        const last = current.path[i + 2];
                        const currCats = Array.isArray(curr.format.category) ? curr.format.category : [curr.format.category];
                        const nextCats = Array.isArray(next.format.category) ? next.format.category : [next.format.category];
                        const lastCats = Array.isArray(last.format.category) ? last.format.category : [last.format.category];

                        if (
                            currCats.includes("image") &&
                            nextCats.includes("video") &&
                            lastCats.includes("audio")
                        ) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        if (process.env.NODE_ENV !== 'production') {
                            console.log(`Skipping path ${current.path.map(p => p.format.mime).join(" → ")} due to complete loss of media.`);
                        }
                        continue;
                    }
                }

                const lastNode = current.path[current.path.length - 1];
                if (simpleMode || !to.handler || to.handler.name === lastNode?.handler.name) {
                    // Prioritize shorter, lower-cost paths
                    if (current.cost < bestCost) {
                        bestCost = current.cost;
                        bestPath = current.path;
                    }

                    // Track direct conversions (1 step) separately
                    if (current.path.length === 2) {
                        directPaths.push(current.path);
                    }

                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`Yielding path at iteration ${iterations}`);
                    }
                    this.dispatchEvent("found", current.path);
                    yield current.path;
                    pathsFound++;

                    // Early termination for simple mode after finding first valid path
                    if (simpleMode && current.path.length === 2) {
                        shouldExit = true;
                    }
                } else {
                    this.dispatchEvent("skipped", current.path);
                }
                continue;
            }

            visitedSet.add(current.index);
            visited.push(current.index);
            this.dispatchEvent("searching", current.path);

            const node = this.nodes[current.index];
            for (const edgeIndex of node.edges) {
                const edge = this.edges[edgeIndex];

                if (visitedSet.has(edge.to.index)) {
                    continue;
                }

                const handler = this.handlerMap.get(edge.handler.toLowerCase());
                if (!handler) continue;

                const newPath = [...current.path, { handler, format: edge.to.format }];
                queue.add({
                    index: edge.to.index,
                    cost: current.cost + edge.cost + this.calculateAdaptiveCost(newPath),
                    path: newPath,
                    visitedBorder: visited.length
                });
            }

            if (iterations % LOG_FREQUENCY === 0 && process.env.NODE_ENV !== 'production') {
                console.log(`Still searching... Iterations: ${iterations}, Paths found: ${pathsFound}, Queue length: ${queue.size()}`);
            }
        }

        clearTimeout(timeoutId);

        const searchDuration = performance.now() - startTime;

        // Cache best path found
        if (bestPath) {
            // Prefer direct paths for caching
            const pathToCache = directPaths.length > 0 ? directPaths[0] : bestPath;
            this.pathCache.set(from.format.mime, to.format.mime, simpleMode, pathToCache);
        }

        // Record metrics
        this.pathCache.recordSearch(searchDuration, timedOut);

        if (process.env.NODE_ENV !== 'production') {
            console.log(`Path search completed. Total iterations: ${iterations}, Total paths found: ${pathsFound}, Duration: ${searchDuration.toFixed(2)}ms${timedOut ? ' (TIMED OUT)' : ''}`);
            this.logPerformanceMetrics();
        }
    }

    /**
     * Get current performance metrics for the path cache.
     */
    public getPerformanceMetrics(): PerformanceMetrics {
        return this.pathCache.getMetrics();
    }

    /**
     * Get cache statistics including hit rate and size.
     */
    public getCacheStats(): { hitRate: number; size: number; metrics: PerformanceMetrics } {
        return {
            hitRate: this.pathCache.getHitRate(),
            size: this.pathCache.getCacheSize(),
            metrics: this.pathCache.getMetrics()
        };
    }

    /**
     * Set the search timeout in milliseconds.
     */
    public setSearchTimeout(timeoutMs: number): void {
        this.searchTimeout = timeoutMs;
    }

    /**
     * Clear the path cache.
     */
    public clearPathCache(): void {
        this.pathCache.clear();
    }

    private logPerformanceMetrics(): void {
        const stats = this.getCacheStats();
        console.log(`[Perf] Cache Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%, Size: ${stats.size}/${MAX_CACHE_SIZE}`);
        console.log(`[Perf] Avg Search Time: ${stats.metrics.averageSearchTime.toFixed(2)}ms, Longest: ${stats.metrics.longestSearch.toFixed(2)}ms, Timeouts: ${stats.metrics.timeoutCount}`);
    }

    private calculateAdaptiveCost(path: ConvertPathNode[]): number {
        let cost = 0;
        const categoriesInPath = path.map(p => {
            if (Array.isArray(p.format.category)) return p.format.category[0];
            return p.format.category || p.format.mime.split("/")[0];
        });

        for (const c of this.categoryAdaptiveCosts) {
            let pathPtr = categoriesInPath.length - 1;
            let categoryPtr = c.categories.length - 1;

            while (categoryPtr >= 0 && pathPtr >= 0) {
                if (categoriesInPath[pathPtr] === c.categories[categoryPtr]) {
                    categoryPtr--;
                    pathPtr--;
                } else if (categoryPtr + 1 < c.categories.length && categoriesInPath[pathPtr] === c.categories[categoryPtr + 1]) {
                    pathPtr--;
                } else {
                    break;
                }
            }

            if (categoryPtr < 0) {
                cost += c.cost;
            }
        }

        return cost;
    }
}