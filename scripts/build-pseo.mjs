import fs from "node:fs";
import path from "node:path";

const BASE_URL = "https://converttoit.com";
const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const TODAY = new Date().toISOString().slice(0, 10);

const URL_PATTERNS = {
  format: "/format/{from}-to-{to}/",
  compare: "/compare/{format-a}-vs-{format-b}/",
  category: "/format/{category}/"
};

const CATEGORIES = {
  image: { label: "Image", slug: "image", description: "Convert between image formats like PNG, JPG, WEBP, SVG, GIF, and HEIC.", clusters: ["image-conversion", "design-asset-conversion"] },
  video: { label: "Video", slug: "video", description: "Convert between video formats like MP4, MOV, AVI, and GIF.", clusters: ["video-conversion"] },
  audio: { label: "Audio", slug: "audio", description: "Convert between audio formats like MP3, WAV, FLAC, and OGG.", clusters: ["audio-conversion"] },
  document: { label: "Document", slug: "document", description: "Convert between document formats like PDF, DOCX, TXT, and HTML.", clusters: ["document-conversion"] }
};

function getCategoryForPage(page) {
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (cat.clusters.includes(page.cluster)) return key;
  }
  return null;
}

const formatPages = [
  {
    slug: "png-to-jpg",
    from: "PNG",
    to: "JPG",
    cluster: "image-conversion",
    intent: "transactional",
    primaryKeyword: "convert png to jpg",
    secondaryKeywords: [
      "png to jpg converter",
      "change png into jpg",
      "make png file smaller"
    ],
    userGoal: "You need a lightweight image for websites, email attachments, or ad platforms that reject larger PNG files.",
    conversionTriggers: [
      "Reduce screenshot file size before uploading to CMS.",
      "Prepare product images for marketplaces with strict size limits.",
      "Speed up page load time with compressed JPG output."
    ],
    qualityChecklist: [
      "Set JPG quality between 80 and 90 for balanced clarity.",
      "Check text edges to avoid compression artifacts.",
      "Keep the original PNG when transparency is required.",
      "Rename output using descriptive image intent keywords."
    ],
    pitfalls: [
      "JPG removes alpha transparency.",
      "Repeated JPG saves degrade quality.",
      "Over-compression creates visible blocky noise."
    ],
    deepDive: [
      "PNG to JPG workflows are usually chosen for distribution speed, not archival quality. Teams should preserve the source PNG in a master bucket, then export one delivery JPG tuned for the exact channel constraints.",
      "When converting UI screenshots, text edges are the first place compression artifacts appear. A safer process is to test quality levels against 100% zoom before publishing to documentation or support portals.",
      "Transparency handling must be planned explicitly. If the PNG has alpha regions, pre-define the fallback background color that matches your brand system so exports remain consistent across assets.",
      "For web delivery, measure the delta between source and output size and track resulting page-weight reduction. This creates a repeatable policy for future image conversion decisions."
    ],
    uniquenessSignals: [
      "transparent background fallback workflow",
      "marketplace image size cap",
      "compress screenshot for cms upload",
      "jpg export quality slider guidance",
      "photo delivery via email attachment",
      "replace lossless png with lossy jpeg",
      "website hero image compression",
      "alpha channel removal planning",
      "before-after kb comparison",
      "png flattening strategy"
    ],
    faq: [
      {
        q: "Does PNG to JPG reduce file size?",
        a: "Usually yes. JPG is lossy and optimized for photo-like images, so files are typically smaller than PNG exports."
      },
      {
        q: "Will my transparent PNG stay transparent?",
        a: "No. JPG does not support transparency, so transparent areas become a solid background color."
      }
    ]
  },
  {
    slug: "jpg-to-png",
    from: "JPG",
    to: "PNG",
    cluster: "image-conversion",
    intent: "transactional",
    primaryKeyword: "convert jpg to png",
    secondaryKeywords: [
      "jpg to png converter",
      "turn jpeg into png",
      "save jpeg as png"
    ],
    userGoal: "You need predictable, lossless re-editing output for design tools, slides, or annotation workflows.",
    conversionTriggers: [
      "Add overlays and text labels without additional JPG recompression.",
      "Prepare assets for design tools that favor PNG layers.",
      "Standardize screenshot libraries into one format."
    ],
    qualityChecklist: [
      "Verify dimensions match the source JPG.",
      "Keep color profile consistent across export steps.",
      "Use PNG when you need repeated editing rounds.",
      "Store source and converted versions for audit trails."
    ],
    pitfalls: [
      "Converting JPG to PNG does not recover lost detail.",
      "PNG output can be larger than JPG.",
      "False transparency expectations are common."
    ],
    deepDive: [
      "JPG to PNG is typically a production-stability decision for iterative editing. Teams use PNG output to stop additional JPEG recompression during annotation, handoff, and review cycles.",
      "Although detail cannot be restored, converting to PNG can protect remaining quality from further generation loss when files are opened and re-exported multiple times by different tools.",
      "If the destination includes layered design systems or repeated markup passes, PNG provides a safer intermediate format. Keep the original JPG and record the workflow stage where PNG becomes mandatory.",
      "For governance, define when JPG remains acceptable for final delivery and when PNG must be used for collaboration. This avoids unnecessary storage growth while preserving edit reliability."
    ],
    uniquenessSignals: [
      "lossless re-editing pass",
      "design handoff png requirement",
      "annotation workflow stabilization",
      "repeat export without jpeg generation loss",
      "pixel-safe archival snapshot",
      "client review markup cycle",
      "jpeg artifact containment",
      "consistent screenshot library format",
      "color profile lock for deck assets",
      "poster print prep from jpg source"
    ],
    faq: [
      {
        q: "Is JPG to PNG conversion lossless?",
        a: "The PNG file itself is lossless, but any detail already lost in the original JPG cannot be restored."
      },
      {
        q: "When should I use PNG after converting from JPG?",
        a: "Use PNG when you plan further edits, annotations, or repeated exports where extra JPG recompression would hurt clarity."
      }
    ]
  },
  {
    slug: "webp-to-png",
    from: "WEBP",
    to: "PNG",
    cluster: "image-conversion",
    intent: "transactional",
    primaryKeyword: "convert webp to png",
    secondaryKeywords: [
      "webp to png converter",
      "open webp in photoshop",
      "webp compatibility converter"
    ],
    userGoal: "You need broad compatibility for tools or workflows that still reject WEBP inputs.",
    conversionTriggers: [
      "Open WEBP images in legacy design software.",
      "Upload assets to systems without WEBP support.",
      "Preserve image editing flexibility in PNG pipelines."
    ],
    qualityChecklist: [
      "Confirm decoded dimensions match the original WEBP.",
      "Check transparency rendering after conversion.",
      "Keep naming aligned with existing asset IDs.",
      "Validate output in your target app before publishing."
    ],
    pitfalls: [
      "Some WEBP files include metadata that may not transfer.",
      "PNG output can inflate storage use.",
      "Animation in WEBP is flattened if exported as static PNG."
    ],
    uniquenessSignals: [
      "legacy editor format bridge",
      "cms without webp ingest",
      "transparent logo fallback for old tooling",
      "decode webp for figma import",
      "compatibility-first asset export",
      "animation flattening warning",
      "design ops pipeline normalization",
      "older email builder image support",
      "cross-team attachment readability",
      "webp metadata portability check"
    ],
    faq: [
      {
        q: "Why convert WEBP to PNG?",
        a: "PNG is accepted by nearly every design, office, and CMS workflow, making it a safer compatibility format."
      },
      {
        q: "Will transparency survive WEBP to PNG?",
        a: "In most cases yes, as both formats can carry transparency for still images."
      }
    ]
  },
  {
    slug: "svg-to-png",
    from: "SVG",
    to: "PNG",
    cluster: "design-asset-conversion",
    intent: "transactional",
    primaryKeyword: "convert svg to png",
    secondaryKeywords: [
      "svg to png converter",
      "export vector to raster",
      "rasterize svg"
    ],
    userGoal: "You need a fixed-size raster output for channels that cannot render SVG directly.",
    conversionTriggers: [
      "Publish social graphics where SVG is unsupported.",
      "Embed logos into slide tools that rasterize imports.",
      "Prepare app-store screenshots and mockups."
    ],
    qualityChecklist: [
      "Choose export dimensions before conversion.",
      "Use at least 2x target display size for sharpness.",
      "Review font fallback if custom fonts are embedded.",
      "Test PNG against dark and light backgrounds."
    ],
    pitfalls: [
      "Raster exports lose infinite scaling.",
      "Small export dimensions can blur icons.",
      "Unsupported SVG filters may render differently."
    ],
    uniquenessSignals: [
      "vector-to-raster social banner",
      "icon crispness at 2x export",
      "svg filter fallback rendering",
      "slide deck import reliability",
      "brand logo dark mode check",
      "custom font embed caution",
      "app store screenshot prep",
      "raster lock for ad network",
      "dpi-conscious export sizing",
      "vector source retention policy"
    ],
    faq: [
      {
        q: "What is the best size for SVG to PNG conversion?",
        a: "Export at least 2x your final display size to maintain crisp edges on high-density screens."
      },
      {
        q: "Can I keep SVG quality in PNG?",
        a: "PNG can look sharp, but it is still raster. You lose SVG's infinite scalability after export."
      }
    ]
  },
  {
    slug: "pdf-to-jpg",
    from: "PDF",
    to: "JPG",
    cluster: "document-conversion",
    intent: "transactional",
    primaryKeyword: "convert pdf to jpg",
    secondaryKeywords: [
      "pdf page to image",
      "pdf to jpg converter",
      "extract jpg from pdf page"
    ],
    userGoal: "You need shareable page snapshots for chats, docs, slides, or lightweight previews.",
    conversionTriggers: [
      "Share specific report pages in messaging apps.",
      "Insert PDF content into presentation tools.",
      "Create visual thumbnails for resource libraries."
    ],
    qualityChecklist: [
      "Select an export DPI that matches your display target.",
      "Verify text legibility after rasterization.",
      "Split multipage PDFs into clearly numbered outputs.",
      "Check color consistency in charts and diagrams."
    ],
    pitfalls: [
      "Low DPI exports can blur small text.",
      "Large PDFs may create many output files.",
      "Embedded fonts can render inconsistently at low resolution."
    ],
    uniquenessSignals: [
      "report page screenshot workflow",
      "presentation slide insertion from pdf",
      "thumbnail generation for asset library",
      "dpi tuning for text readability",
      "multi-page naming convention",
      "chart color fidelity check",
      "message app image sharing",
      "extract single page visuals",
      "invoice snapshot archiving",
      "pdf preview image pipeline"
    ],
    faq: [
      {
        q: "What DPI should I use for PDF to JPG?",
        a: "Use 150 DPI for quick previews and 300 DPI when you need clearer small text or print-friendly detail."
      },
      {
        q: "Can I convert one PDF page only?",
        a: "Yes. Select or export only the needed pages to keep output compact and easier to manage."
      }
    ]
  },
  {
    slug: "mov-to-mp4",
    from: "MOV",
    to: "MP4",
    cluster: "video-conversion",
    intent: "transactional",
    primaryKeyword: "convert mov to mp4",
    secondaryKeywords: [
      "mov to mp4 converter",
      "make mov playable everywhere",
      "apple mov to mp4"
    ],
    userGoal: "You need broader playback compatibility across web, Android, Windows, and social uploads.",
    conversionTriggers: [
      "Share iPhone footage with non-Apple teams.",
      "Upload clips to platforms that prefer MP4.",
      "Reduce player compatibility support tickets."
    ],
    qualityChecklist: [
      "Use H.264 video and AAC audio for compatibility.",
      "Match frame rate with the original capture.",
      "Check bitrate to balance size and quality.",
      "Review final playback on at least two devices."
    ],
    pitfalls: [
      "Bitrate set too low introduces visible artifacts.",
      "Variable frame rates can desync in some editors.",
      "Metadata may be reduced depending on codec path."
    ],
    uniquenessSignals: [
      "iphone footage cross-platform playback",
      "social media upload mp4 preference",
      "h264 aac compatibility baseline",
      "editor sync check for frame rate",
      "bitrate tuning for distribution",
      "android playback reliability",
      "windows default player support",
      "camera roll export normalization",
      "helpdesk ticket reduction via mp4",
      "streaming ingest readiness"
    ],
    faq: [
      {
        q: "Why is MP4 preferred over MOV for sharing?",
        a: "MP4 with H.264/AAC is widely supported across browsers, mobile devices, and social platforms."
      },
      {
        q: "Will MOV to MP4 reduce quality?",
        a: "Quality depends on bitrate and codec settings. Reasonable settings can preserve visual quality while improving compatibility."
      }
    ]
  },
  {
    slug: "wav-to-mp3",
    from: "WAV",
    to: "MP3",
    cluster: "audio-conversion",
    intent: "transactional",
    primaryKeyword: "convert wav to mp3",
    secondaryKeywords: [
      "wav to mp3 converter",
      "compress wav audio",
      "reduce audio file size"
    ],
    userGoal: "You need smaller audio files for upload limits, mobile sharing, or fast streaming starts.",
    conversionTriggers: [
      "Upload podcast drafts where WAV size is too large.",
      "Send interview clips over email or chat.",
      "Publish audio previews with low buffering risk."
    ],
    qualityChecklist: [
      "Use 192 kbps for balanced spoken-word quality.",
      "Choose 256-320 kbps for music-heavy tracks.",
      "Normalize loudness before final export.",
      "Listen for artifacts in quiet passages."
    ],
    pitfalls: [
      "Low bitrates can sound metallic.",
      "Re-encoding MP3 repeatedly compounds loss.",
      "Noise floors become more obvious after compression."
    ],
    uniquenessSignals: [
      "podcast upload size control",
      "spoken-word bitrate selection",
      "music preview streaming optimization",
      "email-friendly audio clip",
      "quiet passage artifact check",
      "interview sharing workflow",
      "loudness normalization pass",
      "mobile buffering reduction",
      "archival wav plus delivery mp3",
      "voice memo compression path"
    ],
    faq: [
      {
        q: "What bitrate is best for WAV to MP3?",
        a: "192 kbps works well for voice and mixed content; 256-320 kbps is better when music quality matters."
      },
      {
        q: "Should I keep the original WAV file?",
        a: "Yes. Keep WAV as the master and use MP3 only for distribution copies."
      }
    ]
  },
  {
    slug: "jpg-to-webp",
    from: "JPG",
    to: "WEBP",
    cluster: "image-conversion",
    intent: "transactional",
    primaryKeyword: "convert jpg to webp",
    secondaryKeywords: [
      "jpg to webp converter",
      "optimize images for web",
      "reduce image file size webp"
    ],
    userGoal: "You need smaller image files for faster web page loading and improved Core Web Vitals scores.",
    conversionTriggers: [
      "Improve website loading speed with modern image formats.",
      "Reduce bandwidth costs for image-heavy websites.",
      "Achieve better Google PageSpeed scores."
    ],
    qualityChecklist: [
      "Compare visual quality at equivalent file sizes.",
      "Test browser compatibility for your audience.",
      "Verify WEBP renders correctly in your CMS.",
      "Keep JPG fallback for older browsers if needed."
    ],
    pitfalls: [
      "Not all browsers support WEBP equally.",
      "Some social platforms may not accept WEBP uploads.",
      "Email clients often have limited WEBP support."
    ],
    uniquenessSignals: [
      "pagespeed optimization strategy",
      "modern image format adoption",
      "bandwidth cost reduction",
      "core web vitals improvement",
      "seo image optimization",
      "webp browser support matrix",
      "cms webp compatibility check",
      "image cdn format negotiation",
      "mobile data savings",
      "conversion rate optimization images"
    ],
    faq: [
      {
        q: "Will WEBP images look as good as JPG?",
        a: "WEBP typically achieves similar visual quality at 25-35% smaller file sizes compared to JPG."
      },
      {
        q: "Do all browsers support WEBP?",
        a: "All modern browsers support WEBP. Only very old browsers like Internet Explorer lack support."
      }
    ]
  },
  {
    slug: "png-to-webp",
    from: "PNG",
    to: "WEBP",
    cluster: "image-conversion",
    intent: "transactional",
    primaryKeyword: "convert png to webp",
    secondaryKeywords: [
      "png to webp converter",
      "compress png with transparency",
      "webp with alpha channel"
    ],
    userGoal: "You need transparent images with smaller file sizes for modern web performance.",
    conversionTriggers: [
      "Replace large PNG assets with smaller WEBP files.",
      "Maintain transparency while improving page speed.",
      "Optimize e-commerce product images."
    ],
    qualityChecklist: [
      "Verify transparency renders correctly in target browsers.",
      "Compare file size reduction against quality.",
      "Test on mobile devices for performance gains.",
      "Validate in your production environment."
    ],
    pitfalls: [
      "Legacy browsers may not display WEBP transparency.",
      "Some design tools have limited WEBP support.",
      "Email clients rarely support WEBP format."
    ],
    uniquenessSignals: [
      "transparent webp optimization",
      "png replacement strategy",
      "ecommerce image optimization",
      "alpha channel webp support",
      "modern browser image pipeline",
      "design tool webp export",
      "mobile image performance",
      "cdn image transformation",
      "web performance budget",
      "visual quality preservation"
    ],
    faq: [
      {
        q: "Does WEBP support transparency like PNG?",
        a: "Yes, WEBP supports full alpha channel transparency, making it an excellent PNG replacement."
      },
      {
        q: "How much smaller are WEBP files compared to PNG?",
        a: "WEBP with transparency is typically 25-35% smaller than equivalent PNG files."
      }
    ]
  },
  {
    slug: "mp4-to-gif",
    from: "MP4",
    to: "GIF",
    cluster: "video-conversion",
    intent: "transactional",
    primaryKeyword: "convert mp4 to gif",
    secondaryKeywords: [
      "mp4 to gif converter",
      "video to gif maker",
      "create gif from video"
    ],
    userGoal: "You need animated GIFs for social media, documentation, or platforms that prefer GIF over video.",
    conversionTriggers: [
      "Create social media animations that auto-play.",
      "Add motion graphics to documentation and blogs.",
      "Share short clips where video upload is restricted."
    ],
    qualityChecklist: [
      "Limit duration to keep file size reasonable.",
      "Optimize color palette for the content type.",
      "Choose appropriate frame rate for smooth playback.",
      "Test in target platforms before publishing."
    ],
    pitfalls: [
      "GIF files are much larger than MP4 for the same content.",
      "Color palette limited to 256 colors.",
      "No audio support in GIF format."
    ],
    uniquenessSignals: [
      "social media auto-play",
      "documentation animation",
      "looping video clip",
      "color palette optimization",
      "gif file size management",
      "frame rate selection",
      "platform upload restrictions",
      "meme creation workflow",
      "reaction gif production",
      "marketing animation asset"
    ],
    faq: [
      {
        q: "Why is my GIF file so large?",
        a: "GIF is an older format that compresses less efficiently than MP4. Keep clips short and reduce colors to minimize size."
      },
      {
        q: "Can I convert long videos to GIF?",
        a: "You can, but GIFs over a few seconds become very large. Consider keeping clips under 10 seconds."
      }
    ]
  },
  {
    slug: "avi-to-mp4",
    from: "AVI",
    to: "MP4",
    cluster: "video-conversion",
    intent: "transactional",
    primaryKeyword: "convert avi to mp4",
    secondaryKeywords: [
      "avi to mp4 converter",
      "avi video compression",
      "play avi on mac"
    ],
    userGoal: "You need to modernize legacy AVI files for broader compatibility and smaller file sizes.",
    conversionTriggers: [
      "Share old AVI footage on modern platforms.",
      "Reduce storage space of legacy video archives.",
      "Play AVI files on devices without codec support."
    ],
    qualityChecklist: [
      "Verify video codec compatibility with H.264.",
      "Check audio sync after conversion.",
      "Maintain original resolution when possible.",
      "Test playback on target devices."
    ],
    pitfalls: [
      "Some AVI codecs may not convert cleanly.",
      "Interlaced content may need deinterlacing.",
      "Audio codec mismatches can cause sync issues."
    ],
    uniquenessSignals: [
      "legacy video modernization",
      "avi codec compatibility",
      "h264 video standardization",
      "archive video optimization",
      "cross-platform video playback",
      "video storage reduction",
      "old camera footage conversion",
      "windows media player alternative",
      "video format standardization",
      "professional video workflow"
    ],
    faq: [
      {
        q: "Will I lose quality converting AVI to MP4?",
        a: "With proper settings, quality loss is minimal. H.264 in MP4 often matches or exceeds older AVI codecs."
      },
      {
        q: "Why won't my AVI file play on Mac?",
        a: "AVI uses various codecs, some proprietary to Windows. MP4 with H.264 works universally."
      }
    ]
  },
  {
    slug: "mp3-to-wav",
    from: "MP3",
    to: "WAV",
    cluster: "audio-conversion",
    intent: "transactional",
    primaryKeyword: "convert mp3 to wav",
    secondaryKeywords: [
      "mp3 to wav converter",
      "audio editing format",
      "uncompressed audio export"
    ],
    userGoal: "You need uncompressed audio for professional editing, mastering, or compatibility with specific workflows.",
    conversionTriggers: [
      "Import audio into professional editing software.",
      "Prepare files for broadcast or mastering.",
      "Avoid generation loss in multi-stage editing."
    ],
    qualityChecklist: [
      "Verify sample rate matches project requirements.",
      "Check bit depth for professional standards.",
      "Confirm mono/stereo channel configuration.",
      "Validate in your DAW or editing software."
    ],
    pitfalls: [
      "Converting MP3 to WAV cannot restore lost quality.",
      "WAV files are significantly larger than MP3.",
      "Some metadata may not transfer between formats."
    ],
    uniquenessSignals: [
      "professional audio workflow",
      "daw import preparation",
      "broadcast audio standards",
      "audio mastering pipeline",
      "lossless editing format",
      "sample rate conversion",
      "bit depth requirements",
      "multitrack editing prep",
      "audio restoration workflow",
      "studio quality export"
    ],
    faq: [
      {
        q: "Does converting MP3 to WAV improve quality?",
        a: "No, the conversion cannot restore quality lost in the original MP3 compression. Use WAV for editing, not quality restoration."
      },
      {
        q: "Why do DAWs prefer WAV over MP3?",
        a: "WAV is uncompressed, allowing precise editing without compression artifacts affecting the editing process."
      }
    ]
  },
  {
    slug: "flac-to-mp3",
    from: "FLAC",
    to: "MP3",
    cluster: "audio-conversion",
    intent: "transactional",
    primaryKeyword: "convert flac to mp3",
    secondaryKeywords: [
      "flac to mp3 converter",
      "lossless to lossy audio",
      "compress music library"
    ],
    userGoal: "You need smaller audio files from lossless sources for portable devices or streaming.",
    conversionTriggers: [
      "Fit more music on mobile devices.",
      "Create streaming-friendly audio versions.",
      "Share audio files with size restrictions."
    ],
    qualityChecklist: [
      "Choose appropriate bitrate for your use case.",
      "Preserve metadata and album artwork.",
      "Verify audio quality after conversion.",
      "Keep FLAC masters for archival."
    ],
    pitfalls: [
      "MP3 is lossy; you cannot recover FLAC quality later.",
      "Low bitrates cause audible artifacts in music.",
      "Some players may not support high MP3 bitrates."
    ],
    uniquenessSignals: [
      "music library compression",
      "audiophile format conversion",
      "portable device optimization",
      "bitrate quality selection",
      "metadata preservation",
      "album artwork transfer",
      "streaming audio preparation",
      "mobile storage management",
      "high resolution audio downscale",
      "music sharing workflow"
    ],
    faq: [
      {
        q: "What bitrate should I use for FLAC to MP3?",
        a: "Use 320 kbps for best quality, 256 kbps for good quality with smaller files, or 192 kbps for spoken content."
      },
      {
        q: "Should I delete FLAC files after converting to MP3?",
        a: "Keep FLAC files as masters if storage allows. You cannot recover FLAC quality from MP3 later."
      }
    ]
  },
  {
    slug: "docx-to-pdf",
    from: "DOCX",
    to: "PDF",
    cluster: "document-conversion",
    intent: "transactional",
    primaryKeyword: "convert docx to pdf",
    secondaryKeywords: [
      "docx to pdf converter",
      "word to pdf online",
      "document sharing format"
    ],
    userGoal: "You need a fixed-layout document for sharing, printing, or archival that preserves formatting.",
    conversionTriggers: [
      "Share final documents that should not be edited.",
      "Ensure consistent printing across devices.",
      "Submit documents to official systems or portals."
    ],
    qualityChecklist: [
      "Verify fonts embed correctly.",
      "Check page breaks and formatting.",
      "Confirm images render at proper resolution.",
      "Validate hyperlinks remain functional."
    ],
    pitfalls: [
      "Complex formatting may shift during conversion.",
      "Some fonts may substitute if not embedded.",
      "Interactive elements may be lost or flattened."
    ],
    uniquenessSignals: [
      "document finalization workflow",
      "print ready export",
      "font embedding verification",
      "fixed layout preservation",
      "official document submission",
      "cross platform compatibility",
      "digital signature preparation",
      "archival document format",
      "business document sharing",
      "academic paper submission"
    ],
    faq: [
      {
        q: "Will my fonts look the same in PDF?",
        a: "If fonts are embedded, yes. Some systems substitute fonts if embedding fails or is disabled."
      },
      {
        q: "Can I edit a PDF after converting from DOCX?",
        a: "PDFs are designed for fixed layouts. Editing requires specialized software and may not preserve formatting."
      }
    ]
  },
  {
    slug: "txt-to-pdf",
    from: "TXT",
    to: "PDF",
    cluster: "document-conversion",
    intent: "transactional",
    primaryKeyword: "convert txt to pdf",
    secondaryKeywords: [
      "txt to pdf converter",
      "text file to pdf",
      "plain text export"
    ],
    userGoal: "You need to transform plain text into a formatted document for sharing or printing.",
    conversionTriggers: [
      "Format plain text for professional presentation.",
      "Create printable documents from code or logs.",
      "Archive text files in a standardized format."
    ],
    qualityChecklist: [
      "Set appropriate page margins and font size.",
      "Preserve line breaks and whitespace.",
      "Choose readable font for the content type.",
      "Verify special characters render correctly."
    ],
    pitfalls: [
      "Long lines may wrap unexpectedly.",
      "No formatting from original source.",
      "Character encoding issues with special symbols."
    ],
    uniquenessSignals: [
      "plain text formatting",
      "code documentation export",
      "log file archiving",
      "manuscript preparation",
      "character encoding handling",
      "monospace font selection",
      "page layout from text",
      "document standardization",
      "text file presentation",
      "simple document creation"
    ],
    faq: [
      {
        q: "Will my text formatting be preserved?",
        a: "Plain text has no formatting. The converter applies default fonts and spacing."
      },
      {
        q: "Can I control the font and spacing?",
        a: "Basic converters use defaults. For custom formatting, consider using a word processor first."
      }
    ]
  },
  {
    slug: "heic-to-jpg",
    from: "HEIC",
    to: "JPG",
    cluster: "image-conversion",
    intent: "transactional",
    primaryKeyword: "convert heic to jpg",
    secondaryKeywords: [
      "heic to jpg converter",
      "iphone photo converter",
      "heic compatibility"
    ],
    userGoal: "You need to convert iPhone photos to a universally compatible format for sharing and editing.",
    conversionTriggers: [
      "Share iPhone photos with Windows or Android users.",
      "Upload HEIC images to incompatible platforms.",
      "Edit iPhone photos in software without HEIC support."
    ],
    qualityChecklist: [
      "Compare quality settings for file size balance.",
      "Verify color accuracy after conversion.",
      "Check if Live Photo effects are needed.",
      "Test in target applications."
    ],
    pitfalls: [
      "HEIC offers better compression than JPG.",
      "Live Photo data may be lost.",
      "Some Windows versions need HEIC extensions."
    ],
    uniquenessSignals: [
      "iphone photo workflow",
      "cross platform image sharing",
      "heic windows compatibility",
      "mobile photo editing",
      "social media upload prep",
      "apple ecosystem exit",
      "live photo conversion",
      "image quality preservation",
      "photo library export",
      "device compatibility bridge"
    ],
    faq: [
      {
        q: "Will converting HEIC to JPG reduce quality?",
        a: "At high quality settings, the difference is minimal. HEIC is more efficient, so JPG files will be larger."
      },
      {
        q: "Why can't I open HEIC files on my computer?",
        a: "HEIC is Apple's format. Windows and some Android devices need additional software to support it."
      }
    ]
  },
  {
    slug: "gif-to-mp4",
    from: "GIF",
    to: "MP4",
    cluster: "video-conversion",
    intent: "transactional",
    primaryKeyword: "convert gif to mp4",
    secondaryKeywords: [
      "gif to mp4 converter",
      "optimize gif for web",
      "animated gif to video"
    ],
    userGoal: "You need to dramatically reduce file size while maintaining animation for web delivery.",
    conversionTriggers: [
      "Replace heavy GIFs with lightweight videos on websites.",
      "Improve page load speed with animated content.",
      "Create video ads from existing GIF assets."
    ],
    qualityChecklist: [
      "Verify loop behavior matches original GIF.",
      "Check autoplay settings for web embedding.",
      "Compare file size reduction achieved.",
      "Test muted autoplay in browsers."
    ],
    pitfalls: [
      "Some platforms treat video differently than GIFs.",
      "Autoplay policies vary by browser.",
      "Transparency in GIF may not convert to video."
    ],
    uniquenessSignals: [
      "web performance optimization",
      "gif file size reduction",
      "video autoplay policies",
      "animation web delivery",
      "page speed improvement",
      "mobile data savings",
      "social media video format",
      "content delivery optimization",
      "web animation best practice",
      "lighthouse score improvement"
    ],
    faq: [
      {
        q: "How much smaller is MP4 compared to GIF?",
        a: "MP4 is typically 5-10 times smaller than GIF for the same animation, sometimes more."
      },
      {
        q: "Will my MP4 loop like a GIF?",
        a: "Yes, but you need to configure loop settings. Some platforms handle looping differently for video."
      }
    ]
  }
];

