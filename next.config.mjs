/** @type {import('next').NextConfig} */

/*
 * Content-Security-Policy directives, assembled per-directive for readability.
 * Each line maps to one CSP directive and documents why the sources are allowed.
 */
const cspDirectives = [
  /* Fallback for any resource type not covered by a more specific directive */
  "default-src 'self'",

  /*
   * Scripts: 'self' covers our own bundles.
   * 'unsafe-inline' is required because Next.js 14 App Router injects inline
   * <script> tags for hydration data (__NEXT_DATA__, flight payload).
   * 'unsafe-eval' is omitted — none of our code relies on eval().
   */
  "script-src 'self' 'unsafe-inline'",

  /*
   * Styles: 'self' for our CSS bundles, 'unsafe-inline' for JSX style={...}
   * attributes used across 40+ components (Recharts, inline theming, etc.).
   * Google Fonts stylesheet is loaded from fonts.googleapis.com in layout.tsx.
   */
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

  /* Font files served by Google Fonts CDN, referenced from the stylesheet above */
  "font-src 'self' https://fonts.gstatic.com",

  /*
   * Images: Supabase Storage hosts user avatars and task attachments.
   * data: is needed for inline SVG icons used by Recharts and Lucide.
   */
  "img-src 'self' https://*.supabase.co https://*.supabase.in data:",

  /*
   * XHR / fetch / WebSocket targets:
   * - 'self' for /api/* routes
   * - Supabase JS client connects to the project's REST + Realtime endpoints
   */
  "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in",

  /* This app never needs to be framed — block all embedding to prevent clickjacking */
  "frame-ancestors 'none'",

  /* Restrict <base href> to same origin, preventing base-tag hijacking attacks */
  "base-uri 'self'",

  /* Forms may only submit to our own origin (Supabase Auth flows use JS, not <form>) */
  "form-action 'self'",

  /* Block all <object>, <embed>, <applet> — the app uses none of these elements */
  "object-src 'none'",
];

const ContentSecurityPolicy = cspDirectives.join("; ");

const securityHeaders = [
  /*
   * CSP: primary defense-in-depth header that restricts which origins may serve
   * scripts, styles, images, fonts, and connections for pages on this domain.
   */
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },

  /*
   * Prevent MIME-type sniffing — forces the browser to trust the declared
   * Content-Type, blocking attacks that disguise executable content as images.
   */
  { key: "X-Content-Type-Options", value: "nosniff" },

  /*
   * Controls how much referrer information is sent with navigation and
   * sub-resource requests. 'strict-origin-when-cross-origin' sends the full
   * URL for same-origin requests but only the origin for cross-origin, and
   * nothing when downgrading from HTTPS to HTTP.
   */
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  /*
   * Equivalent to CSP frame-ancestors 'none' for older browsers that do not
   * support CSP. Prevents the site from being rendered inside an <iframe>,
   * mitigating clickjacking attacks.
   */
  { key: "X-Frame-Options", value: "DENY" },

  /*
   * Opt in to cross-origin isolation policies. 'require-corp' blocks any
   * cross-origin resource that does not explicitly grant permission via CORS
   * or Cross-Origin-Resource-Policy headers. This prevents speculative
   * side-channel attacks (e.g., Spectre) by ensuring the browser process
   * does not load untrusted cross-origin data.
   *
   * Disabled for now — Supabase Storage and Google Fonts do not always send
   * the required CORP/CORS headers, which would cause those resources to be
   * blocked. Uncomment when all external origins support CORP.
   */
  // { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },

  /*
   * Tells the browser to always upgrade HTTP requests to HTTPS and to
   * consider the domain HSTS-eligible. max-age=63072000 is two years.
   * includeSubDomains ensures all subdomains are also HTTPS-only.
   *
   * Note: only effective when the site is served over HTTPS. Ignored on
   * localhost during development.
   */
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },

  /*
   * Declares that this origin's resources should not be accessible to other
   * origins unless they have explicit CORS permission. Prevents cross-origin
   * reads of resources that were not intended to be shared.
   */
  { key: "X-DNS-Prefetch-Control", value: "on" },

  /*
   * Controls the Permissions-Policy (formerly Feature-Policy). Disables
   * access to hardware APIs that this application never uses — camera,
   * microphone, geolocation, and payment. An empty allowlist '()' means
   * "no origin, including self, may use this feature."
   */
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  poweredByHeader: false,

  /*
   * Apply security headers to every response. The source pattern '/:path*'
   * matches all routes — pages, API handlers, and static assets alike.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
