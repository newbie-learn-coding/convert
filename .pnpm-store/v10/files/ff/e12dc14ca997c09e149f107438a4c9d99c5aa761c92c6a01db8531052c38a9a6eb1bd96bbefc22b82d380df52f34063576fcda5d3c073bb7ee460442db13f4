/* tslint:disable */
/* eslint-disable */

export class AudioInfo {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Sample rate in Hz
   */
  sample_rate: number;
  /**
   * Number of channels
   */
  channels: number;
  /**
   * Bits per sample
   */
  bit_depth: number;
  /**
   * Total number of frames
   */
  total_frames: bigint;
  /**
   * Duration in seconds
   */
  duration_secs: number;
  /**
   * File size in bytes
   */
  file_size: number;
  /**
   * Compression ratio (original / compressed)
   */
  compression_ratio: number;
  /**
   * Is CRC valid?
   */
  crc_valid: boolean;
  /**
   * Is lossy compression mode?
   */
  is_lossy: boolean;
  /**
   * Lossy quality 0-4 (only valid if is_lossy)
   */
  lossy_quality: number;
  readonly version: string;
}

export class FloInfo {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  readonly sample_rate: number;
  readonly total_frames: bigint;
  readonly duration_secs: number;
  readonly lossy_quality: number;
  readonly compression_ratio: number;
  readonly version: string;
  readonly channels: number;
  readonly is_lossy: boolean;
  readonly bit_depth: number;
  readonly crc_valid: boolean;
  readonly file_size: number;
}

export class WasmStreamingDecoder {
  free(): void;
  [Symbol.dispose](): void;
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
   */
  next_frame(): any;
  /**
   * stream done?
   */
  is_finished(): boolean;
  /**
   * bytes currently buffered
   */
  buffered_bytes(): number;
  /**
   * how many frames ready to decode
   */
  available_frames(): number;
  /**
   * decode all currently available samples
   */
  decode_available(): Float32Array;
  /**
   * current frame index
   */
  current_frame_index(): number;
  /**
   * new streaming decoder
   */
  constructor();
  /**
   * feed data to the decoder, call as bytes come in from network
   */
  feed(data: Uint8Array): boolean;
  /**
   * Reset the decoder to initial state
   *
   * Use this to start decoding a new stream.
   */
  reset(): void;
  /**
   * Get the current state as a string
   */
  state(): string;
  /**
   * Get audio information (available after header is parsed)
   *
   * Returns null if header hasn't been parsed yet.
   */
  get_info(): any;
  /**
   * Check if the decoder is ready to produce audio
   */
  is_ready(): boolean;
  /**
   * Check if there was an error
   */
  has_error(): boolean;
}

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
 */
export function create_metadata(title?: string | null, artist?: string | null, album?: string | null): Uint8Array;

/**
 * Create metadata from a JavaScript object
 *
 * Accepts an object with any of the supported metadata fields.
 * See FloMetadata for available fields.
 *
 * # Returns
 * MessagePack bytes containing metadata
 */
export function create_metadata_from_object(obj: any): Uint8Array;

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
 */
export function decode(data: Uint8Array): Float32Array;

export function decode_flo_to_samples(flo_bytes: Uint8Array): any;

export function decode_flo_to_wav(flo_bytes: Uint8Array): Uint8Array;

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
 */
export function encode(samples: Float32Array, sample_rate: number, channels: number, bit_depth: number, metadata?: Uint8Array | null): Uint8Array;

export function encode_audio_to_flo(audio_bytes: Uint8Array, lossy: boolean, quality: number, level: number): Uint8Array;

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
 */
export function encode_lossy(samples: Float32Array, sample_rate: number, channels: number, _bit_depth: number, quality: number, metadata?: Uint8Array | null): Uint8Array;

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
 */
export function encode_with_bitrate(samples: Float32Array, sample_rate: number, channels: number, _bit_depth: number, target_bitrate_kbps: number, metadata?: Uint8Array | null): Uint8Array;

export function get_audio_file_info(audio_bytes: Uint8Array): any;

/**
 * Get cover art from a flo™ file
 *
 * # Arguments
 * * `data` - flo™ file bytes
 *
 * # Returns
 * Object with `mime_type` and `data` (Uint8Array) or null if no cover
 */
export function get_cover_art(data: Uint8Array): any;

export function get_flo_file_info(flo_bytes: Uint8Array): FloInfo;

export function get_flo_metadata_json(flo_bytes: Uint8Array): string;