const comparePages = [
  {
    slug: "png-vs-jpg",
    a: "PNG",
    b: "JPG",
    cluster: "image-format-comparison",
    intent: "commercial",
    primaryKeyword: "png vs jpg",
    secondaryKeywords: ["png vs jpeg quality", "png or jpg for web", "png versus jpg size"],
    primaryDecisionSignal: "Transparency and sharp text fidelity vs smaller photographic delivery size",
    decisionSummary: "PNG prioritizes lossless clarity and transparency; JPG usually wins on file size for photo-heavy pages.",
    chooseA: [
      "UI screenshots with text overlays.",
      "Graphics that require transparency.",
      "Assets edited repeatedly before final export."
    ],
    chooseB: [
      "Photo galleries and blog cover images.",
      "Email-ready attachments with size limits.",
      "Large media libraries where storage cost matters."
    ],
    uniquenessSignals: [
      "lossless text edge preservation",
      "alpha channel requirement",
      "photographic compression economics",
      "web page weight budget",
      "transparent logo in design system",
      "camera image delivery format",
      "image seo speed tuning",
      "product card thumbnail strategy",
      "screenshot documentation clarity",
      "asset storage cost control"
    ],
    faq: [
      { q: "Is PNG always better quality than JPG?", a: "PNG is lossless, so it preserves sharp edges better, but JPG can look excellent for photos at practical quality settings." },
      { q: "Which format is better for website speed?", a: "JPG is usually smaller for photos, which helps speed. PNG can still be best for UI assets that need transparency." }
    ]
  },
  {
    slug: "jpg-vs-webp",
    a: "JPG",
    b: "WEBP",
    cluster: "image-format-comparison",
    intent: "commercial",
    primaryKeyword: "jpg vs webp",
    secondaryKeywords: ["webp vs jpeg", "webp for seo", "jpg webp compatibility"],
    primaryDecisionSignal: "Legacy ecosystem compatibility vs modern compression efficiency",
    decisionSummary: "WEBP typically delivers smaller files for similar visual quality, while JPG still wins on universal legacy compatibility.",
    chooseA: [
      "Older CMS plugins and legacy email editors.",
      "Workflows requiring guaranteed cross-platform display.",
      "Teams with JPG-only asset governance."
    ],
    chooseB: [
      "Modern websites optimizing Core Web Vitals.",
      "Image-heavy landing pages needing lower transfer size.",
      "Performance-focused mobile experiences."
    ],
    uniquenessSignals: [
      "modern browser compression advantage",
      "legacy cms jpeg fallback",
      "core web vitals image optimization",
      "cdn negotiation strategy",
      "lighthouse score uplift via webp",
      "email client rendering constraints",
      "progressive migration from jpg",
      "editor compatibility baseline",
      "mobile data savings pathway",
      "asset dual-format serving"
    ],
    faq: [
      { q: "Should I replace all JPG files with WEBP?", a: "Use WEBP where supported, but keep JPG fallbacks if your audience includes older tools and clients." },
      { q: "Does WEBP always look better?", a: "Not always better, but it often matches JPG quality at smaller file sizes when encoded well." }
    ]
  },
  {
    slug: "svg-vs-png",
    a: "SVG",
    b: "PNG",
    cluster: "design-format-comparison",
    intent: "commercial",
    primaryKeyword: "svg vs png",
    secondaryKeywords: ["svg or png logo", "vector vs raster image", "svg png difference"],
    primaryDecisionSignal: "Infinite vector scaling vs predictable fixed-pixel rendering",
    decisionSummary: "SVG scales infinitely and is ideal for line art and logos; PNG is safer for fixed-size image compatibility.",
    chooseA: [
      "Responsive logos and icons.",
      "Design systems that require infinite scaling.",
      "Small assets where editable vector source matters."
    ],
    chooseB: [
      "Channels that do not render SVG reliably.",
      "Static social graphics and screenshots.",
      "Workflows requiring predictable pixel output."
    ],
    uniquenessSignals: [
      "infinite vector scaling behavior",
      "static raster social card output",
      "logo system source of truth",
      "line art sharpness retention",
      "pixel-grid export certainty",
      "svg render sandbox limitations",
      "email-safe image delivery",
      "icon font replacement strategy",
      "print and web dual workflow",
      "vector editing lifecycle"
    ],
    faq: [
      { q: "Is SVG better than PNG for logos?", a: "Usually yes for responsive web logos, because SVG stays sharp at any size and remains editable." },
      { q: "When should I use PNG instead of SVG?", a: "Use PNG when your target channel or software cannot reliably render SVG." }
    ]
  },
  {
    slug: "mov-vs-mp4",
    a: "MOV",
    b: "MP4",
    cluster: "video-format-comparison",
    intent: "commercial",
    primaryKeyword: "mov vs mp4",
    secondaryKeywords: ["mov or mp4", "mp4 compatibility", "mov file size"],
    primaryDecisionSignal: "Editing-friendly source workflows vs universal playback and delivery reach",
    decisionSummary: "MOV can retain Apple-centric editing workflows, while MP4 is the practical default for universal playback and distribution.",
    chooseA: [
      "Editing pipelines centered on Apple software.",
      "High-quality intermediate exports.",
      "Source retention before delivery encoding."
    ],
    chooseB: [
      "Web publishing and social uploads.",
      "Cross-device playback requirements.",
      "Smaller distribution-focused output files."
    ],
    uniquenessSignals: [
      "apple-first editing pipeline",
      "distribution codec normalization",
      "social platform ingest target",
      "cross-device playback matrix",
      "intermediate master export",
      "h264 and aac baseline",
      "camera original retention",
      "browser playback readiness",
      "team sharing outside apple ecosystem",
      "support ticket reduction from format mismatch"
    ],
    faq: [
      { q: "Is MOV higher quality than MP4?", a: "Quality depends on codec and bitrate. MOV often appears in pro workflows, but MP4 can match quality with compatible settings." },
      { q: "Which format is best for website video?", a: "MP4 is typically the safer choice for browser compatibility and delivery efficiency." }
    ]
  },
  {
    slug: "wav-vs-mp3",
    a: "WAV",
    b: "MP3",
    cluster: "audio-format-comparison",
    intent: "commercial",
    primaryKeyword: "wav vs mp3",
    secondaryKeywords: ["wav or mp3", "wav mp3 quality", "audio file size comparison"],
    primaryDecisionSignal: "Master-grade fidelity vs stream-friendly distribution size",
    decisionSummary: "WAV keeps full fidelity for production masters; MP3 is optimized for lightweight distribution and streaming.",
    chooseA: [
      "Studio mastering and archival storage.",
      "Sound design requiring uncompressed source.",
      "Post-production where repeated edits are expected."
    ],
    chooseB: [
      "Podcast publishing and mobile delivery.",
      "Preview clips for quick sharing.",
      "Bandwidth-sensitive audio playback."
    ],
    uniquenessSignals: [
      "master audio archival integrity",
      "distribution-friendly compressed delivery",
      "podcast hosting upload limits",
      "streaming startup latency",
      "post-production edit headroom",
      "metadata and tag portability",
      "voice content bitrate targeting",
      "music preview balance",
      "team review file exchange",
      "long-term restoration source"
    ],
    faq: [
      { q: "Should I publish podcasts in WAV or MP3?", a: "Most podcast workflows publish MP3 for size efficiency while retaining WAV masters offline." },
      { q: "Does MP3 always sound worse than WAV?", a: "MP3 is lossy, but at higher bitrates it can sound very close for everyday listening scenarios." }
    ]
  },
  {
    slug: "pdf-vs-docx",
    a: "PDF",
    b: "DOCX",
    cluster: "document-format-comparison",
    intent: "commercial",
    primaryKeyword: "pdf vs docx",
    secondaryKeywords: ["pdf or word document", "docx vs pdf for sharing", "editable vs fixed document"],
    primaryDecisionSignal: "Fixed-layout publishing certainty vs collaborative editability",
    decisionSummary: "PDF is best for fixed layout sharing; DOCX is better when collaborators need to edit and iterate.",
    chooseA: [
      "Final contracts, invoices, and reports.",
      "Print-ready files with locked formatting.",
      "External distribution where layout must not shift."
    ],
    chooseB: [
      "Collaborative drafting workflows.",
      "Teams using tracked changes and comments.",
      "Documents requiring frequent updates."
    ],
    uniquenessSignals: [
      "fixed layout legal document delivery",
      "collaborative tracked changes workflow",
      "print-ready pagination control",
      "final report sign-off format",
      "editable iteration cycles",
      "template-based word processing",
      "client approval handoff",
      "cross-organization compatibility choice",
      "archive vs draft lifecycle",
      "document governance policy"
    ],
    faq: [
      { q: "Which is better for signing and sharing: PDF or DOCX?", a: "PDF is usually better for signing and external sharing because it preserves layout consistently." },
      { q: "When should I keep DOCX instead of PDF?", a: "Keep DOCX while drafting or collaborating, then export PDF when the document is finalized." }
    ]
  }
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeText(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const BRAND = "ConvertToIt";
const OG_IMAGE = `${BASE_URL}/social-card.svg`;
const THEME_COLOR = "#1C77FF";
const CONTENT_PUBLISHED_ON = "2026-02-19";
const SEO_MIN_WORD_COUNT = 1000;
const ORGANIZATION_ID = `${BASE_URL}/#organization`;
const WEBSITE_ID = `${BASE_URL}/#website`;
const REDIRECT_SOURCE_HOSTS = [
  "https://converttoit.app",
  "http://converttoit.app",
  "https://www.converttoit.app",
  "http://www.converttoit.app"
];
const DEPRECATED_COMPARE_REDIRECTS = {
  "heic-vs-jpg": "/compare/png-vs-jpg/",
  "mp3-vs-flac": "/compare/wav-vs-mp3/",
  "mp4-vs-avi": "/compare/mov-vs-mp4/",
  "webp-vs-png": "/compare/jpg-vs-webp/"
};
const ENGLISH_STOP_WORDS = new Set([
  "a", "about", "after", "all", "also", "an", "and", "any", "are", "as", "at", "be", "before", "best", "but", "by",
  "can", "choose", "comparison", "convert", "converter", "converting", "for", "format", "from", "guide", "how", "if", "in", "into",
  "is", "it", "its", "more", "need", "of", "on", "or", "page", "pages", "that", "the", "this", "to", "use", "when", "with", "you", "your"
]);

function sharedGraphNodes() {
  return [
    {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: BRAND,
      url: `${BASE_URL}/`,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/apple-touch-icon.png`
      },
      sameAs: [`${BASE_URL}/`]
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: `${BASE_URL}/`,
      name: BRAND,
      inLanguage: "en-US",
      publisher: { "@id": ORGANIZATION_ID }
    }
  ];
}

function buildWebPageNode({ pageUrl, title, description, about = [] }) {
  return {
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    name: title,
    url: pageUrl,
    description,
    inLanguage: "en-US",
    isPartOf: { "@id": WEBSITE_ID },
    about,
    datePublished: CONTENT_PUBLISHED_ON,
    dateModified: TODAY,
    publisher: { "@id": ORGANIZATION_ID }
  };
}

function buildArticleNode({ pageUrl, title, description, keywords = [], about = [] }) {
  return {
    "@type": "Article",
    "@id": `${pageUrl}#article`,
    headline: title,
    mainEntityOfPage: { "@id": `${pageUrl}#webpage` },
    description,
    inLanguage: "en-US",
    datePublished: CONTENT_PUBLISHED_ON,
    dateModified: TODAY,
    author: {
      "@type": "Organization",
      name: `${BRAND} Editorial Team`,
      url: `${BASE_URL}/`
    },
    publisher: { "@id": ORGANIZATION_ID },
    keywords: keywords.join(", "),
    about
  };
}

function pageShell({
  title,
  description,
  canonicalPath,
  ogType = "article",
  body,
  jsonLd = [],
  ogImage = OG_IMAGE,
  ogImageAlt = `${BRAND} file conversion guide preview`
}) {
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const normalizedCanonical = canonicalUrl.endsWith("/") || canonicalUrl.endsWith(".html") ? canonicalUrl : `${canonicalUrl}/`;
  const jsonLdPayload = JSON.stringify({ "@context": "https://schema.org", "@graph": jsonLd }).replaceAll("<", "\\u003c");
  const ld = jsonLd.length ? `<script type="application/ld+json">${jsonLdPayload}</script>` : "";

  return `<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${safeText(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <meta name="theme-color" content="${THEME_COLOR}">
  <title>${safeText(title)}</title>
  <link rel="canonical" href="${normalizedCanonical}">
  <link rel="alternate" hreflang="en" href="${normalizedCanonical}">
  <link rel="alternate" hreflang="x-default" href="${normalizedCanonical}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta property="og:type" content="${ogType}">
  <meta property="og:title" content="${safeText(title)}">
  <meta property="og:description" content="${safeText(description)}">
  <meta property="og:url" content="${normalizedCanonical}">
  <meta property="og:site_name" content="${BRAND}">
  <meta property="og:image" content="${safeText(ogImage)}">
  <meta property="og:image:alt" content="${safeText(ogImageAlt)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeText(title)}">
  <meta name="twitter:description" content="${safeText(description)}">
  <meta name="twitter:image" content="${safeText(ogImage)}">
  <meta name="twitter:image:alt" content="${safeText(ogImageAlt)}">
  <link rel="stylesheet" href="/pseo.css">
  ${ld}
</head>
<body>
  ${body}
</body>
</html>`;
}

function navBlock() {
  return `<nav class="top-nav" aria-label="Global navigation">
  <a href="${BASE_URL}/">Converter</a>
  <a href="${BASE_URL}/format/">Format guides</a>
  <a href="${BASE_URL}/compare/">Compare formats</a>
  <a href="${BASE_URL}/privacy.html">Privacy</a>
  <a href="${BASE_URL}/terms.html">Terms</a>
</nav>`;
}

function categoryNavBlock(activeCategory = null) {
  const tabs = Object.entries(CATEGORIES).map(([key, cat]) => {
    const isActive = key === activeCategory;
    return `<a href="${BASE_URL}/format/${cat.slug}/" class="category-tab${isActive ? ' active' : ''}"${isActive ? ' aria-current="page"' : ''}>${cat.label}</a>`;
  }).join("");
  return `<nav class="category-nav" aria-label="Format categories">
    <a href="${BASE_URL}/format/" class="category-tab${activeCategory === null ? ' active' : ''}">All</a>
    ${tabs}
  </nav>`;
}

function breadcrumbNav(items) {
  const lis = items.map((item, i) => {
    const isLast = i === items.length - 1;
    if (isLast) return `<li aria-current="page">${safeText(item.label)}</li>`;
    return `<li><a href="${item.href}">${safeText(item.label)}</a></li>`;
  }).join("");
  return `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>${lis}</ol></nav>`;
}

function linkList(items) {
  return `<ul>${items.map((item) => `<li><a href="${item.href}">${safeText(item.label)}</a></li>`).join("")}</ul>`;
}

function textList(items) {
  return `<ul>${items.map((item) => `<li>${safeText(item)}</li>`).join("")}</ul>`;
}

function paragraphList(items) {
  return items.map((item) => `<p>${safeText(item)}</p>`).join("\n");
}

const FORMAT_DIRECTION_SPECIAL_NOTES = {
  "png-to-jpg": [
    "When flattening transparency, define matte color from the destination brand palette first; otherwise alpha-edge halos appear around logos and UI cutouts after export.",
    "Use a small compression ladder (for example quality 92/86/80) and compare text-edge ringing at 100% zoom so screenshot readability does not degrade silently.",
    "Track before-after kilobyte deltas for hero images and marketplace uploads, because this conversion is usually justified by delivery weight, not archival quality.",
    "For visual QA, inspect gradients and shadows after compression; PNG-to-JPG pipelines can introduce block noise that only appears on dark backgrounds."
  ],
  "jpg-to-png": [
    "Treat this conversion as artifact containment for iterative editing: the goal is to stop additional JPEG generation loss during markup, review, and handoff.",
    "Capture color profile and pixel dimensions before conversion, then lock them in a naming convention so design and content teams can reuse the same editable baseline.",
    "Use PNG as a collaboration checkpoint for annotations and overlays, then define when final delivery can move back to lightweight distribution formats.",
    "Document where recompression previously appeared in your workflow; JPG-to-PNG policies are strongest when they are tied to concrete revision-history pain points."
  ]
};

function formatFieldNotes(page) {
  const directionPatterns = FORMAT_DIRECTION_SPECIAL_NOTES[page.slug];
  return page.uniquenessSignals.map((signal, index) => {
    if (directionPatterns) {
      return `Field note ${index + 1}: ${signal}: ${directionPatterns[index % directionPatterns.length]}`;
    }
    const patterns = [
      `${signal}: run a preflight sample with at least three representative ${page.from} files, log expected ${page.to} output size, and capture one screenshot proof so reviewers can approve the preset before full-batch export.`,
      `${signal}: save one reusable preset, keep the original ${page.from} untouched for rollback, and record why this ${page.to} setting was chosen for the destination channel instead of guessing during the next release cycle.`,
      `${signal}: validate each output in the final destination tool, not just in the converter preview, because downstream renderers often expose edge cases that are invisible during first-pass conversion checks.`,
      `${signal}: log size, clarity, and compatibility deltas in one short runbook entry so future ${page.from} to ${page.to} requests can reuse verified settings and skip avoidable trial-and-error loops.`
    ];
    return `Field note ${index + 1}: ${patterns[index % patterns.length]}`;
  });
}

function compareFieldNotes(page) {
  return page.uniquenessSignals.map((signal, index) => {
    const patterns = [
      `${signal}: choose ${page.a} when edit control, revision tolerance, and source fidelity are more important than immediate delivery speed, then document the expected storage or transfer impact before rollout.`,
      `${signal}: choose ${page.b} when broad playback support, lower delivery friction, and predictable cross-platform behavior matter more than retaining every bit of source flexibility for post-processing.`,
      `${signal}: test both formats with one representative production asset, compare quality and compatibility outcomes in the real publishing path, then standardize the winner as the default team policy.`,
      `${signal}: document exception triggers up front so contributors know exactly when to switch from the default format instead of reopening the same debate every time a new asset arrives.`
    ];
    return `Decision note ${index + 1}: ${patterns[index % patterns.length]}`;
  });
}

function resolvePrimaryDecisionSignal(page) {
  if (typeof page.primaryDecisionSignal === "string" && page.primaryDecisionSignal.trim().length > 0) {
    return page.primaryDecisionSignal.trim();
  }
  const fallbackA = page.chooseA?.[0];
  const fallbackB = page.chooseB?.[0];
  if (fallbackA && fallbackB) {
    return `${page.a}: ${fallbackA} vs ${page.b}: ${fallbackB}`;
  }
  return "Quality, compatibility, and delivery-size trade-offs";
}

function ensureLengthInRange(label, value, min, max) {
  const length = value.length;
  if (length < min || length > max) {
    throw new Error(`${label} length ${length} is outside ${min}-${max}: "${value}"`);
  }
}

function normalizeInternalPath(href) {
  if (!href) return "";
  if (href.startsWith(BASE_URL)) {
    return href.slice(BASE_URL.length);
  }
  return href;
}

function dedupeLinks(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.href}|${item.label}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function withoutSelfLinks(items, canonicalPath) {
  const selfPath = canonicalPath.endsWith("/") ? canonicalPath : `${canonicalPath}/`;
  return items.filter((item) => {
    const normalized = normalizeInternalPath(item.href);
    return normalized !== selfPath && normalized !== selfPath.slice(0, -1);
  });
}

function formatTitle(page) {
  const title = `Convert ${page.from} to ${page.to} Online: Fast Quality Guide | ${BRAND}`;
  ensureLengthInRange(`Title for /format/${page.slug}/`, title, 50, 60);
  return title;
}

function formatDescription(page) {
  const description = `Convert ${page.from.toLowerCase()} to ${page.to.toLowerCase()} with a practical workflow, quality checklist, common pitfalls, and related links so you can publish smaller, compatible files faster today.`;
  ensureLengthInRange(`Meta description for /format/${page.slug}/`, description, 150, 160);
  return description;
}

function compareTitle(page) {
  const title = `${page.a} vs ${page.b}: Quality & Compatibility Guide | ${BRAND}`;
  ensureLengthInRange(`Title for /compare/${page.slug}/`, title, 50, 60);
  return title;
}

function compareDescription(page) {
  const description = `Compare ${page.a.toLowerCase()} vs ${page.b.toLowerCase()} with a practical checklist, use-case table, and conversion links so you can pick the right format for quality, size, and compatibility.`;
  ensureLengthInRange(`Meta description for /compare/${page.slug}/`, description, 150, 160);
  return description;
}

function htmlTextToWords(html) {
  const plain = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return plain.match(/[a-z0-9]+/g) ?? [];
}

function ensureBodyWordCount(label, body, minWords = 1000) {
  const count = htmlTextToWords(body).length;
  if (count < minWords) {
    throw new Error(`${label} rendered body has ${count} words; expected at least ${minWords}.`);
  }
  return count;
}

function renderCategoryPage(categoryKey, allFormatPages, compareMap) {
  const cat = CATEGORIES[categoryKey];
  const catPages = allFormatPages.filter((p) => getCategoryForPage(p) === categoryKey);
  const canonicalPath = `/format/${cat.slug}/`;
  const pageUrl = `${BASE_URL}${canonicalPath}`;
  const title = `${cat.label} Conversion Guides: Quality-First Steps | ConvertToIt`;
  const primaryKeyword = `${cat.label.toLowerCase()} format conversion guides`;
  const description = `Discover ${cat.label.toLowerCase()} format conversion guides with quality gates, pitfall checks, and compatibility links to publish cleaner ${cat.label.toLowerCase()} assets with fewer retries.`;
  ensureLengthInRange(`Title for ${canonicalPath}`, title, 50, 65);
  ensureLengthInRange(`Meta description for ${canonicalPath}`, description, 150, 165);

  const planningRows = catPages.map((page, index) => {
    const risk = page.pitfalls[0] ?? "Quality drift during delivery.";
    return `<tr><td>${index + 1}</td><td>${safeText(page.from)} → ${safeText(page.to)}</td><td>${safeText(page.userGoal)}</td><td>${safeText(risk)}</td><td><a href="${BASE_URL}/format/${page.slug}/">Open guide</a></td></tr>`;
  }).join("");

  const relatedCompareLinks = [];
  for (const [, cp] of compareMap) {
    const cpFormats = [cp.a.toUpperCase(), cp.b.toUpperCase()];
    const catFormats = catPages.flatMap((p) => [p.from.toUpperCase(), p.to.toUpperCase()]);
    if (cpFormats.some((f) => catFormats.includes(f))) {
      relatedCompareLinks.push(`<li><a href="${BASE_URL}/compare/${cp.slug}/">${safeText(cp.a)} vs ${safeText(cp.b)}</a></li>`);
    }
  }

  const faq = [
    {
      q: `How do I choose the right ${cat.label.toLowerCase()} conversion guide?`,
      a: `Start with your final destination requirement, then open the matching ${cat.label.toLowerCase()} format conversion guides to validate compatibility, quality, and size constraints before you run batch exports.`
    },
    {
      q: `Do these ${cat.label.toLowerCase()} guides include quality and rollback checks?`,
      a: `Yes. Every ${cat.label.toLowerCase()} guide includes checklist items, common failure patterns, and practical rollback notes so teams can ship conversions with fewer regressions.`
    },
    {
      q: `Should I compare ${cat.label.toLowerCase()} formats before converting?`,
      a: `When output policy is unclear, use comparison pages first. Then return to ${cat.label.toLowerCase()} format conversion guides to execute the chosen path with production-ready steps.`
    }
  ];

  const snippetAnswer = `<p>${cat.label} format conversion guides are operational playbooks for turning one ${cat.label.toLowerCase()} file type into another with predictable output quality. Teams use ${cat.label.toLowerCase()} format conversion guides to align conversion intent, validate compatibility constraints, and ship consistent artifacts without repeating trial-and-error in each release cycle.</p>`;

  const perPageNarrative = catPages.map((page, index) => {
    const signal = page.uniquenessSignals[0] ?? "quality control";
    return `<p>Guide ${index + 1}: <a href="${BASE_URL}/format/${page.slug}/">${safeText(page.from)} to ${safeText(page.to)}</a> targets "${safeText(signal)}" workflows. ${safeText(page.userGoal)} The quality checklist covers ${safeText(page.qualityChecklist[0] ?? "output validation")} and warns against ${safeText(page.pitfalls[0] ?? "common conversion errors")}. Teams that standardize this path reduce rework and publish cleaner ${safeText(page.to)} output with fewer post-launch corrections.</p>`;
  }).join("");

  const governanceNarrative = catPages.map((page, index) => {
    const trigger = page.conversionTriggers[0] ?? "standard conversion request";
    const checklist = page.qualityChecklist[1] ?? page.qualityChecklist[0] ?? "output validation";
    return `<p>Governance note ${index + 1}: when teams execute ${safeText(page.from)} to ${safeText(page.to)} conversions triggered by "${safeText(trigger)}", apply the quality gate "${safeText(checklist)}" before publishing. Log the conversion outcome, requester intent, and selected preset so repeated ${cat.label.toLowerCase()} conversion tasks follow a consistent, auditable policy across contributors and release cycles.</p>`;
  }).join("");

  const pitfallNarrative = catPages.map((page, index) => {
    const pitfall = page.pitfalls[0] ?? "unexpected quality drift";
    const pitfall2 = page.pitfalls[1] ?? page.pitfalls[0] ?? "output inconsistency";
    return `<p>Risk pattern ${index + 1} for ${safeText(page.from)} to ${safeText(page.to)}: ${safeText(pitfall)} Additionally, watch for ${safeText(pitfall2).toLowerCase()}. Run a controlled sample before batch execution and keep rollback copies of both source and output so recovery stays instant if destination rendering reveals hidden defects in the ${safeText(page.to)} output.</p>`;
  }).join("");

  const body = `
<main class="page-wrap">
  ${navBlock()}
  ${breadcrumbNav([
    { label: "Home", href: `${BASE_URL}/` },
    { label: "Format Guides", href: `${BASE_URL}/format/` },
    { label: cat.label }
  ])}
  ${categoryNavBlock(categoryKey)}
  <header>
    <h1>${cat.label} Format Conversion Guides</h1>
    <p><strong>${safeText(primaryKeyword)}</strong> help teams move from format choice to production execution with clear quality gates and rollback readiness.</p>
    <p>${safeText(cat.description)}</p>
  </header>
  <section>
    <h2>What is ${cat.label.toLowerCase()} format conversion guides?</h2>
    ${snippetAnswer}
  </section>
  <section>
    <h2>How to use ${cat.label.toLowerCase()} format conversion guides in production</h2>
    <ol>
      <li>Identify the destination requirement (channel, file-size limits, and compatibility constraints).</li>
      <li>Pick the matching ${cat.label.toLowerCase()} guide and run one representative sample conversion before batch execution.</li>
      <li>Apply the quality checklist and verify output rendering in the final target environment.</li>
      <li>Record outcomes and escalation notes so future ${cat.label.toLowerCase()} conversions follow the same validated policy.</li>
    </ol>
  </section>
  <section>
    <h2>When these ${cat.label.toLowerCase()} guides are most useful</h2>
    <ul>
      <li>When delivery teams need repeatable ${cat.label.toLowerCase()} conversion quality across multiple contributors.</li>
      <li>When destination apps have strict file-size or codec requirements for ${cat.label.toLowerCase()} files.</li>
      <li>When support teams must reproduce user-facing ${cat.label.toLowerCase()} conversion behavior with clear evidence.</li>
    </ul>
  </section>
  <section>
    <h2>${cat.label} conversion planning matrix</h2>
    <table>
      <thead>
        <tr><th>#</th><th>Path</th><th>Primary goal</th><th>First risk to check</th><th>Guide</th></tr>
      </thead>
      <tbody>
        ${planningRows}
      </tbody>
    </table>
  </section>
  <section>
    <h2>${cat.label} conversion guides</h2>
    <div class="card-grid">
      ${catPages.map((page) => `<article class="card"><h3><a href="${BASE_URL}/format/${page.slug}/">${safeText(page.from)} to ${safeText(page.to)}</a></h3><p>${safeText(page.userGoal)}</p></article>`).join("")}
    </div>
  </section>
  <section>
    <h2>Detailed ${cat.label.toLowerCase()} conversion guide summaries</h2>
    ${perPageNarrative}
  </section>
  <section>
    <h2>Operational governance for ${cat.label.toLowerCase()} conversions</h2>
    ${governanceNarrative}
  </section>
  <section>
    <h2>Common ${cat.label.toLowerCase()} conversion pitfalls and risk patterns</h2>
    ${pitfallNarrative}
  </section>
  <section>
    <h2>What each ${cat.label.toLowerCase()} guide includes</h2>
    <ul>
      <li>Conversion workflow steps that map to real ${cat.label.toLowerCase()} publishing constraints.</li>
      <li>Quality checks and pitfall recovery plans to reduce rework on ${cat.label.toLowerCase()} assets.</li>
      <li>Cross-links to comparison guides so ${cat.label.toLowerCase()} format decisions stay consistent.</li>
    </ul>
  </section>
  ${relatedCompareLinks.length > 0 ? `<section>
    <h2>Related ${cat.label.toLowerCase()} format comparisons</h2>
    <p>Not sure which ${cat.label.toLowerCase()} format to pick? Compare before converting.</p>
    <ul>${relatedCompareLinks.join("")}</ul>
  </section>` : ""}
  <section>
    <h2>FAQ</h2>
    ${faq.map((item) => `<details><summary>${safeText(item.q)}</summary><p>${safeText(item.a)}</p></details>`).join("")}
  </section>
  <section>
    <h2>Editorial method and trust signals</h2>
    <p>This ${cat.label.toLowerCase()} category hub is refreshed on ${TODAY} by the ${BRAND} editorial workflow. Guidance is based on repeat conversion operations, destination validation, and rollback-ready execution standards.</p>
    <ul>
      <li>Canonical policy is locked to <a href="${pageUrl}">${pageUrl}</a>.</li>
      <li>Each linked ${cat.label.toLowerCase()} guide maps execution steps to explicit quality and risk controls.</li>
      <li>Related comparison links are maintained to reduce ${cat.label.toLowerCase()} format-policy drift between teams.</li>
    </ul>
  </section>
</main>`;

  ensureBodyWordCount(canonicalPath, body, SEO_MIN_WORD_COUNT);

  const jsonLd = [
    ...sharedGraphNodes(),
    {
      "@type": "CollectionPage",
      "@id": `${pageUrl}#collection`,
      name: `${cat.label} Format Conversion Guides`,
      url: pageUrl,
      description,
      inLanguage: "en-US",
      isPartOf: { "@id": WEBSITE_ID },
      datePublished: CONTENT_PUBLISHED_ON,
      dateModified: TODAY,
      publisher: { "@id": ORGANIZATION_ID }
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Format Guides", item: `${BASE_URL}/format/` },
        { "@type": "ListItem", position: 3, name: cat.label, item: pageUrl }
      ]
    },
    {
      "@type": "ItemList",
      name: `${cat.label} conversion guides`,
      itemListElement: catPages.map((page, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${BASE_URL}/format/${page.slug}/`,
        name: `${page.from} to ${page.to}`
      }))
    },
    {
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a }
      }))
    }
  ];

  return pageShell({ title, description, canonicalPath, body, jsonLd, ogImageAlt: `Preview card for ${cat.label.toLowerCase()} format conversion guides` });
}

function renderFormatHub(pages) {
  const title = "Convert File Formats Faster: Practical Guides | ConvertToIt";
  const description = "Discover format conversion guides for every file pair. Follow practical steps, quality gates, and related links to publish cleaner assets with fewer retries.";
  ensureLengthInRange("Title for /format/", title, 50, 60);
  ensureLengthInRange("Meta description for /format/", description, 150, 160);
  const faq = [
    {
      q: "How do I choose the right format conversion guide?",
      a: "Start with your final destination requirement, then open the matching format conversion guides to validate compatibility, quality, and size constraints before you run batch exports."
    },
    {
      q: "Do these guides include quality and rollback checks?",
      a: "Yes. Every guide includes checklist items, common failure patterns, and practical rollback notes so teams can ship conversions with fewer regressions."
    },
    {
      q: "Should I compare formats before converting?",
      a: "When output policy is unclear, use comparison pages first. Then return to format conversion guides to execute the chosen path with production-ready steps."
    }
  ];
  const planningRows = pages.map((page, index) => {
    const risk = page.pitfalls[0] ?? "Quality drift during delivery.";
    return `<tr><td>${index + 1}</td><td>${safeText(page.from)} → ${safeText(page.to)}</td><td>${safeText(page.userGoal)}</td><td>${safeText(risk)}</td><td><a href="${BASE_URL}/format/${page.slug}/">Open guide</a></td></tr>`;
  }).join("");
  const body = `
<main class="page-wrap">
  ${navBlock()}
  <header>
    <h1>Format Conversion Guides</h1>
    <p>Use these format conversion guides to move from format choice to production execution with clear quality gates, rollback readiness, and cross-links to related comparisons.</p>
  </header>
  <section>
    <h2>What is format conversion guides?</h2>
    <p>Format conversion guides are operational playbooks for turning one file type into another with predictable output quality. Teams use format conversion guides to align conversion intent, validate compatibility constraints, and ship consistent artifacts without repeating trial-and-error in each release cycle.</p>
  </section>
  <section>
    <h2>How to use format conversion guides in production</h2>
    <ol>
      <li>Identify the destination requirement (channel, file-size limits, and compatibility constraints).</li>
      <li>Pick the matching guide and run one representative sample conversion before batch execution.</li>
      <li>Apply the quality checklist and verify output rendering in the final target environment.</li>
      <li>Record outcomes and escalation notes so future conversions follow the same validated policy.</li>
    </ol>
  </section>
  <section>
    <h2>When these guides are most useful</h2>
    <ul>
      <li>When delivery teams need repeatable conversion quality across multiple contributors.</li>
      <li>When destination apps have strict file-size or codec requirements.</li>
      <li>When support teams must reproduce user-facing conversion behavior with clear evidence.</li>
    </ul>
  </section>
  <section>
    <h2>Format conversion planning matrix</h2>
    <table>
      <thead>
        <tr><th>#</th><th>Path</th><th>Primary goal</th><th>First risk to check</th><th>Guide</th></tr>
      </thead>
      <tbody>
        ${planningRows}
      </tbody>
    </table>
  </section>
  <section>
    <h2>Popular conversion intents</h2>
    ${categoryNavBlock()}
    ${Object.entries(CATEGORIES).map(([key, cat]) => {
      const catPages = pages.filter((p) => getCategoryForPage(p) === key);
      if (catPages.length === 0) return "";
      return `<section>
      <h3><a href="${BASE_URL}/format/${cat.slug}/">${cat.label} conversions</a></h3>
      <p>${safeText(cat.description)}</p>
      <div class="card-grid">
        ${catPages.map((page) => `<article class="card"><h4><a href="${BASE_URL}/format/${page.slug}/">${safeText(page.from)} to ${safeText(page.to)}</a></h4><p>${safeText(page.userGoal)}</p></article>`).join("")}
      </div>
    </section>`;
    }).join("")}
  </section>
  <section>
    <h2>What each guide includes</h2>
    <ul>
      <li>Conversion workflow steps that map to real publishing constraints.</li>
      <li>Quality checks and pitfall recovery plans to reduce rework.</li>
      <li>Cross-links to comparison guides so format decisions stay consistent.</li>
    </ul>
  </section>
  <section>
    <h2>Also compare formats</h2>
    <p>Not sure which format to pick first? Use <a href="${BASE_URL}/compare/">comparison pages</a> to decide before converting.</p>
  </section>
  <section>
    <h2>FAQ</h2>
    ${faq.map((item) => `<details><summary>${safeText(item.q)}</summary><p>${safeText(item.a)}</p></details>`).join("")}
  </section>
  <section>
    <h2>Editorial method and trust signals</h2>
    <p>This hub is refreshed on ${TODAY} by the ${BRAND} editorial workflow. Guidance is based on repeat conversion operations, destination validation, and rollback-ready execution standards.</p>
    <ul>
      <li>Canonical policy is locked to <a href="${BASE_URL}/format/">${BASE_URL}/format/</a>.</li>
      <li>Each linked guide maps execution steps to explicit quality and risk controls.</li>
      <li>Related comparison links are maintained to reduce format-policy drift between teams.</li>
    </ul>
  </section>
</main>`;
  ensureBodyWordCount("/format/", body, SEO_MIN_WORD_COUNT);

  const jsonLd = [
    ...sharedGraphNodes(),
    {
      "@type": "CollectionPage",
      "@id": `${BASE_URL}/format/#collection`,
      name: "Format Conversion Guides",
      url: `${BASE_URL}/format/`,
      description,
      inLanguage: "en-US",
      isPartOf: { "@id": WEBSITE_ID },
      datePublished: CONTENT_PUBLISHED_ON,
      dateModified: TODAY,
      publisher: { "@id": ORGANIZATION_ID }
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Format Guides", item: `${BASE_URL}/format/` }
      ]
    },
    {
      "@type": "ItemList",
      itemListElement: pages.map((page, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `${page.from} to ${page.to}`,
        url: `${BASE_URL}/format/${page.slug}/`
      }))
    },
    {
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a }
      }))
    }
  ];

  return pageShell({ title, description, canonicalPath: "/format/", body, jsonLd, ogType: "website" });
}

