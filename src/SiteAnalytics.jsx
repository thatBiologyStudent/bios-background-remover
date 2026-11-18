import { Analytics } from '@vercel/analytics/react';

const BASE = import.meta.env.BASE_URL;
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

/**
 * Vercel Web Analytics (cookieless page views). Script and endpoint follow the base path, so when the app
 * is shown inside another site (e.g. /tools/background-remover/ via a rewrite) the views count for this
 * project, not the host site. Off when running locally.
 */
export function SiteAnalytics() {
  if (isLocal) return null;
  return <Analytics mode="production" scriptSrc={`${BASE}_vercel/insights/script.js`} endpoint={`${BASE}_vercel/insights`} />;
}
