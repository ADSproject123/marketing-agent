# Rachana AI — Website Brand Asset Kit

Solid colors throughout. No linear/radial gradients. All marks are derived from the selected first logo design.

## Folders
- `logo/`: transparent icon marks and full horizontal logo with/without tagline, SVG + PNG. Use `logo-horizontal-light.svg` on a light website header and `logo-horizontal-dark.svg` on a dark header.
- `icons/`: favicons, Android/PWA icons, Apple touch icon, and square app icons.
- `social/`: Open Graph preview images (1200 × 630), light and dark.
- `brand/`: CSS variables and JSON color tokens.

## Suggested setup (Next.js)
Copy `logo`, `icons`, and `social` into `public/rachana/`.

```tsx
import Image from 'next/image';
<Image src="/rachana/logo/logo-horizontal-light.svg" alt="Rachana AI" width={360} height={76} />
```

For `app/layout.tsx`:

```tsx
export const metadata = {
  title: 'Rachana AI — AI Marketing Video Generator',
  description: 'Create marketing videos in minutes with AI.',
  icons: {
    icon: '/rachana/icons/favicon.ico',
    apple: '/rachana/icons/apple-touch-icon.png',
  },
  openGraph: { images: ['/rachana/social/og-image-light.png'] },
};
```

Note: SVG wordmark uses Inter/Arial text and will render based on available fonts; PNG variants are fixed raster renders. The mark was reconstructed from the approved reference image, so inspect before final trademark/production use.