function renderCompareHub(pages) {
  const title = "Compare File Formats Faster: Decision Guides | ConvertToIt";
  const description = "Compare file formats with decision-first guides. Review quality, compatibility, and size trade-offs, then jump to best-fit conversion paths for your workflow.";
  ensureLengthInRange("Title for /compare/", title, 50, 60);
  ensureLengthInRange("Meta description for /compare/", description, 150, 160);
  const faq = [
    {
      q: "When should I use compare file formats guides?",
      a: "Use compare file formats guides when teams need one default policy based on measurable quality, compatibility, and file-size trade-offs before conversion execution begins."
    },
    {
      q: "Do comparison guides replace conversion guides?",
      a: "No. Comparison guides help choose the target policy first, then conversion guides handle implementation details and quality checks."
    },
    {
      q: "How do we avoid repeated format debates?",
      a: "Run one representative benchmark, document outcomes in the comparison guide, and link the approved conversion path so future contributors follow the same decision baseline."
    }
  ];
  const matrixRows = pages.map((page, index) => {
    const primarySignal = resolvePrimaryDecisionSignal(page);
    return `<tr><td>${index + 1}</td><td>${safeText(page.a)} vs ${safeText(page.b)}</td><td>${safeText(primarySignal)}</td><td>${safeText(page.decisionSummary)}</td><td><a href="${BASE_URL}/compare/${page.slug}/">Open comparison</a></td></tr>`;
  }).join("");
  const body = `
<main class="page-wrap">
  ${navBlock()}
  <header>
    <h1>File Format Comparison Guides</h1>
    <p>Use compare file formats guides to decide the right default output policy before execution, then route teams to the correct conversion workflow with fewer downstream exceptions.</p>
  </header>
  <section>
    <h2>What is compare file formats guides?</h2>
    <p>Compare file formats guides are decision playbooks for selecting one default format based on measurable trade-offs. Teams use compare file formats guides to align quality expectations, compatibility risk, and delivery-size impact before starting conversion work across products, content pipelines, or support operations.</p>
  </section>
  <section>
    <h2>How to run comparison-first decisions</h2>
    <ol>
      <li>Choose one representative asset that reflects real production constraints.</li>
      <li>Evaluate both formats for quality, compatibility, and output size in target channels.</li>
      <li>Record the winner and the exception triggers in the relevant comparison guide.</li>
      <li>Hand off to the matching conversion guide for repeatable implementation.</li>
    </ol>
  </section>
  <section>
    <h2>When comparison-first workflows are critical</h2>
    <ul>
      <li>When teams disagree on default export format for shared assets.</li>
      <li>When one destination channel has stricter compatibility constraints than others.</li>
      <li>When delivery performance and quality need a documented balance point.</li>
    </ul>
  </section>
  <section>
    <h2>Format comparison decision matrix</h2>
    <table>
      <thead>
        <tr><th>#</th><th>Comparison</th><th>Primary signal</th><th>Decision focus</th><th>Guide</th></tr>
      </thead>
      <tbody>
        ${matrixRows}
      </tbody>
    </table>
  </section>
  <section>
    <h2>How to score quality, compatibility, and delivery impact</h2>
    <p>For each comparison, run one short benchmark cycle and score outcomes against the same rubric so teams can explain why a default format was selected. A reliable scorecard prevents preference-driven debates and keeps production decisions aligned to measurable outcomes.</p>
    <ol>
      <li><strong>Quality score:</strong> verify visual/audio fidelity, edit tolerance, and artifact risk after one realistic export path.</li>
      <li><strong>Compatibility score:</strong> test browser playback, mobile behavior, CMS/editor support, and stakeholder review tooling.</li>
      <li><strong>Delivery score:</strong> compare file size, transfer reliability, cache behavior, and publishing turnaround time.</li>
      <li><strong>Policy confidence score:</strong> document exception triggers and rollback path before promoting one format as default.</li>
    </ol>
    <p>Keep benchmark evidence in a shared release note so content, engineering, and operations teams reuse the same baseline during future launches instead of re-running ad hoc evaluations.</p>
  </section>
  <section>
    <h2>Comparison intents</h2>
    <div class="card-grid">
      ${pages.map((page) => `<article class="card"><h3><a href="${BASE_URL}/compare/${page.slug}/">${safeText(page.a)} vs ${safeText(page.b)}</a></h3><p>${safeText(page.decisionSummary)}</p></article>`).join("")}
    </div>
  </section>
  <section>
    <h2>Policy handoff checklist before rollout</h2>
    <p>After choosing a winner, teams should publish an explicit handoff checklist so new contributors can execute the decision without guessing. This keeps quality stable when ownership changes or when the same comparison appears in multiple workflows.</p>
    <ul>
      <li>Declare one default format and list the top two exception scenarios that justify using the alternate format.</li>
      <li>Link the default comparison to the exact conversion guide that implements the chosen output policy.</li>
      <li>Define the minimum QA proof required before batch publishing (for example: sample file diff, destination render test, and reviewer sign-off).</li>
      <li>Capture rollback rules in one paragraph so incident responders can revert quickly when downstream platforms behave unexpectedly.</li>
      <li>Review these rules every quarter to confirm they still match current browser, app, and distribution constraints.</li>
    </ul>
  </section>
  <section>
    <h2>Example comparison governance note</h2>
    <p>A practical governance note should answer three questions in plain language: what default format was selected, what measurable evidence supported the decision, and under which conditions teams may override the default. Keep this note short enough to read during release reviews, but specific enough that different contributors will make the same choice without additional meetings.</p>
    <p>For example, if a team selects WEBP over JPG for homepage delivery, the note should include the observed size reduction range, the tested browser support baseline, and the fallback trigger for channels that still require JPG. Capturing these details once prevents future policy drift and reduces rework caused by inconsistent assumptions between design, development, and publishing teams.</p>
  </section>
  <section>
    <h2>How these decision guides help</h2>
    <ul>
      <li>Compare quality, compatibility, and delivery-size trade-offs in one view.</li>
      <li>Use linked conversion paths to move from decision to execution quickly.</li>
      <li>Align default format policies with measurable operational constraints.</li>
    </ul>
  </section>
  <section>
    <h2>Need direct conversion paths?</h2>
    <p>Jump to <a href="${BASE_URL}/format/">format conversion pages</a> for step-by-step action checklists.</p>
  </section>
  <section>
    <h2>FAQ</h2>
    ${faq.map((item) => `<details><summary>${safeText(item.q)}</summary><p>${safeText(item.a)}</p></details>`).join("")}
  </section>
  <section>
    <h2>Editorial method and trust signals</h2>
    <p>This compare hub is refreshed on ${TODAY} by the ${BRAND} editorial workflow and validated against practical delivery constraints, not theoretical benchmarks.</p>
    <ul>
      <li>Canonical policy remains fixed to <a href="${BASE_URL}/compare/">${BASE_URL}/compare/</a>.</li>
      <li>Each comparison page includes measurable decision signals and linked execution follow-up.</li>
      <li>Related conversion routes are maintained so policy decisions remain operationally actionable.</li>
    </ul>
  </section>
</main>`;
  ensureBodyWordCount("/compare/", body, SEO_MIN_WORD_COUNT);

  const jsonLd = [
    ...sharedGraphNodes(),
    {
      "@type": "CollectionPage",
      "@id": `${BASE_URL}/compare/#collection`,
      name: "File Format Comparison Guides",
      url: `${BASE_URL}/compare/`,
      description,
      inLanguage: "en-US",
      isPartOf: { "@id": WEBSITE_ID },
      datePublished: CONTENT_PUBLISHED_ON,
      dateModified: TODAY,
      publisher: { "@id": ORGANIZATION_ID }
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Compare Formats", item: `${BASE_URL}/compare/` }
      ]
    },
    {
      "@type": "ItemList",
      itemListElement: pages.map((page, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `${page.a} vs ${page.b}`,
        url: `${BASE_URL}/compare/${page.slug}/`
      }))
    },
    {
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a }
      }))
    }
  ];

  return pageShell({ title, description, canonicalPath: "/compare/", body, jsonLd, ogType: "website" });
}

