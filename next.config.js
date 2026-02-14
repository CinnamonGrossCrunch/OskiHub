/** @type {import('next').NextConfig} */
// Force rebuild: v4 - Vercel CDN cache invalidation
const nextConfig = {
  // Configure the output file tracing root to prevent workspace warnings
  outputFileTracingRoot: __dirname,
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Fallback for Node.js modules in client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
        constants: false,
        url: false,
        buffer: false,
        util: false,
        os: false,
        crypto: false,
        events: false,
        assert: false,
      };

      // Ignore node-ical and other server-only modules
      config.resolve.alias = {
        ...config.resolve.alias,
        'node-ical': false,
      };
    }
    return config;
  },
  
  // Security headers
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: process.env.NODE_ENV === 'production' ? 'DENY' : 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com https://vercel.live https://www.clarity.ms; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com https://vercel.live https://www.clarity.ms https://*.clarity.ms; frame-src https://vercel.live;"
          }
        ],
      },
    ];
  },

  // Force HTTPS redirects in production
  async redirects() {
    return [
      // Only apply in production
      ...(process.env.NODE_ENV === 'production' ? [
        {
          source: '/(.*)',
          has: [
            {
              type: 'header',
              key: 'x-forwarded-proto',
              value: 'http',
            },
          ],
          destination: 'https://$host/$1',
          permanent: true,
        },
      ] : []),
    ];
  },

  // Image optimization with security
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

module.exports = nextConfig;