/**
 * Extract metadata from a flo™ file
 *
 * # Arguments
 * * `data` - flo™ file bytes
 *
 * # Returns
 * JavaScript object with metadata fields (or null if no metadata)
 */
export function get_metadata(data: Uint8Array): any;

/**
 * Get just the metadata bytes from a flo™ file
 *
 * # Arguments
 * * `flo_data` - flo™ file bytes
 *
 * # Returns
 * Raw MessagePack metadata bytes (or empty array)
 */
export function get_metadata_bytes(flo_data: Uint8Array): Uint8Array;

/**
 * Get section markers from a flo™ file
 *
 * # Returns
 * Array of section markers or null if none
 */
export function get_section_markers(data: Uint8Array): any;

/**
 * Get synced lyrics from a flo™ file
 *
 * # Returns
 * Array of synced lyrics objects or null if none
 */
export function get_synced_lyrics(data: Uint8Array): any;

/**
 * Get waveform data from a flo™ file for instant visualization
 *
 * # Returns
 * WaveformData object or null if not present
 */
export function get_waveform_data(data: Uint8Array): any;

/**
 * Check if a flo™ file has metadata
 */
export function has_flo_metadata(flo_bytes: Uint8Array): boolean;

/**
 * does the file have metadata?
 */
export function has_metadata(flo_data: Uint8Array): boolean;

/**
 * Get information about a flo™ file
 *
 * # Arguments
 * * `data` - flo™ file bytes
 *
 * # Returns
 * AudioInfo struct with file details
 */
export function info(data: Uint8Array): AudioInfo;

export function init(): void;

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
 */
export function set_metadata(flo_data: Uint8Array, metadata: any): Uint8Array;

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
 */
export function set_metadata_field(metadata: Uint8Array | null | undefined, field: string, value: any): Uint8Array;

/**
 * Strip all metadata from a flo™ file WITHOUT re-encoding audio!
 */
export function strip_flo_metadata(flo_bytes: Uint8Array): Uint8Array;

/**
 * Remove all metadata from a flo™ file
 *
 * # Arguments
 * * `flo_data` - Original flo™ file bytes
 *
 * # Returns
 * New flo™ file with no metadata
 */
export function strip_metadata(flo_data: Uint8Array): Uint8Array;

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
 */
export function update_flo_metadata(flo_bytes: Uint8Array, metadata: any): Uint8Array;

/**
 * update metadata without re-encoding audio
 *
 * # Arguments
 * * `flo_data` - Original flo™ file bytes
 * * `new_metadata` - New MessagePack metadata bytes (use create_metadata_*)
 *
 * # Returns
 * New flo™ file with updated metadata
 */
export function update_metadata(flo_data: Uint8Array, new_metadata: Uint8Array): Uint8Array;

/**
 * Validate flo™ file integrity
 *
 * # Arguments
 * * `data` - flo™ file bytes
 *
 * # Returns
 * true if file is valid and CRC matches
 */
export function validate(data: Uint8Array): boolean;

export function validate_flo_file(flo_bytes: Uint8Array): boolean;