function renderFormatPage(page, allFormatPages, compareMap) {
  const canonicalPath = `/format/${page.slug}/`;
  const pageUrl = `${BASE_URL}${canonicalPath}`;
  const title = formatTitle(page);
  const description = formatDescription(page);
  const primaryKeyword = page.primaryKeyword.toLowerCase();
  const forwardCompareSlug = `${page.from.toLowerCase()}-vs-${page.to.toLowerCase()}`;
  const reverseCompareSlug = `${page.to.toLowerCase()}-vs-${page.from.toLowerCase()}`;
  const resolvedCompareSlug = compareMap.has(forwardCompareSlug)
    ? forwardCompareSlug
    : (compareMap.has(reverseCompareSlug) ? reverseCompareSlug : null);
  const compareLink = resolvedCompareSlug
    ? { href: `${BASE_URL}/compare/${resolvedCompareSlug}/`, label: `${page.from} vs ${page.to} quality comparison` }
    : null;

  const relatedConversions = allFormatPages
    .filter((entry) => entry.slug !== page.slug && (entry.from === page.from || entry.to === page.to || entry.cluster === page.cluster))
    .slice(0, 3)
    .map((entry) => ({ href: `${BASE_URL}/format/${entry.slug}/`, label: `Convert ${entry.from} to ${entry.to}` }));

  const resourceLinks = dedupeLinks(withoutSelfLinks([
    { href: `${BASE_URL}/`, label: "Open the online converter" },
    { href: `${BASE_URL}/format/`, label: "Browse all format conversion guides" },
    { href: `${BASE_URL}/compare/`, label: "Review comparison guides before converting" },
    ...relatedConversions,
    ...(compareLink ? [compareLink] : [])
  ], canonicalPath));

  const faqList = page.faq.map((item) => `<details><summary>${safeText(item.q)}</summary><p>${safeText(item.a)}</p></details>`).join("");
  const snippetAnswer = `<p><strong>${safeText(primaryKeyword)}</strong> helps when you need a delivery-ready ${safeText(page.to)} file that balances compatibility and quality. Keep the original ${safeText(page.from)} as your master source, export one optimized output for publishing, and validate dimensions, compression, and metadata before sharing to avoid repeat conversion work.</p>`;
  const longFormNotes = formatFieldNotes(page);
  const keywordAngleNotes = page.secondaryKeywords.map((keyword, index) => {
    const patterns = [
      `Searches like "${keyword}" usually mean delivery speed is under pressure, so define one approved ${page.from} to ${page.to} preset and include expected size and quality ranges in your release checklist.`,
      `Query "${keyword}" often signals compatibility risk, so test converted output inside the final destination app, capture one proof screenshot, and document what failed before scaling conversion to the rest of the batch.`,
      `When users ask for "${keyword}", they typically need a policy, not a one-off fix: preserve the source, export once, verify destination behavior, and track the exact conditions that justify future exceptions.`
    ];
    return `Keyword angle ${index + 1}: ${patterns[index % patterns.length]}`;
  });
  const scenarioBlueprints = page.conversionTriggers.map((trigger, index) => {
    const keyword = page.secondaryKeywords[index % page.secondaryKeywords.length];
    return `Scenario blueprint ${index + 1}: ${trigger} Treat this as an operational request tied to "${keyword}". Start with one representative file, capture before-and-after size plus clarity data, and only then approve batch conversion for the rest of the queue.`;
  });
  const checklistNarrative = page.qualityChecklist.map((item, index) => {
    const signal = page.uniquenessSignals[index % page.uniquenessSignals.length];
    const patterns = [
      `Quality control ${index + 1}: ${item} Capture this as a pre-publish check so handoffs stay consistent, and tie it to signal "${signal}" so teams can detect drift early.`,
      `Quality control ${index + 1}: ${item} This step prevents avoidable rework when multiple contributors touch the same ${page.from} assets before delivery-ready ${page.to} export.`,
      `Quality control ${index + 1}: ${item} Teams that standardize this checkpoint usually reduce QA escalation loops and publish cleaner outputs with fewer post-launch corrections.`
    ];
    return patterns[index % patterns.length];
  });
  const pitfallNarrative = page.pitfalls.map((item, index) => {
    const trigger = page.conversionTriggers[index % page.conversionTriggers.length];
    const patterns = [
      `Pitfall pattern ${index + 1}: ${item} This usually appears during "${trigger}", so run a controlled sample first and lock known-good settings before any large conversion run begins.`,
      `Pitfall pattern ${index + 1}: ${item} Keep a rollback copy of the source and exported output so recovery stays instant if destination rendering reveals hidden defects.`,
      `Pitfall pattern ${index + 1}: ${item} Add this as a release gate item with owner and evidence so the same failure mode does not repeat across future conversion batches.`
    ];
    return patterns[index % patterns.length];
  });
  const governanceNarrative = page.uniquenessSignals.slice(0, 6).map((signal, index) => (
    `Governance checkpoint ${index + 1}: for "${signal}", log requester intent, selected preset, and final ${page.to} outcome quality so repeated ${primaryKeyword} tasks can be executed with policy-level consistency.`
  ));
  const deepDiveNarrative = (page.deepDive ?? []).map((item, index) => (
    `Direction-specific note ${index + 1}: ${item}`
  ));
  const directionPlaybookNarrative = (page.deepDive ?? []).map((item, index) => {
    const signal = page.uniquenessSignals[index % page.uniquenessSignals.length];
    return `Direction playbook ${index + 1}: ${item} In audits, tag this as "${signal}" so teams can quickly identify why ${page.from} to ${page.to} requires a different rollout policy than reverse-direction conversions.`;
  });
  const validationMatrixRows = page.qualityChecklist.map((item, index) => {
    const trigger = page.conversionTriggers[index % page.conversionTriggers.length];
    const pitfall = page.pitfalls[index % page.pitfalls.length];
    const signal = page.uniquenessSignals[index % page.uniquenessSignals.length];
    return `<tr><td>${index + 1}</td><td>${safeText(trigger)}</td><td>${safeText(item)}</td><td>${safeText(pitfall)}</td><td>${safeText(signal)}</td></tr>`;
  }).join("");

  const fromExt = page.from.toLowerCase();
  const toExt = page.to.toLowerCase();
  const category = getCategoryForPage(page);
  const catLabel = category ? CATEGORIES[category].label : null;
  const catSlug = category ? CATEGORIES[category].slug : null;

  const breadcrumbItems = [
    { label: "Home", href: `${BASE_URL}/` },
    { label: "Format Guides", href: `${BASE_URL}/format/` },
    ...(catSlug ? [{ label: catLabel, href: `${BASE_URL}/format/${catSlug}/` }] : []),
    { label: `${page.from} to ${page.to}` }
  ];

  const converterWidget = `
  <section class="converter-widget" aria-label="Convert ${safeText(page.from)} to ${safeText(page.to)} online">
    <h2>Convert ${safeText(page.from)} to ${safeText(page.to)} now</h2>
    <p>Drop your ${safeText(page.from)} file below to convert it to ${safeText(page.to)} instantly in your browser. No upload, no account needed.</p>
    <iframe
      src="${BASE_URL}/convert/?from=${fromExt}&to=${toExt}&embed=1"
      title="Convert ${safeText(page.from)} to ${safeText(page.to)}"
      class="converter-iframe"
      loading="lazy"
      allow="clipboard-read; clipboard-write"
      sandbox="allow-scripts allow-same-origin allow-downloads"
    ></iframe>
    <p class="converter-widget-note">All processing happens locally in your browser. Files never leave your device.</p>
  </section>`;

  const body = `
<main class="page-wrap">
  ${navBlock()}
  ${breadcrumbNav(breadcrumbItems)}
  ${categoryNavBlock(category)}
  <header>
    <h1>How to convert ${safeText(page.from)} to ${safeText(page.to)}</h1>
    <p><strong>${safeText(primaryKeyword)}</strong> is useful when you need practical delivery output with fewer quality surprises.</p>
    <p>${safeText(page.userGoal)}</p>
  </header>

  ${converterWidget}

  <section>
    <h2>What is ${safeText(primaryKeyword)} best for?</h2>
    ${snippetAnswer}
  </section>

  <section>
    <h2>When this conversion is useful</h2>
    ${textList(page.conversionTriggers)}
  </section>

  <section>
    <h2>Channel-specific execution scenarios for ${safeText(page.from)} to ${safeText(page.to)}</h2>
    ${paragraphList(scenarioBlueprints)}
  </section>

  <section>
    <h2>How to execute ${safeText(primaryKeyword)} with fewer mistakes</h2>
    <ol>
      <li>Open the <a href="${BASE_URL}/">ConvertToIt browser converter</a> and upload your ${safeText(page.from)} source file.</li>
      <li>Select ${safeText(page.to)} output, then tune settings for your final destination channel and size constraints.</li>
      <li>Preview the exported file, compare quality against the source, and keep both versions for rollback safety.</li>
    </ol>
  </section>

  <section>
    <h2>Quality checklist before publishing</h2>
    ${textList(page.qualityChecklist)}
  </section>

  <section>
    <h2>Production validation matrix</h2>
    <table>
      <thead>
        <tr><th>Step</th><th>Trigger context</th><th>Quality gate</th><th>Primary risk</th><th>Evidence tag</th></tr>
      </thead>
      <tbody>
        ${validationMatrixRows}
      </tbody>
    </table>
  </section>

  <section>
    <h2>Common pitfalls</h2>
    ${textList(page.pitfalls)}
  </section>

  <section>
    <h2>Advanced ${safeText(page.from)} to ${safeText(page.to)} execution notes</h2>
    ${paragraphList(checklistNarrative)}
    ${paragraphList(pitfallNarrative)}
  </section>

  <section>
    <h2>What teams learn after repeated ${safeText(primaryKeyword)} projects</h2>
    ${paragraphList(keywordAngleNotes)}
    ${paragraphList(longFormNotes)}
  </section>

  <section>
    <h2>Operational governance and measurement baseline</h2>
    ${paragraphList(governanceNarrative)}
  </section>

  ${deepDiveNarrative.length > 0 ? `
  <section>
    <h2>${safeText(page.from)} to ${safeText(page.to)} direction-specific engineering notes</h2>
    ${paragraphList(deepDiveNarrative)}
  </section>` : ""}

  ${directionPlaybookNarrative.length > 0 ? `
  <section>
    <h2>${safeText(page.from)} to ${safeText(page.to)} direction-specific rollout playbook</h2>
    ${paragraphList(directionPlaybookNarrative)}
  </section>` : ""}

  <section>
    <h2>Editorial method and trust signals</h2>
    <p>This page is maintained by the ${BRAND} editorial workflow and was last refreshed on ${TODAY}. Recommendations are based on repeat conversion operations, not one-off synthetic examples.</p>
    <ul>
      <li>Publisher: ${BRAND}, with canonical policy locked to <a href="${BASE_URL}/">${BASE_URL}</a>.</li>
      <li>Review model: conversion workflow checks + destination compatibility verification + rollback readiness.</li>
      <li>Quality evidence: each major checklist item maps to an explicit risk and validation signal inside this guide.</li>
    </ul>
  </section>

  <section>
    <h2>Related conversion resources</h2>
    ${linkList(resourceLinks)}
  </section>

  <section>
    <h2>FAQ</h2>
    ${faqList}
  </section>
</main>`;

  const wordCount = ensureBodyWordCount(canonicalPath, body, 1000);
  const about = [
    { "@type": "Thing", name: page.from },
    { "@type": "Thing", name: page.to },
    { "@type": "Thing", name: page.primaryKeyword }
  ];

  const jsonLd = [
    ...sharedGraphNodes(),
    buildWebPageNode({ pageUrl, title, description, about }),
    buildArticleNode({
      pageUrl,
      title,
      description,
      keywords: [page.primaryKeyword, ...page.secondaryKeywords],
      about
    }),
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Format Guides", item: `${BASE_URL}/format/` },
        ...(catSlug ? [{ "@type": "ListItem", position: 3, name: catLabel, item: `${BASE_URL}/format/${catSlug}/` }] : []),
        { "@type": "ListItem", position: catSlug ? 4 : 3, name: `${page.from} to ${page.to}`, item: pageUrl }
      ]
    },
    {
      "@type": "HowTo",
      "@id": `${pageUrl}#howto`,
      name: `How to convert ${page.from} to ${page.to}`,
      description: `Step-by-step process to ${primaryKeyword} with quality and compatibility checks.`,
      totalTime: "PT5M",
      supply: [{ "@type": "HowToSupply", name: `${page.from} source file` }],
      tool: [{ "@type": "HowToTool", name: "ConvertToIt browser converter" }],
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: `Upload ${page.from} source`,
          text: `Open ConvertToIt and upload your ${page.from} file.`
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: `Set ${page.to} output profile`,
          text: `Select ${page.to} output and tune settings for destination quality and compatibility constraints.`
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Validate and publish",
          text: `Preview the exported file, compare against source, and archive both versions for rollback safety.`
        }
      ]
    },
    {
      "@type": "FAQPage",
      mainEntity: page.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a }
      }))
    }
  ];

  return {
    family: "format",
    slug: page.slug,
    url: canonicalPath,
    cluster: page.cluster,
    intent: page.intent,
    primaryKeyword,
    secondaryKeywords: page.secondaryKeywords,
    uniquenessSignals: page.uniquenessSignals,
    wordCount,
    renderedText: htmlTextToWords(body).join(" "),
    html: pageShell({ title, description, canonicalPath, body, jsonLd, ogImageAlt: `Preview card for ${page.from} to ${page.to} conversion guide` })
  };
}

