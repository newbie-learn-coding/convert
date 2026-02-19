let wasm;

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    }
}

let WASM_VECTOR_LEN = 0;

const AudioInfoFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_audioinfo_free(ptr >>> 0, 1));

const FloInfoFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_floinfo_free(ptr >>> 0, 1));

const WasmStreamingDecoderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmstreamingdecoder_free(ptr >>> 0, 1));

/**
 * info about a flo file
 */
export class AudioInfo {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(AudioInfo.prototype);
        obj.__wbg_ptr = ptr;
        AudioInfoFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AudioInfoFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_audioinfo_free(ptr, 0);
    }
    /**
     * Sample rate in Hz
     * @returns {number}
     */
    get sample_rate() {
        const ret = wasm.__wbg_get_audioinfo_sample_rate(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Sample rate in Hz
     * @param {number} arg0
     */
    set sample_rate(arg0) {
        wasm.__wbg_set_audioinfo_sample_rate(this.__wbg_ptr, arg0);
    }
    /**
     * Number of channels
     * @returns {number}
     */
    get channels() {
        const ret = wasm.__wbg_get_audioinfo_channels(this.__wbg_ptr);
        return ret;
    }
    /**
     * Number of channels
     * @param {number} arg0
     */
    set channels(arg0) {
        wasm.__wbg_set_audioinfo_channels(this.__wbg_ptr, arg0);
    }
    /**
     * Bits per sample
     * @returns {number}
     */
    get bit_depth() {
        const ret = wasm.__wbg_get_audioinfo_bit_depth(this.__wbg_ptr);
        return ret;
    }
    /**
     * Bits per sample
     * @param {number} arg0
     */
    set bit_depth(arg0) {
        wasm.__wbg_set_audioinfo_bit_depth(this.__wbg_ptr, arg0);
    }
    /**
     * Total number of frames
     * @returns {bigint}
     */
    get total_frames() {
        const ret = wasm.__wbg_get_audioinfo_total_frames(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * Total number of frames
     * @param {bigint} arg0
     */
    set total_frames(arg0) {
        wasm.__wbg_set_audioinfo_total_frames(this.__wbg_ptr, arg0);
    }
    /**
     * Duration in seconds
     * @returns {number}
     */
    get duration_secs() {
        const ret = wasm.__wbg_get_audioinfo_duration_secs(this.__wbg_ptr);
        return ret;
    }
    /**
     * Duration in seconds
     * @param {number} arg0
     */
    set duration_secs(arg0) {
        wasm.__wbg_set_audioinfo_duration_secs(this.__wbg_ptr, arg0);
    }
    /**
     * File size in bytes
     * @returns {number}
     */
    get file_size() {
        const ret = wasm.__wbg_get_audioinfo_file_size(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * File size in bytes
     * @param {number} arg0
     */
    set file_size(arg0) {
        wasm.__wbg_set_audioinfo_file_size(this.__wbg_ptr, arg0);
    }
    /**
     * Compression ratio (original / compressed)
     * @returns {number}
     */
    get compression_ratio() {
        const ret = wasm.__wbg_get_audioinfo_compression_ratio(this.__wbg_ptr);
        return ret;
    }
    /**
     * Compression ratio (original / compressed)
     * @param {number} arg0
     */
    set compression_ratio(arg0) {
        wasm.__wbg_set_audioinfo_compression_ratio(this.__wbg_ptr, arg0);
    }
    /**
     * Is CRC valid?
     * @returns {boolean}
     */
    get crc_valid() {
        const ret = wasm.__wbg_get_audioinfo_crc_valid(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Is CRC valid?
     * @param {boolean} arg0
     */
    set crc_valid(arg0) {
        wasm.__wbg_set_audioinfo_crc_valid(this.__wbg_ptr, arg0);
    }
    /**
     * Is lossy compression mode?
     * @returns {boolean}
     */
    get is_lossy() {
        const ret = wasm.__wbg_get_audioinfo_is_lossy(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Is lossy compression mode?
     * @param {boolean} arg0
     */
    set is_lossy(arg0) {
        wasm.__wbg_set_audioinfo_is_lossy(this.__wbg_ptr, arg0);
    }
    /**
     * Lossy quality 0-4 (only valid if is_lossy)
     * @returns {number}
     */
    get lossy_quality() {
        const ret = wasm.__wbg_get_audioinfo_lossy_quality(this.__wbg_ptr);
        return ret;
    }
    /**
     * Lossy quality 0-4 (only valid if is_lossy)
     * @param {number} arg0
     */
    set lossy_quality(arg0) {
        wasm.__wbg_set_audioinfo_lossy_quality(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {string}
     */
    get version() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.audioinfo_version(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) AudioInfo.prototype[Symbol.dispose] = AudioInfo.prototype.free;

export class FloInfo {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(FloInfo.prototype);
        obj.__wbg_ptr = ptr;
        FloInfoFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FloInfoFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_floinfo_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get sample_rate() {
        const ret = wasm.floinfo_sample_rate(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {bigint}
     */
    get total_frames() {
        const ret = wasm.floinfo_total_frames(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @returns {number}
     */
    get duration_secs() {
        const ret = wasm.floinfo_duration_secs(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get lossy_quality() {
        const ret = wasm.floinfo_lossy_quality(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get compression_ratio() {
        const ret = wasm.floinfo_compression_ratio(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get version() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.floinfo_version(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get channels() {
        const ret = wasm.floinfo_channels(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get is_lossy() {
        const ret = wasm.floinfo_is_lossy(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get bit_depth() {
        const ret = wasm.floinfo_bit_depth(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    get crc_valid() {
        const ret = wasm.floinfo_crc_valid(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get file_size() {
        const ret = wasm.floinfo_file_size(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) FloInfo.prototype[Symbol.dispose] = FloInfo.prototype.free;

export class WasmStreamingDecoder {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmStreamingDecoderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmstreamingdecoder_free(ptr, 0);
    }
    /**
     * Decode the next available frame
     *
     * Returns interleaved f32 samples for one frame, or null if no frame is ready.
     * This enables true streaming: decode and play frames as they arrive.
     *
     * Usage pattern:
     * ```js
     * while (true) {
     *     const samples = decoder.next_frame();
     *     if (samples === null) break; // No more frames ready
     *     playAudio(samples);
     * }
     * ```
     * @returns {any}
     */
    next_frame() {
        const ret = wasm.wasmstreamingdecoder_next_frame(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * stream done?
     * @returns {boolean}
     */
    is_finished() {
        const ret = wasm.wasmstreamingdecoder_is_finished(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * bytes currently buffered
     * @returns {number}
     */
    buffered_bytes() {
        const ret = wasm.wasmstreamingdecoder_buffered_bytes(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * how many frames ready to decode
     * @returns {number}
     */
    available_frames() {
        const ret = wasm.wasmstreamingdecoder_available_frames(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * decode all currently available samples
     * @returns {Float32Array}
     */
    decode_available() {
        const ret = wasm.wasmstreamingdecoder_decode_available(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * current frame index
     * @returns {number}
     */
    current_frame_index() {
        const ret = wasm.wasmstreamingdecoder_current_frame_index(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * new streaming decoder
     */
    constructor() {
        const ret = wasm.wasmstreamingdecoder_new();
        this.__wbg_ptr = ret >>> 0;
        WasmStreamingDecoderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * feed data to the decoder, call as bytes come in from network
     * @param {Uint8Array} data
     * @returns {boolean}
     */
    feed(data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmstreamingdecoder_feed(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * Reset the decoder to initial state
     *
     * Use this to start decoding a new stream.
     */
    reset() {
        wasm.wasmstreamingdecoder_reset(this.__wbg_ptr);
    }
    /**
     * Get the current state as a string
     * @returns {string}
     */
    state() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.wasmstreamingdecoder_state(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Get audio information (available after header is parsed)
     *
     * Returns null if header hasn't been parsed yet.
     * @returns {any}
     */
    get_info() {
        const ret = wasm.wasmstreamingdecoder_get_info(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Check if the decoder is ready to produce audio
     * @returns {boolean}
     */
    is_ready() {
        const ret = wasm.wasmstreamingdecoder_is_ready(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Check if there was an error
     * @returns {boolean}
     */
    has_error() {
        const ret = wasm.wasmstreamingdecoder_has_error(this.__wbg_ptr);
        return ret !== 0;
    }
}
if (Symbol.dispose) WasmStreamingDecoder.prototype[Symbol.dispose] = WasmStreamingDecoder.prototype.free;

/**
 * Create metadata from basic fields and serialize to MessagePack
 *
 * # Arguments
 * * `title` - Optional title
 * * `artist` - Optional artist
 * * `album` - Optional album
 *
 * # Returns
 * MessagePack bytes containing metadata
 * @param {string | null} [title]
 * @param {string | null} [artist]
 * @param {string | null} [album]
 * @returns {Uint8Array}
 */
export function create_metadata(title, artist, album) {
    var ptr0 = isLikeNone(title) ? 0 : passStringToWasm0(title, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(artist) ? 0 : passStringToWasm0(artist, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(album) ? 0 : passStringToWasm0(album, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len2 = WASM_VECTOR_LEN;
    const ret = wasm.create_metadata(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v4 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v4;
}

/**
 * Create metadata from a JavaScript object
 *
 * Accepts an object with any of the supported metadata fields.
 * See FloMetadata for available fields.
 *
 * # Returns
 * MessagePack bytes containing metadata
 * @param {any} obj
 * @returns {Uint8Array}
 */
export function create_metadata_from_object(obj) {
    const ret = wasm.create_metadata_from_object(obj);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * decode flo file to samples
 *
 * This automatically detects whether the file uses lossless or lossy encoding
 * and dispatches to the appropriate decoder.
 *
 * # Arguments
 * * `data` - flo™ file bytes
 *
 * # Returns
 * Interleaved audio samples (f32, -1.0 to 1.0)
 * @param {Uint8Array} data
 * @returns {Float32Array}
 */
export function decode(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}

/**
 * @param {Uint8Array} flo_bytes
 * @returns {any}
 */
export function decode_flo_to_samples(flo_bytes) {
    const ptr0 = passArray8ToWasm0(flo_bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_flo_to_samples(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {Uint8Array} flo_bytes
 * @returns {Uint8Array}
 */
export function decode_flo_to_wav(flo_bytes) {
    const ptr0 = passArray8ToWasm0(flo_bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_flo_to_wav(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * encode samples to flo lossless
 *
 * # Arguments
 * * `samples` - Interleaved audio samples (f32, -1.0 to 1.0)
 * * `sample_rate` - Sample rate in Hz (e.g., 44100)
 * * `channels` - Number of channels (1 or 2)
 * * `bit_depth` - Bits per sample (16, 24, or 32)
 * * `metadata` - Optional MessagePack metadata
 *
 * # Returns
 * flo™ file as byte array
 *
 * # Note
 * For advanced usage with custom compression levels (0-9),
 * use the `Encoder` builder pattern directly.
 * @param {Float32Array} samples
 * @param {number} sample_rate
 * @param {number} channels
 * @param {number} bit_depth
 * @param {Uint8Array | null} [metadata]
 * @returns {Uint8Array}
 */
export function encode(samples, sample_rate, channels, bit_depth, metadata) {
    const ptr0 = passArrayF32ToWasm0(samples, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(metadata) ? 0 : passArray8ToWasm0(metadata, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.encode(ptr0, len0, sample_rate, channels, bit_depth, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * @param {Uint8Array} audio_bytes
 * @param {boolean} lossy
 * @param {number} quality
 * @param {number} level
 * @returns {Uint8Array}
 */
export function encode_audio_to_flo(audio_bytes, lossy, quality, level) {
    const ptr0 = passArray8ToWasm0(audio_bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.encode_audio_to_flo(ptr0, len0, lossy, quality, level);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * encode samples to flo lossy
 *
 * # Arguments
 * * `samples` - Interleaved audio samples (f32, -1.0 to 1.0)
 * * `sample_rate` - Sample rate in Hz (e.g., 44100)
 * * `channels` - Number of audio channels (1 or 2)
 * * `bit_depth` - Bits per sample (typically 16)
 * * `quality` - Quality level 0-4 (0=low/~64kbps, 4=transparent/~320kbps)
 * * `metadata` - Optional MessagePack metadata
 *
 * # Returns
 * flo™ file as byte array
 *
 * # Note
 * For advanced usage with continuous quality control (0.0-1.0) or custom settings,
 * use the `LossyEncoder` builder pattern directly.
 * @param {Float32Array} samples
 * @param {number} sample_rate
 * @param {number} channels
 * @param {number} _bit_depth
 * @param {number} quality
 * @param {Uint8Array | null} [metadata]
 * @returns {Uint8Array}
 */
export function encode_lossy(samples, sample_rate, channels, _bit_depth, quality, metadata) {
    const ptr0 = passArrayF32ToWasm0(samples, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(metadata) ? 0 : passArray8ToWasm0(metadata, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.encode_lossy(ptr0, len0, sample_rate, channels, _bit_depth, quality, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * encode to flo lossy with target bitrate
 *
 * # Arguments
 * * `samples` - Interleaved audio samples (f32, -1.0 to 1.0)
 * * `sample_rate` - Sample rate in Hz (e.g., 44100)
 * * `channels` - Number of audio channels
 * * `bit_depth` - Bits per sample (16, 24, or 32)
 * * `target_bitrate_kbps` - Target bitrate in kbps (e.g., 128, 192, 256, 320)
 * * `metadata` - Optional MessagePack metadata
 *
 * # Returns
 * flo™ file as byte array
 * @param {Float32Array} samples
 * @param {number} sample_rate
 * @param {number} channels
 * @param {number} _bit_depth
 * @param {number} target_bitrate_kbps
 * @param {Uint8Array | null} [metadata]
 * @returns {Uint8Array}
 */
export function encode_with_bitrate(samples, sample_rate, channels, _bit_depth, target_bitrate_kbps, metadata) {
    const ptr0 = passArrayF32ToWasm0(samples, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(metadata) ? 0 : passArray8ToWasm0(metadata, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.encode_with_bitrate(ptr0, len0, sample_rate, channels, _bit_depth, target_bitrate_kbps, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * @param {Uint8Array} audio_bytes
 * @returns {any}
 */
export function get_audio_file_info(audio_bytes) {
    const ptr0 = passArray8ToWasm0(audio_bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_audio_file_info(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Get cover art from a flo™ file
 *
 * # Arguments
 * * `data` - flo™ file bytes
 *
 * # Returns
 * Object with `mime_type` and `data` (Uint8Array) or null if no cover
 * @param {Uint8Array} data
 * @returns {any}
 */
export function get_cover_art(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_cover_art(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {Uint8Array} flo_bytes
 * @returns {FloInfo}
 */
export function get_flo_file_info(flo_bytes) {
    const ptr0 = passArray8ToWasm0(flo_bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_flo_file_info(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return FloInfo.__wrap(ret[0]);
}

/**
 * @param {Uint8Array} flo_bytes
 * @returns {string}
 */
export function get_flo_metadata_json(flo_bytes) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passArray8ToWasm0(flo_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.get_flo_metadata_json(ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Extract metadata from a flo™ file
 *
 * # Arguments
 * * `data` - flo™ file bytes
 *
 * # Returns
 * JavaScript object with metadata fields (or null if no metadata)
 * @param {Uint8Array} data
 * @returns {any}
 */
export function get_metadata(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_metadata(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Get just the metadata bytes from a flo™ file
 *
 * # Arguments
 * * `flo_data` - flo™ file bytes
 *
 * # Returns
 * Raw MessagePack metadata bytes (or empty array)
 * @param {Uint8Array} flo_data
 * @returns {Uint8Array}
 */
export function get_metadata_bytes(flo_data) {
    const ptr0 = passArray8ToWasm0(flo_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_metadata_bytes(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Get section markers from a flo™ file
 *
 * # Returns
 * Array of section markers or null if none
 * @param {Uint8Array} data
 * @returns {any}
 */
export function get_section_markers(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_section_markers(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Get synced lyrics from a flo™ file
 *
 * # Returns
 * Array of synced lyrics objects or null if none
 * @param {Uint8Array} data
 * @returns {any}
 */
export function get_synced_lyrics(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_synced_lyrics(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Get waveform data from a flo™ file for instant visualization
 *
 * # Returns
 * WaveformData object or null if not present
 * @param {Uint8Array} data
 * @returns {any}
 */
export function get_waveform_data(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_waveform_data(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Check if a flo™ file has metadata
 * @param {Uint8Array} flo_bytes
 * @returns {boolean}
 */
export function has_flo_metadata(flo_bytes) {
    const ptr0 = passArray8ToWasm0(flo_bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.has_flo_metadata(ptr0, len0);
    return ret !== 0;
}

/**
 * does the file have metadata?
 * @param {Uint8Array} flo_data
 * @returns {boolean}
 */
export function has_metadata(flo_data) {
    const ptr0 = passArray8ToWasm0(flo_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.has_metadata(ptr0, len0);
    return ret !== 0;
}

/**
 * Get information about a flo™ file
 *
 * # Arguments
 * * `data` - flo™ file bytes
 *
 * # Returns
 * AudioInfo struct with file details
 * @param {Uint8Array} data
 * @returns {AudioInfo}
 */
export function info(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.info(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return AudioInfo.__wrap(ret[0]);
}

export function init() {
    wasm.init();
}

/**
 * Replace just the metadata in a flo™ file (convenience function)
 *
 * Takes a metadata object directly instead of MessagePack bytes.
 *
 * # Arguments
 * * `flo_data` - Original flo™ file bytes
 * * `metadata` - JavaScript metadata object
 *
 * # Returns
 * New flo™ file with updated metadata
 * @param {Uint8Array} flo_data
 * @param {any} metadata
 * @returns {Uint8Array}
 */
export function set_metadata(flo_data, metadata) {
    const ptr0 = passArray8ToWasm0(flo_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.set_metadata(ptr0, len0, metadata);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Set a single field in existing metadata bytes
 *
 * Uses serde to dynamically set fields - field names match FloMetadata struct.
 * For complex fields (pictures, synced_lyrics, etc.) use create_metadata_from_object.
 *
 * # Arguments
 * * `metadata` - Existing MessagePack metadata bytes (or empty for new)
 * * `field` - Field name (e.g., "title", "artist", "bpm")
 * * `value` - Field value (string, number, or null)
 *
 * # Returns
 * Updated MessagePack metadata bytes
 * @param {Uint8Array | null | undefined} metadata
 * @param {string} field
 * @param {any} value
 * @returns {Uint8Array}
 */
export function set_metadata_field(metadata, field, value) {
    var ptr0 = isLikeNone(metadata) ? 0 : passArray8ToWasm0(metadata, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(field, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.set_metadata_field(ptr0, len0, ptr1, len1, value);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * Strip all metadata from a flo™ file WITHOUT re-encoding audio!
 * @param {Uint8Array} flo_bytes
 * @returns {Uint8Array}
 */
export function strip_flo_metadata(flo_bytes) {
    const ptr0 = passArray8ToWasm0(flo_bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.strip_flo_metadata(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Remove all metadata from a flo™ file
 *
 * # Arguments
 * * `flo_data` - Original flo™ file bytes
 *
 * # Returns
 * New flo™ file with no metadata
 * @param {Uint8Array} flo_data
 * @returns {Uint8Array}
 */
export function strip_metadata(flo_data) {
    const ptr0 = passArray8ToWasm0(flo_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.strip_metadata(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Update metadata in a flo™ file WITHOUT re-encoding audio!
 * This is instant because flo™ stores metadata in a separate chunk.
 *
 * # Arguments
 * * `flo_bytes` - Original flo™ file bytes
 * * `metadata` - JavaScript object with metadata fields
 *
 * # Returns
 * New flo™ file bytes with updated metadata
 * @param {Uint8Array} flo_bytes
 * @param {any} metadata
 * @returns {Uint8Array}
 */
export function update_flo_metadata(flo_bytes, metadata) {
    const ptr0 = passArray8ToWasm0(flo_bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.update_flo_metadata(ptr0, len0, metadata);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * update metadata without re-encoding audio
 *
 * # Arguments
 * * `flo_data` - Original flo™ file bytes
 * * `new_metadata` - New MessagePack metadata bytes (use create_metadata_*)
 *
 * # Returns
 * New flo™ file with updated metadata
 * @param {Uint8Array} flo_data
 * @param {Uint8Array} new_metadata
 * @returns {Uint8Array}
 */
export function update_metadata(flo_data, new_metadata) {
    const ptr0 = passArray8ToWasm0(flo_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(new_metadata, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.update_metadata(ptr0, len0, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * Validate flo™ file integrity
 *
 * # Arguments
 * * `data` - flo™ file bytes
 *
 * # Returns
 * true if file is valid and CRC matches
 * @param {Uint8Array} data
 * @returns {boolean}
 */
export function validate(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.validate(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] !== 0;
}

/**
 * @param {Uint8Array} flo_bytes
 * @returns {boolean}
 */
export function validate_flo_file(flo_bytes) {
    const ptr0 = passArray8ToWasm0(flo_bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.validate_flo_file(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] !== 0;
}

/**
 * get lib version
 * @returns {string}
 */
export function version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.version();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

const EXPECTED_RESPONSE_TYPES = new Set(['basic', 'cors', 'default']);

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && EXPECTED_RESPONSE_TYPES.has(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_Error_52673b7de5a0ca89 = function(arg0, arg1) {
        const ret = Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_Number_2d1dcfcf4ec51736 = function(arg0) {
        const ret = Number(arg0);
        return ret;
    };
    imports.wbg.__wbg_String_8f0eb39a4a4c2f66 = function(arg0, arg1) {
        const ret = String(arg1);
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg___wbindgen_bigint_get_as_i64_6e32f5e6aff02e1d = function(arg0, arg1) {
        const v = arg1;
        const ret = typeof(v) === 'bigint' ? v : undefined;
        getDataViewMemory0().setBigInt64(arg0 + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
    };
    imports.wbg.__wbg___wbindgen_boolean_get_dea25b33882b895b = function(arg0) {
        const v = arg0;
        const ret = typeof(v) === 'boolean' ? v : undefined;
        return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
    };
    imports.wbg.__wbg___wbindgen_debug_string_adfb662ae34724b6 = function(arg0, arg1) {
        const ret = debugString(arg1);
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg___wbindgen_in_0d3e1e8f0c669317 = function(arg0, arg1) {
        const ret = arg0 in arg1;
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_bigint_0e1a2e3f55cfae27 = function(arg0) {
        const ret = typeof(arg0) === 'bigint';
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_function_8d400b8b1af978cd = function(arg0) {
        const ret = typeof(arg0) === 'function';
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_null_dfda7d66506c95b5 = function(arg0) {
        const ret = arg0 === null;
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_object_ce774f3490692386 = function(arg0) {
        const val = arg0;
        const ret = typeof(val) === 'object' && val !== null;
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_string_704ef9c8fc131030 = function(arg0) {
        const ret = typeof(arg0) === 'string';
        return ret;
    };
    imports.wbg.__wbg___wbindgen_is_undefined_f6b95eab589e0269 = function(arg0) {
        const ret = arg0 === undefined;
        return ret;
    };
    imports.wbg.__wbg___wbindgen_jsval_eq_b6101cc9cef1fe36 = function(arg0, arg1) {
        const ret = arg0 === arg1;
        return ret;
    };
    imports.wbg.__wbg___wbindgen_jsval_loose_eq_766057600fdd1b0d = function(arg0, arg1) {
        const ret = arg0 == arg1;
        return ret;
    };
    imports.wbg.__wbg___wbindgen_number_get_9619185a74197f95 = function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof(obj) === 'number' ? obj : undefined;
        getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
    };
    imports.wbg.__wbg___wbindgen_string_get_a2a31e16edf96e42 = function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof(obj) === 'string' ? obj : undefined;
        var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg___wbindgen_throw_dd24417ed36fc46e = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg_call_abb4ff46ce38be40 = function() { return handleError(function (arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_done_62ea16af4ce34b24 = function(arg0) {
        const ret = arg0.done;
        return ret;
    };
    imports.wbg.__wbg_entries_83c79938054e065f = function(arg0) {
        const ret = Object.entries(arg0);
        return ret;
    };
    imports.wbg.__wbg_error_7534b8e9a36f1ab4 = function(arg0, arg1) {
        let deferred0_0;
        let deferred0_1;
        try {
            deferred0_0 = arg0;
            deferred0_1 = arg1;
            console.error(getStringFromWasm0(arg0, arg1));
        } finally {
            wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
        }
    };
    imports.wbg.__wbg_from_29a8414a7a7cd19d = function(arg0) {
        const ret = Array.from(arg0);
        return ret;
    };
    imports.wbg.__wbg_get_6b7bd52aca3f9671 = function(arg0, arg1) {
        const ret = arg0[arg1 >>> 0];
        return ret;
    };
    imports.wbg.__wbg_get_af9dab7e9603ea93 = function() { return handleError(function (arg0, arg1) {
        const ret = Reflect.get(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_get_with_ref_key_1dc361bd10053bfe = function(arg0, arg1) {
        const ret = arg0[arg1];
        return ret;
    };
    imports.wbg.__wbg_instanceof_ArrayBuffer_f3320d2419cd0355 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof ArrayBuffer;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Object_577e21051f7bcb79 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Object;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Uint8Array_da54ccc9d3e09434 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Uint8Array;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_isArray_51fd9e6422c0a395 = function(arg0) {
        const ret = Array.isArray(arg0);
        return ret;
    };
    imports.wbg.__wbg_isSafeInteger_ae7d3f054d55fa16 = function(arg0) {
        const ret = Number.isSafeInteger(arg0);
        return ret;
    };
    imports.wbg.__wbg_iterator_27b7c8b35ab3e86b = function() {
        const ret = Symbol.iterator;
        return ret;
    };
    imports.wbg.__wbg_length_22ac23eaec9d8053 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_length_86ce4877baf913bb = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_length_d45040a40c570362 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_new_1ba21ce319a06297 = function() {
        const ret = new Object();
        return ret;
    };
    imports.wbg.__wbg_new_25f239778d6112b9 = function() {
        const ret = new Array();
        return ret;
    };
    imports.wbg.__wbg_new_6421f6084cc5bc5a = function(arg0) {
        const ret = new Uint8Array(arg0);
        return ret;
    };
    imports.wbg.__wbg_new_8a6f238a6ece86ea = function() {
        const ret = new Error();
        return ret;
    };
    imports.wbg.__wbg_new_b546ae120718850e = function() {
        const ret = new Map();
        return ret;
    };
    imports.wbg.__wbg_new_from_slice_41e2764a343e3cb1 = function(arg0, arg1) {
        const ret = new Float32Array(getArrayF32FromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_new_from_slice_f9c22b9153b26992 = function(arg0, arg1) {
        const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_new_with_length_95ba657dfb7d3dfb = function(arg0) {
        const ret = new Float32Array(arg0 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_next_138a17bbf04e926c = function(arg0) {
        const ret = arg0.next;
        return ret;
    };
    imports.wbg.__wbg_next_3cfe5c0fe2a4cc53 = function() { return handleError(function (arg0) {
        const ret = arg0.next();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_prototypesetcall_dfe9b766cdc1f1fd = function(arg0, arg1, arg2) {
        Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
    };
    imports.wbg.__wbg_set_3f1d0b984ed272ed = function(arg0, arg1, arg2) {
        arg0[arg1] = arg2;
    };
    imports.wbg.__wbg_set_781438a03c0c3c81 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = Reflect.set(arg0, arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_set_7df433eea03a5c14 = function(arg0, arg1, arg2) {
        arg0[arg1 >>> 0] = arg2;
    };
    imports.wbg.__wbg_set_cb0e657d1901c8d8 = function(arg0, arg1, arg2) {
        arg0.set(getArrayF32FromWasm0(arg1, arg2));
    };
    imports.wbg.__wbg_set_efaaf145b9377369 = function(arg0, arg1, arg2) {
        const ret = arg0.set(arg1, arg2);
        return ret;
    };
    imports.wbg.__wbg_stack_0ed75d68575b0f3c = function(arg0, arg1) {
        const ret = arg1.stack;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_stringify_655a6390e1f5eb6b = function() { return handleError(function (arg0) {
        const ret = JSON.stringify(arg0);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_value_57b7b035e117f7ee = function(arg0) {
        const ret = arg0.value;
        return ret;
    };
    imports.wbg.__wbindgen_cast_2241b6af4c4b2941 = function(arg0, arg1) {
        // Cast intrinsic for `Ref(String) -> Externref`.
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_cast_4625c577ab2ec9ee = function(arg0) {
        // Cast intrinsic for `U64 -> Externref`.
        const ret = BigInt.asUintN(64, arg0);
        return ret;
    };
    imports.wbg.__wbindgen_cast_cb9088102bce6b30 = function(arg0, arg1) {
        // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
        const ret = getArrayU8FromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_cast_d6cd19b81560fd6e = function(arg0) {
        // Cast intrinsic for `F64 -> Externref`.
        const ret = arg0;
        return ret;
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_externrefs;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
    };

    return imports;
}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('reflo_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
