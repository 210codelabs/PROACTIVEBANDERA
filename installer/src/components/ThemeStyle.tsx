import { getSiteConfig } from "@/lib/site/config";
import { buildThemeCss } from "@/lib/site/theme";

// Server component: injects the deployment's brand palette as CSS variables so
// every Tailwind `brand-*` utility across the app re-themes from the /setup
// wizard's chosen primary color. Rendered once at the top of <body> in the root
// layout. Uses dangerouslySetInnerHTML for a static, server-generated style.
export default async function ThemeStyle() {
  const config = await getSiteConfig();
  const css = buildThemeCss(config.colors);
  return <style id="brand-theme" dangerouslySetInnerHTML={{ __html: css }} />;
}