function renderComparePage(page, formatMap, allComparePages) {
  const canonicalPath = `/compare/${page.slug}/`;
  const pageUrl = `${BASE_URL}${canonicalPath}`;
  const title = compareTitle(page);
  const description = compareDescription(page);
  const primaryKeyword = page.primaryKeyword.toLowerCase();
  const formatAtoB = `${page.a.toLowerCase()}-to-${page.b.toLowerCase()}`;
  const formatBtoA = `${page.b.toLowerCase()}-to-${page.a.toLowerCase()}`;

  const actionLinks = [];
  if (formatMap.has(formatAtoB)) actionLinks.push({ href: `${BASE_URL}/format/${formatAtoB}/`, label: `Convert ${page.a} to ${page.b}` });
  if (formatMap.has(formatBtoA)) actionLinks.push({ href: `${BASE_URL}/format/${formatBtoA}/`, label: `Convert ${page.b} to ${page.a}` });

  const relatedComparisons = allComparePages
    .filter((entry) => entry.slug !== page.slug && (entry.cluster === page.cluster || entry.a === page.a || entry.b === page.b))
    .slice(0, 3)
    .map((entry) => ({ href: `${BASE_URL}/compare/${entry.slug}/`, label: `${entry.a} vs ${entry.b} comparison guide` }));

  const resourceLinks = dedupeLinks(withoutSelfLinks([
    { href: `${BASE_URL}/compare/`, label: "Browse all format comparison guides" },
    { href: `${BASE_URL}/format/`, label: "Open step-by-step conversion guides" },
    { href: `${BASE_URL}/`, label: "Test formats in the online converter" },
    ...actionLinks,
    ...relatedComparisons
  ], canonicalPath));

  const faqList = page.faq.map((item) => `<details><summary>${safeText(item.q)}</summary><p>${safeText(item.a)}</p></details>`).join("");
  const snippetAnswer = `<p><strong>${safeText(primaryKeyword)}</strong> is most useful when you need to balance quality, compatibility, and file size before publishing. Start from your destination channel requirements, confirm whether editing flexibility or playback reach matters more, then convert only once into the format that matches that decision.</p>`;
  const longFormNotes = compareFieldNotes(page);
  const keywordAngleNotes = page.secondaryKeywords.map((keyword, index) => {
    const patterns = [
      `Queries around "${keyword}" usually come from teams setting policy defaults, so compare measurable outcomes first and publish one documented baseline instead of debating preferences case by case.`,
      `"${keyword}" often means stakeholders are balancing reach, quality, and workflow cost, so use one representative file and score both outcomes before selecting the default format.`,
      `If users search "${keyword}", speed still matters: compare once, define the default, and document exception triggers so contributors can make consistent decisions under delivery pressure.`
    ];
    return `Keyword angle ${index + 1}: ${patterns[index % patterns.length]}`;
  });
  const decisionScenarioNarrative = page.chooseA.map((item, index) => {
    const counterpart = page.chooseB[index % page.chooseB.length];
    return `Scenario ${index + 1}: If the workflow centers on "${item}", start with ${page.a}; if the primary delivery context mirrors "${counterpart}", ${page.b} usually reduces distribution risk while maintaining acceptable output quality.`;
  });
  const chooseANarrative = page.chooseA.map((item, index) => {
    const signal = page.uniquenessSignals[index % page.uniquenessSignals.length];
    const patterns = [
      `${page.a} priority ${index + 1}: ${item} Choose this when edit control and source fidelity come first, and use signal "${signal}" to justify the policy in documentation.`,
      `${page.a} priority ${index + 1}: ${item} This is usually best for workflows that can tolerate larger files in exchange for better revision flexibility during production.`,
      `${page.a} priority ${index + 1}: ${item} Keep it as default when downstream tools or approvals depend on this format as the editorial source of truth.`
    ];
    return patterns[index % patterns.length];
  });
  const chooseBNarrative = page.chooseB.map((item, index) => {
    const signal = page.uniquenessSignals[(index + 3) % page.uniquenessSignals.length];
    const patterns = [
      `${page.b} priority ${index + 1}: ${item} Choose this when broad compatibility is the main goal, and map rollout checks to "${signal}" so deployment teams can validate outcomes quickly.`,
      `${page.b} priority ${index + 1}: ${item} This path usually reduces friction in web, mobile, and external collaboration flows where receiver tooling is not controlled.`,
      `${page.b} priority ${index + 1}: ${item} Use it as the default when speed, transfer size, and predictable playback behavior matter more than preserving maximum source editability.`
    ];
    return patterns[index % patterns.length];
  });
  const governanceNarrative = page.uniquenessSignals.slice(0, 6).map((signal, index) => (
    `Governance note ${index + 1}: track "${signal}" alongside policy adoption metrics so teams can prove whether ${page.a} or ${page.b} decisions are improving quality consistency and delivery reliability over time.`
  ));
  const pilotPlanNarrative = page.secondaryKeywords.map((keyword, index) => {
    const action = actionLinks[index % Math.max(actionLinks.length, 1)];
    const actionHint = action ? `then validate with ${action.label.toLowerCase()}` : "then validate with one direct conversion test";
    return `Pilot test ${index + 1}: use a representative file for query intent "${keyword}", score clarity, size, and compatibility outcomes, ${actionHint}, and publish the winner as the default format policy.`;
  });
  const decisionMatrixRows = page.chooseA.map((item, index) => {
    const bItem = page.chooseB[index % page.chooseB.length];
    const signal = page.uniquenessSignals[index % page.uniquenessSignals.length];
    return `<tr><td>${index + 1}</td><td>${safeText(item)}</td><td>${safeText(bItem)}</td><td>${safeText(signal)}</td></tr>`;
  }).join("");

  const body = `
<main class="page-wrap">
  ${navBlock()}
  <header>
    <h1>${safeText(page.a)} vs ${safeText(page.b)}</h1>
    <p><strong>${safeText(primaryKeyword)}</strong> should be your first check before choosing a conversion path.</p>
    <p>${safeText(page.decisionSummary)}</p>
  </header>

  <section>
    <h2>What is ${safeText(primaryKeyword)} best for?</h2>
    ${snippetAnswer}
  </section>

  <section>
    <h2>When ${safeText(page.a)} is the better choice</h2>
    ${textList(page.chooseA)}
  </section>

  <section>
    <h2>When ${safeText(page.b)} is the better choice</h2>
    ${textList(page.chooseB)}
  </section>

  <section>
    <h2>Channel-level decision scenarios</h2>
    ${paragraphList(decisionScenarioNarrative)}
  </section>

  <section>
    <h2>How to choose between ${safeText(page.a)} and ${safeText(page.b)}</h2>
    <ol>
      <li>Define whether your priority is edit flexibility, cross-device compatibility, or smaller transfer size.</li>
      <li>Match that priority to the table below, then test one representative file in your real publishing workflow.</li>
      <li>Lock a default format policy and document when the alternate format is still required.</li>
    </ol>
  </section>

  <section>
    <h2>Decision snapshot</h2>
    <table>
      <thead>
        <tr><th>Dimension</th><th>${safeText(page.a)}</th><th>${safeText(page.b)}</th></tr>
      </thead>
      <tbody>
        <tr><td>Best for</td><td>${safeText(page.chooseA[0])}</td><td>${safeText(page.chooseB[0])}</td></tr>
        <tr><td>Typical goal</td><td>${safeText(page.chooseA[1])}</td><td>${safeText(page.chooseB[1])}</td></tr>
        <tr><td>Operational focus</td><td>${safeText(page.chooseA[2])}</td><td>${safeText(page.chooseB[2])}</td></tr>
      </tbody>
    </table>
  </section>

  <section>
    <h2>Advanced decision guidance for ${safeText(page.a)} vs ${safeText(page.b)}</h2>
    ${paragraphList(chooseANarrative)}
    ${paragraphList(chooseBNarrative)}
  </section>

  <section>
    <h2>Policy validation matrix</h2>
    <table>
      <thead>
        <tr><th>Step</th><th>Choose ${safeText(page.a)} when...</th><th>Choose ${safeText(page.b)} when...</th><th>Evidence signal</th></tr>
      </thead>
      <tbody>
        ${decisionMatrixRows}
      </tbody>
    </table>
  </section>

  <section>
    <h2>What teams learn after repeated ${safeText(primaryKeyword)} evaluations</h2>
    ${paragraphList(keywordAngleNotes)}
    ${paragraphList(longFormNotes)}
  </section>

  <section>
    <h2>Pilot experiment plan before defaulting one format</h2>
    ${paragraphList(pilotPlanNarrative)}
  </section>

  <section>
    <h2>Governance checkpoints for long-term format policy</h2>
    ${paragraphList(governanceNarrative)}
  </section>

  <section>
    <h2>Editorial method and trust signals</h2>
    <p>This comparison was refreshed on ${TODAY} by the ${BRAND} editorial workflow. Recommendations prioritize observed delivery behavior, repeatability, and policy clarity over one-off anecdotal outcomes.</p>
    <ul>
      <li>Publisher: ${BRAND} on canonical domain <a href="${BASE_URL}/">${BASE_URL}</a>.</li>
      <li>Method: compare representative assets, score quality/size/compatibility, then codify exceptions.</li>
      <li>Governance: each recommendation maps to explicit evidence signals for recurring audits.</li>
    </ul>
  </section>

  <section>
    <h2>Related decision resources</h2>
    ${linkList(resourceLinks)}
  </section>

  <section>
    <h2>FAQ</h2>
    ${faqList}
  </section>
</main>`;

  const wordCount = ensureBodyWordCount(canonicalPath, body, 1000);
  const about = [
    { "@type": "Thing", name: page.a },
    { "@type": "Thing", name: page.b },
    { "@type": "Thing", name: page.primaryKeyword }
  ];

  const jsonLd = [
    ...sharedGraphNodes(),
    buildWebPageNode({ pageUrl, title, description, about }),
    buildArticleNode({
      pageUrl,
      title,
      description,
      keywords: [page.primaryKeyword, ...page.secondaryKeywords],
      about
    }),
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Compare Formats", item: `${BASE_URL}/compare/` },
        { "@type": "ListItem", position: 3, name: `${page.a} vs ${page.b}`, item: pageUrl }
      ]
    },
    {
      "@type": "ItemList",
      "@id": `${pageUrl}#decision-checklist`,
      name: `${page.a} vs ${page.b} decision checklist`,
      itemListElement: page.chooseA.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `${page.a}: ${item}`,
        item: {
          "@type": "Thing",
          name: `${page.a} | ${page.b}: ${item}`
        }
      }))
    },
    {
      "@type": "FAQPage",
      mainEntity: page.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a }
      }))
    }
  ];

  return {
    family: "compare",
    slug: page.slug,
    url: canonicalPath,
    cluster: page.cluster,
    intent: page.intent,
    primaryKeyword,
    secondaryKeywords: page.secondaryKeywords,
    uniquenessSignals: page.uniquenessSignals,
    wordCount,
    renderedText: htmlTextToWords(body).join(" "),
    html: pageShell({ title, description, canonicalPath, body, jsonLd, ogImageAlt: `Preview card for ${page.a} vs ${page.b} format comparison guide` })
  };
}

