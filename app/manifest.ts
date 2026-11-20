import type { MetadataRoute } from "next";

// The web app manifest. With it, iPhone and Android can add the app to the home
// screen and open it full screen, without an app store.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bubble Bee",
    short_name: "Bubble Bee",
    description: "Find a room in a share house, or fill a room in yours.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ca8a04",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