/**
 * get lib version
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_floinfo_free: (a: number, b: number) => void;
  readonly decode_flo_to_samples: (a: number, b: number) => [number, number, number];
  readonly decode_flo_to_wav: (a: number, b: number) => [number, number, number, number];
  readonly encode_audio_to_flo: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
  readonly floinfo_bit_depth: (a: number) => number;
  readonly floinfo_channels: (a: number) => number;
  readonly floinfo_compression_ratio: (a: number) => number;
  readonly floinfo_crc_valid: (a: number) => number;
  readonly floinfo_duration_secs: (a: number) => number;
  readonly floinfo_file_size: (a: number) => number;
  readonly floinfo_is_lossy: (a: number) => number;
  readonly floinfo_lossy_quality: (a: number) => number;
  readonly floinfo_sample_rate: (a: number) => number;
  readonly floinfo_total_frames: (a: number) => bigint;
  readonly floinfo_version: (a: number) => [number, number];
  readonly get_audio_file_info: (a: number, b: number) => [number, number, number];
  readonly get_flo_file_info: (a: number, b: number) => [number, number, number];
  readonly get_flo_metadata_json: (a: number, b: number) => [number, number, number, number];
  readonly has_flo_metadata: (a: number, b: number) => number;
  readonly strip_flo_metadata: (a: number, b: number) => [number, number, number, number];
  readonly update_flo_metadata: (a: number, b: number, c: any) => [number, number, number, number];
  readonly validate_flo_file: (a: number, b: number) => [number, number, number];
  readonly init: () => void;
  readonly __wbg_audioinfo_free: (a: number, b: number) => void;
  readonly __wbg_get_audioinfo_bit_depth: (a: number) => number;
  readonly __wbg_get_audioinfo_channels: (a: number) => number;
  readonly __wbg_get_audioinfo_compression_ratio: (a: number) => number;
  readonly __wbg_get_audioinfo_crc_valid: (a: number) => number;
  readonly __wbg_get_audioinfo_duration_secs: (a: number) => number;
  readonly __wbg_get_audioinfo_file_size: (a: number) => number;
  readonly __wbg_get_audioinfo_is_lossy: (a: number) => number;
  readonly __wbg_get_audioinfo_lossy_quality: (a: number) => number;
  readonly __wbg_get_audioinfo_sample_rate: (a: number) => number;
  readonly __wbg_get_audioinfo_total_frames: (a: number) => bigint;
  readonly __wbg_set_audioinfo_bit_depth: (a: number, b: number) => void;
  readonly __wbg_set_audioinfo_channels: (a: number, b: number) => void;
  readonly __wbg_set_audioinfo_compression_ratio: (a: number, b: number) => void;
  readonly __wbg_set_audioinfo_crc_valid: (a: number, b: number) => void;
  readonly __wbg_set_audioinfo_duration_secs: (a: number, b: number) => void;
  readonly __wbg_set_audioinfo_file_size: (a: number, b: number) => void;
  readonly __wbg_set_audioinfo_is_lossy: (a: number, b: number) => void;
  readonly __wbg_set_audioinfo_lossy_quality: (a: number, b: number) => void;
  readonly __wbg_set_audioinfo_sample_rate: (a: number, b: number) => void;
  readonly __wbg_set_audioinfo_total_frames: (a: number, b: bigint) => void;
  readonly __wbg_wasmstreamingdecoder_free: (a: number, b: number) => void;
  readonly audioinfo_version: (a: number) => [number, number];
  readonly create_metadata: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly create_metadata_from_object: (a: any) => [number, number, number, number];
  readonly decode: (a: number, b: number) => [number, number, number, number];
  readonly encode: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
  readonly encode_lossy: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number, number];
  readonly encode_with_bitrate: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number, number];
  readonly get_cover_art: (a: number, b: number) => [number, number, number];
  readonly get_metadata: (a: number, b: number) => [number, number, number];
  readonly get_metadata_bytes: (a: number, b: number) => [number, number, number, number];
  readonly get_section_markers: (a: number, b: number) => [number, number, number];
  readonly get_synced_lyrics: (a: number, b: number) => [number, number, number];
  readonly get_waveform_data: (a: number, b: number) => [number, number, number];
  readonly has_metadata: (a: number, b: number) => number;
  readonly info: (a: number, b: number) => [number, number, number];
  readonly set_metadata: (a: number, b: number, c: any) => [number, number, number, number];
  readonly set_metadata_field: (a: number, b: number, c: number, d: number, e: any) => [number, number, number, number];
  readonly strip_metadata: (a: number, b: number) => [number, number, number, number];
  readonly update_metadata: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly validate: (a: number, b: number) => [number, number, number];
  readonly version: () => [number, number];
  readonly wasmstreamingdecoder_available_frames: (a: number) => number;
  readonly wasmstreamingdecoder_buffered_bytes: (a: number) => number;
  readonly wasmstreamingdecoder_current_frame_index: (a: number) => number;
  readonly wasmstreamingdecoder_decode_available: (a: number) => [number, number, number, number];
  readonly wasmstreamingdecoder_feed: (a: number, b: number, c: number) => [number, number, number];
  readonly wasmstreamingdecoder_get_info: (a: number) => [number, number, number];
  readonly wasmstreamingdecoder_has_error: (a: number) => number;
  readonly wasmstreamingdecoder_is_finished: (a: number) => number;
  readonly wasmstreamingdecoder_is_ready: (a: number) => number;
  readonly wasmstreamingdecoder_new: () => number;
  readonly wasmstreamingdecoder_next_frame: (a: number) => [number, number, number];
  readonly wasmstreamingdecoder_reset: (a: number) => void;
  readonly wasmstreamingdecoder_state: (a: number) => [number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