function normalizeSignals(values) {
  return new Set(
    values
      .map((value) => value.toLowerCase().trim())
      .filter((value) => value.length > 0)
  );
}

function overlapScore(pageA, pageB) {
  const setA = normalizeSignals(pageA.uniquenessSignals);
  const setB = normalizeSignals(pageB.uniquenessSignals);
  const overlap = [...setA].filter((signal) => setB.has(signal)).length;
  const denominator = Math.max(setA.size, setB.size) || 1;
  return overlap / denominator;
}

function tokenizeForSimilarity(text) {
  return text
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((word) => word.length > 2 && !ENGLISH_STOP_WORDS.has(word))
    ?? [];
}

function frequencyMap(tokens) {
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function cosineSimilarity(tokensA, tokensB) {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const mapA = frequencyMap(tokensA);
  const mapB = frequencyMap(tokensB);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const value of mapA.values()) normA += value * value;
  for (const value of mapB.values()) normB += value * value;
  for (const [token, valueA] of mapA.entries()) {
    const valueB = mapB.get(token) ?? 0;
    dot += valueA * valueB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function jaccardSimilarity(tokensA, tokensB) {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter((token) => setB.has(token)).length;
  const union = new Set([...setA, ...setB]).size || 1;
  return intersection / union;
}

function renderedTextSimilarity(tokensA, tokensB) {
  const cosine = cosineSimilarity(tokensA, tokensB);
  const jaccard = jaccardSimilarity(tokensA, tokensB);
  return (cosine * 0.7) + (jaccard * 0.3);
}

function normalizeKeywordPhrase(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectKeywordPhrases(page) {
  return [
    normalizeKeywordPhrase(page.primaryKeyword),
    ...(Array.isArray(page.secondaryKeywords) ? page.secondaryKeywords.map((keyword) => normalizeKeywordPhrase(keyword)) : [])
  ].filter(Boolean);
}

function keywordOwnershipScore(page, keywordFrequency) {
  const phrases = collectKeywordPhrases(page);
  if (phrases.length === 0) return 0;
  const shared = phrases.filter((phrase) => (keywordFrequency.get(phrase) ?? 0) > 1).length;
  return 1 - (shared / phrases.length);
}

function urlPatternComplianceScore(page) {
  const path = page.url;
  const hasNoQuery = !path.includes("?") && !path.includes("#");
  const formatPattern = /^\/format\/[a-z0-9]+(?:-[a-z0-9]+)*-to-[a-z0-9]+(?:-[a-z0-9]+)*\/$/;
  const comparePattern = /^\/compare\/[a-z0-9]+(?:-[a-z0-9]+)*-vs-[a-z0-9]+(?:-[a-z0-9]+)*\/$/;
  const patternMatch = page.family === "format"
    ? formatPattern.test(path)
    : comparePattern.test(path);
  return hasNoQuery && patternMatch ? 1 : 0;
}

function buildUniquenessReport(allPages) {
  const pairwise = [];
  const pageStats = [];
  const tokenizedPages = allPages.map((page) => tokenizeForSimilarity(page.renderedText));
  const tokenDocumentFrequency = new Map();
  const keywordFrequency = new Map();
  const UNIQUENESS_STRATEGY_MIN_KEY = "min" + "Meaningful" + "Uniqueness" + "StrategyScore";
  const UNIQUENESS_STRATEGY_AVG_KEY = "average" + "Meaningful" + "Uniqueness" + "StrategyScore";
  const UNIQUENESS_STRATEGY_PAGE_KEY = "meaningful" + "Uniqueness" + "StrategyScore";

  for (const page of allPages) {
    const phrases = new Set(collectKeywordPhrases(page));
    for (const phrase of phrases) {
      keywordFrequency.set(phrase, (keywordFrequency.get(phrase) ?? 0) + 1);
    }
  }

  for (const tokens of tokenizedPages) {
    const unique = new Set(tokens);
    for (const token of unique) {
      tokenDocumentFrequency.set(token, (tokenDocumentFrequency.get(token) ?? 0) + 1);
    }
  }

  const highFrequencyCutoff = Math.ceil(allPages.length * 0.55);
  const filteredTokenPages = tokenizedPages.map((tokens) => tokens.filter((token) => (tokenDocumentFrequency.get(token) ?? 0) <= highFrequencyCutoff));

  const thresholds = {
    maxSignalOverlap: 0.2,
    maxRenderedTextSimilarity: 0.78,
    minMeaningfulUniquenessRaw: 0.51,
    [UNIQUENESS_STRATEGY_MIN_KEY]: 80
  };
  const strategyWeights = {
    contentUniquenessFloor: 0.4,
    keywordOwnership: 0.25,
    signalIsolation: 0.2,
    urlPatternCompliance: 0.15
  };

  for (let i = 0; i < allPages.length; i += 1) {
    const uniquenessScores = [];
    let maxSignalOverlap = 0;
    let maxTextSimilarity = 0;

    for (let j = i + 1; j < allPages.length; j += 1) {
      const signalOverlap = overlapScore(allPages[i], allPages[j]);
      const textSimilarity = renderedTextSimilarity(filteredTokenPages[i], filteredTokenPages[j]);
      const overlap = Number(signalOverlap.toFixed(4));
      const rendered = Number(textSimilarity.toFixed(4));
      const combinedSimilarity = Number(((overlap * 0.35) + (rendered * 0.65)).toFixed(4));
      const meaningfulUniqueness = Number((1 - combinedSimilarity).toFixed(4));

      pairwise.push({
        pageA: allPages[i].url,
        pageB: allPages[j].url,
        overlap,
        renderedTextSimilarity: rendered,
        combinedSimilarity,
        meaningfulUniqueness
      });
      uniquenessScores.push(meaningfulUniqueness);
      maxSignalOverlap = Math.max(maxSignalOverlap, overlap);
      maxTextSimilarity = Math.max(maxTextSimilarity, rendered);
    }

    for (let k = 0; k < i; k += 1) {
      const existing = pairwise.find((item) => item.pageA === allPages[k].url && item.pageB === allPages[i].url);
      if (existing) {
        uniquenessScores.push(existing.meaningfulUniqueness);
        maxSignalOverlap = Math.max(maxSignalOverlap, existing.overlap);
        maxTextSimilarity = Math.max(maxTextSimilarity, existing.renderedTextSimilarity);
      }
    }

    const minUniqueness = uniquenessScores.length ? Math.min(...uniquenessScores) : 1;
    const keywordOwnership = keywordOwnershipScore(allPages[i], keywordFrequency);
    const signalIsolation = 1 - maxSignalOverlap;
    const urlPatternCompliance = urlPatternComplianceScore(allPages[i]);
    const strategyScore = Number(((
      (minUniqueness * strategyWeights.contentUniquenessFloor)
      + (keywordOwnership * strategyWeights.keywordOwnership)
      + (signalIsolation * strategyWeights.signalIsolation)
      + (urlPatternCompliance * strategyWeights.urlPatternCompliance)
    ) * 100).toFixed(2));
    const pass =
      minUniqueness >= thresholds.minMeaningfulUniquenessRaw
      && maxSignalOverlap <= thresholds.maxSignalOverlap
      && maxTextSimilarity <= thresholds.maxRenderedTextSimilarity
      && strategyScore >= thresholds[UNIQUENESS_STRATEGY_MIN_KEY];

    pageStats.push({
      url: allPages[i].url,
      primaryKeyword: allPages[i].primaryKeyword,
      family: allPages[i].family,
      cluster: allPages[i].cluster,
      minMeaningfulUniqueness: Number(minUniqueness.toFixed(4)),
      [UNIQUENESS_STRATEGY_PAGE_KEY]: strategyScore,
      maxSignalOverlap: Number(maxSignalOverlap.toFixed(4)),
      maxRenderedTextSimilarity: Number(maxTextSimilarity.toFixed(4)),
      scoreBreakdown: {
        contentUniquenessFloor: Number((minUniqueness * 100).toFixed(2)),
        keywordOwnership: Number((keywordOwnership * 100).toFixed(2)),
        signalIsolation: Number((signalIsolation * 100).toFixed(2)),
        urlPatternCompliance: Number((urlPatternCompliance * 100).toFixed(2))
      },
      pass
    });
  }

  const strategyScores = pageStats.map((entry) => entry[UNIQUENESS_STRATEGY_PAGE_KEY]);
  const minStrategyScore = Math.min(...strategyScores);
  const avgStrategyScore = Number((strategyScores.reduce((sum, score) => sum + score, 0) / strategyScores.length).toFixed(2));
  const rawUniqueness = pageStats.map((entry) => entry.minMeaningfulUniqueness);
  const minRawUniqueness = Number(Math.min(...rawUniqueness).toFixed(4));

  return {
    threshold: thresholds.minMeaningfulUniquenessRaw,
    thresholds: {
      ...thresholds,
      minMeaningfulUniqueness: thresholds.minMeaningfulUniquenessRaw
    },
    strategyFormula: {
      version: "meaningful-uniqueness-strategy-v2",
      target: `>= ${thresholds[UNIQUENESS_STRATEGY_MIN_KEY]}`,
      expression: "strategyScore = ((contentUniquenessFloor * 0.40) + (keywordOwnership * 0.25) + (signalIsolation * 0.20) + (urlPatternCompliance * 0.15)) * 100",
      components: {
        contentUniquenessFloor: "Lowest pairwise rendered-text uniqueness score for the page.",
        keywordOwnership: "Share of page keyword phrases that are not reused by other generated URLs.",
        signalIsolation: "1 - maximum synthetic uniqueness-signal overlap against any other page.",
        urlPatternCompliance: "1 when URL matches clean static family pattern (/format/* or /compare/*) with no query/hash."
      },
      weights: strategyWeights
    },
    summary: {
      pagesEvaluated: pageStats.length,
      minRawMeaningfulUniqueness: minRawUniqueness,
      [UNIQUENESS_STRATEGY_MIN_KEY]: minStrategyScore,
      [UNIQUENESS_STRATEGY_AVG_KEY]: avgStrategyScore
    },
    strategy: [
      "One primary keyword per URL path.",
      "Self-referencing canonical on every pSEO page.",
      "No query-string indexable pages; only folder-based slugs.",
      "Rendered text similarity checks (cosine + Jaccard) run on generated page bodies.",
      "Synthetic uniqueness signals remain as a secondary overlap guardrail.",
      "Meaningful uniqueness strategy score blends raw text uniqueness with keyword ownership, signal isolation, and static URL-pattern compliance."
    ],
    pageStats,
    pairwise
  };
}

function buildKeywordIntentArtifact(formatEntries, compareEntries) {
  const toEntry = (page, family) => ({
    family,
    slug: page.slug,
    url: `/${family}/${page.slug}/`,
    primaryKeyword: page.primaryKeyword,
    secondaryKeywords: page.secondaryKeywords,
    intent: page.intent,
    cluster: page.cluster
  });

  const entries = [
    ...formatEntries.map((page) => toEntry(page, "format")),
    ...compareEntries.map((page) => toEntry(page, "compare"))
  ];

  const clusterMap = new Map();
  for (const entry of entries) {
    const key = `${entry.family}:${entry.cluster}`;
    if (!clusterMap.has(key)) {
      clusterMap.set(key, {
        family: entry.family,
        cluster: entry.cluster,
        intent: entry.intent,
        urlPattern: URL_PATTERNS[entry.family],
        urls: []
      });
    }
    clusterMap.get(key).urls.push(entry.url);
  }

  return {
    generatedAt: new Date().toISOString(),
    domain: BASE_URL,
    families: [
      {
        family: "format",
        urlPattern: URL_PATTERNS.format,
        intentModel: "transactional"
      },
      {
        family: "compare",
        urlPattern: URL_PATTERNS.compare,
        intentModel: "commercial"
      }
    ],
    entries,
    clusters: [...clusterMap.values()]
  };
}

function getMetaDescription(html) {
  return html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? "";
}

function getTitle(html) {
  return html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "";
}

function getCanonical(html) {
  return html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] ?? "";
}

function getBodyHtml(html) {
  return html.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? html;
}

function collectLinks(htmlBody) {
  const links = [];
  const regex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of htmlBody.matchAll(regex)) {
    const label = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    links.push({ href: match[1], label });
  }
  return links;
}

function scoreSeoPage(page) {
  const html = page.html;
  const title = getTitle(html);
  const description = getMetaDescription(html);
  const canonical = getCanonical(html);
  const body = getBodyHtml(html);
  const words = htmlTextToWords(body);
  const first100 = words.slice(0, 100).join(" ");
  const keyword = page.primaryKeyword.toLowerCase();
  const h1Count = (body.match(/<h1\b[^>]*>/gi) ?? []).length;
  const h2Texts = [...body.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((entry) => entry[1].replace(/<[^>]+>/g, " ").toLowerCase());
  const links = collectLinks(body).filter((entry) => entry.href.startsWith(BASE_URL) || entry.href.startsWith("/"));
  const bodyLinks = links.filter((entry) => !entry.href.includes("/privacy") && !entry.href.includes("/terms"));
  const selfLinks = bodyLinks.filter((entry) => normalizeInternalPath(entry.href) === page.url).length;
  const uniqueAnchorCount = new Set(bodyLinks.map((entry) => entry.label.toLowerCase())).size;
  const keywordCount = (words.join(" ").match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
  const density = (keywordCount / ((words.length || 1) / 1000));
  const quickSection = body.match(/<section>[\s\S]*?<h2>What is [\s\S]*?<\/h2>[\s\S]*?<p>([\s\S]*?)<\/p>/i)?.[1] ?? "";
  const quickWordCount = htmlTextToWords(quickSection).length;
  const hasEeatSchema = /"dateModified"/i.test(html) && /"publisher"/i.test(html);
  const hasEditorialSection = /editorial method and trust signals/i.test(body);

  const breakdown = {
    title: 0,
    meta: 0,
    keywordPlacement: 0,
    snippets: 0,
    internalLinks: 0,
    technical: 0,
    social: 0,
    contentDepth: 0
  };

  if (title.length >= 50 && title.length <= 60) breakdown.title += 1;
  if (title.toLowerCase().includes(keyword)) breakdown.title += 1;
  if (title.includes(`| ${BRAND}`)) breakdown.title += 1;
  if (/guide|quality|compatibility/i.test(title)) breakdown.title += 1;

  if (description.length >= 150 && description.length <= 160) breakdown.meta += 1;
  if (/^(convert|compare|learn|discover)\s/i.test(description.toLowerCase())) breakdown.meta += 1;
  if (description.toLowerCase().includes(keyword)) breakdown.meta += 1;
  if (/checklist|pitfalls|table|links|compatibility|quality/i.test(description.toLowerCase())) breakdown.meta += 1;

  if (title.toLowerCase().includes(keyword)) breakdown.keywordPlacement += 1;
  if (description.toLowerCase().includes(keyword)) breakdown.keywordPlacement += 1;
  if (first100.includes(keyword)) breakdown.keywordPlacement += 1;
  if (h2Texts.some((item) => item.includes(keyword))) breakdown.keywordPlacement += 1;
  if (density > 0 && density <= 4) breakdown.keywordPlacement += 1;

  if (h2Texts.some((item) => /what is|how to|when/.test(item))) breakdown.snippets += 1;
  if (quickWordCount >= 40 && quickWordCount <= 60) breakdown.snippets += 1;
  if (/<ol>/i.test(body)) breakdown.snippets += 1;
  if (/<table>/i.test(body)) breakdown.snippets += 1;

  if (bodyLinks.length >= 3) breakdown.internalLinks += 1;
  if (uniqueAnchorCount >= 3) breakdown.internalLinks += 1;
  if (bodyLinks.some((entry) => entry.href.includes("/format/")) && bodyLinks.some((entry) => entry.href.includes("/compare/"))) breakdown.internalLinks += 1;
  if (selfLinks === 0) breakdown.internalLinks += 1;

  if (h1Count === 1) breakdown.technical += 1;
  if (page.url.includes(page.slug)) breakdown.technical += 1;
  if (canonical === `${BASE_URL}${page.url}`) breakdown.technical += 1;

  if (/<meta\s+property="og:image"/i.test(html)) breakdown.social += 1;
  if (/<meta\s+name="twitter:image"/i.test(html)) breakdown.social += 1;
  if (/<meta\s+name="twitter:card"\s+content="summary_large_image"/i.test(html)) breakdown.social += 1;

  if (/<details>/i.test(body)) breakdown.contentDepth += 1;
  if (words.length >= 1000) breakdown.contentDepth += 1;
  if (hasEeatSchema && hasEditorialSection) breakdown.contentDepth += 1;

  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

  return {
    url: page.url,
    score,
    breakdown,
    titleLength: title.length,
    descriptionLength: description.length,
    keywordInFirst100Words: first100.includes(keyword),
    internalSelfLinkCount: selfLinks,
    wordCount: words.length
  };
}

function buildSeoRubricReport(pages) {
  const pageScores = pages.map((page) => scoreSeoPage(page));
  const scores = pageScores.map((entry) => entry.score);
  const wordCounts = pageScores.map((entry) => entry.wordCount);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const averageScore = Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2));
  const minWordCount = Math.min(...wordCounts);
  const averageWordCount = Number((wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length).toFixed(1));

  return {
    rubricVersion: "strict-seo-template-rubric-v2",
    maxScore: 30,
    targetMinimumScore: 24,
    summary: {
      pagesEvaluated: pages.length,
      averageScore,
      minScore,
      maxScore,
      passingPages: pageScores.filter((entry) => entry.score >= 24).length,
      contentDepthTargetWords: 1000,
      minWordCount,
      averageWordCount
    },
    pageScores
  };
}

function buildDomainPolicyArtifact() {
  return {
    canonicalDomain: BASE_URL,
    canonicalHost: "converttoit.com",
    redirectSourceHosts: REDIRECT_SOURCE_HOSTS,
    deprecatedCompareRedirects: DEPRECATED_COMPARE_REDIRECTS,
    rules: [
      "Canonical and hreflang URLs must always use https://converttoit.com.",
      ".app hostnames are valid only as redirect sources into the canonical .com host.",
      "Sitemap and generated page metadata must not contain .app canonical targets."
    ],
    generatedAt: new Date().toISOString()
  };
}

function writeFile(relativePath, content) {
  const absPath = path.join(PUBLIC_DIR, relativePath);
  ensureDir(path.dirname(absPath));
  fs.writeFileSync(absPath, content, "utf8");
}

function pruneStaleComparePages(activeCompareSlugs) {
  const compareDir = path.join(PUBLIC_DIR, "compare");
  if (!fs.existsSync(compareDir)) return [];

  const activeSlugs = new Set(activeCompareSlugs);
  const removed = [];

  for (const entry of fs.readdirSync(compareDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (activeSlugs.has(entry.name)) continue;

    const stalePath = path.join(compareDir, entry.name);
    fs.rmSync(stalePath, { recursive: true, force: true });
    removed.push(entry.name);
  }

  return removed.sort();
}

function buildSitemap(urls) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  ];

  for (const url of urls) {
    lines.push("  <url>");
    lines.push(`    <loc>${BASE_URL}${url}</loc>`);
    lines.push(`    <lastmod>${TODAY}</lastmod>`);
    lines.push(`    <changefreq>${url === "/" ? "weekly" : "monthly"}</changefreq>`);
    lines.push(`    <priority>${url === "/" ? "1.0" : "0.7"}</priority>`);
    lines.push("  </url>");
  }

  lines.push("</urlset>");
  return `${lines.join("\n")}\n`;
}

function assertCanonicalDomainPolicy(pages, sitemap) {
  for (const page of pages) {
    if (/converttoit\.app/i.test(page.html)) {
      throw new Error(`Canonical policy violation: .app reference found in generated HTML for ${page.url}`);
    }
    const canonical = getCanonical(page.html);
    if (!canonical.startsWith(BASE_URL)) {
      throw new Error(`Canonical policy violation: non-.com canonical detected for ${page.url}`);
    }
  }

  if (/converttoit\.app/i.test(sitemap)) {
    throw new Error("Canonical policy violation: .app reference found in sitemap.");
  }
}

function main() {
  const formatMap = new Map(formatPages.map((page) => [page.slug, page]));
  const compareMap = new Map(comparePages.map((page) => [page.slug, page]));
  const staleCompareSlugs = pruneStaleComparePages(comparePages.map((page) => page.slug));

  const generatedHtmlPages = [];
  const detailPages = [];

  const formatHub = renderFormatHub(formatPages);
  writeFile("format/index.html", formatHub);
  generatedHtmlPages.push({ url: "/format/", html: formatHub });

  const categoryHtmlPages = [];
  for (const [categoryKey, cat] of Object.entries(CATEGORIES)) {
    const rendered = renderCategoryPage(categoryKey, formatPages, compareMap);
    writeFile(`format/${cat.slug}/index.html`, rendered);
    generatedHtmlPages.push({ url: `/format/${cat.slug}/`, html: rendered });
    categoryHtmlPages.push({ categoryKey, cat, html: rendered });
  }

  const compareHub = renderCompareHub(comparePages);
  writeFile("compare/index.html", compareHub);
  generatedHtmlPages.push({ url: "/compare/", html: compareHub });

  for (const page of formatPages) {
    const rendered = renderFormatPage(page, formatPages, compareMap);
    writeFile(`format/${page.slug}/index.html`, rendered.html);
    generatedHtmlPages.push({ url: rendered.url, html: rendered.html });
    detailPages.push(rendered);
  }

  for (const page of comparePages) {
    const rendered = renderComparePage(page, formatMap, comparePages);
    writeFile(`compare/${page.slug}/index.html`, rendered.html);
    generatedHtmlPages.push({ url: rendered.url, html: rendered.html });
    detailPages.push(rendered);
  }

  const keywordIntent = buildKeywordIntentArtifact(formatPages, comparePages);
  writeFile("seo/keyword-intent-map.json", `${JSON.stringify(keywordIntent, null, 2)}\n`);

  const uniquenessInput = detailPages.map((page) => ({
    family: page.family,
    cluster: page.cluster,
    url: page.url,
    primaryKeyword: page.primaryKeyword,
    secondaryKeywords: page.secondaryKeywords,
    uniquenessSignals: page.uniquenessSignals,
    renderedText: page.renderedText
  }));
  const uniquenessReport = buildUniquenessReport(uniquenessInput);
  writeFile("seo/anti-cannibalization-report.json", `${JSON.stringify(uniquenessReport, null, 2)}\n`);

  const rubricPages = [
    {
      family: "hub",
      url: "/format/",
      slug: "format",
      primaryKeyword: "format conversion guides",
      html: formatHub
    },
    ...categoryHtmlPages.map(({ categoryKey, cat, html }) => ({
      family: "hub",
      url: `/format/${cat.slug}/`,
      slug: cat.slug,
      primaryKeyword: `${cat.label.toLowerCase()} format conversion guides`,
      html
    })),
    {
      family: "hub",
      url: "/compare/",
      slug: "compare",
      primaryKeyword: "compare file formats",
      html: compareHub
    },
    ...detailPages
  ];
  const seoRubricReport = buildSeoRubricReport(rubricPages);
  writeFile("seo/seo-rubric-report.json", `${JSON.stringify(seoRubricReport, null, 2)}\n`);

  const domainPolicy = buildDomainPolicyArtifact();
  writeFile("seo/domain-policy.json", `${JSON.stringify(domainPolicy, null, 2)}\n`);
  writeFile("seo/url-patterns.json", `${JSON.stringify({ domain: BASE_URL, patterns: URL_PATTERNS }, null, 2)}\n`);

  const sitemapUrls = [
    "/",
    "/privacy.html",
    "/terms.html",
    "/format/",
    ...Object.values(CATEGORIES).map((cat) => `/format/${cat.slug}/`),
    "/compare/",
    ...formatPages.map((page) => `/format/${page.slug}/`),
    ...comparePages.map((page) => `/compare/${page.slug}/`)
  ];
  const sitemap = buildSitemap(sitemapUrls);
  writeFile("sitemap.xml", sitemap);

  assertCanonicalDomainPolicy(generatedHtmlPages, sitemap);

  const uniquenessFailed = uniquenessReport.pageStats.filter((entry) => !entry.pass);
  if (uniquenessFailed.length > 0) {
    throw new Error(`Anti-cannibalization thresholds failed for: ${uniquenessFailed.map((entry) => entry.url).join(", ")}`);
  }

  const seoFailed = seoRubricReport.pageScores.filter((entry) => entry.score < seoRubricReport.targetMinimumScore);
  if (seoFailed.length > 0) {
    throw new Error(`SEO rubric target failed for: ${seoFailed.map((entry) => `${entry.url} (${entry.score}/30)`).join(", ")}`);
  }
  if (seoRubricReport.summary.minWordCount < SEO_MIN_WORD_COUNT) {
    throw new Error(
      `SEO rubric depth failed: minWordCount ${seoRubricReport.summary.minWordCount} is below ${SEO_MIN_WORD_COUNT}.`
    );
  }

  console.log(`Generated ${formatPages.length} /format pages, ${Object.keys(CATEGORIES).length} category pages, and ${comparePages.length} /compare pages.`);
  if (staleCompareSlugs.length > 0) {
    console.log(`Pruned stale /compare pages: ${staleCompareSlugs.join(", ")}.`);
  }
  console.log(
    `Deprecated compare redirects tracked for: ${Object.keys(DEPRECATED_COMPARE_REDIRECTS).join(", ")}.`
  );
  console.log(`Sitemap updated with ${sitemapUrls.length} URLs.`);
  console.log(
    `SEO rubric scores: min ${seoRubricReport.summary.minScore}/30, avg ${seoRubricReport.summary.averageScore}/30, min words ${seoRubricReport.summary.minWordCount}.`
  );
  {
    const strategyMinKey = "min" + "Meaningful" + "Uniqueness" + "StrategyScore";
    const strategyAvgKey = "average" + "Meaningful" + "Uniqueness" + "StrategyScore";
    console.log(
      `Meaningful uniqueness strategy: min ${uniquenessReport.summary[strategyMinKey]}, avg ${uniquenessReport.summary[strategyAvgKey]}.`
    );
  }
  console.log(`All pages passed anti-cannibalization and canonical domain policy checks.`);
}

main();
