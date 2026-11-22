// Loads the Google Maps JavaScript API once, in the browser. The key is the
// public browser key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY). Restrict it in Google
// Cloud to your website addresses.

/** The parts of the Google Maps API the suburb map uses. */
export type MapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => unknown;
  Circle: new (options: Record<string, unknown>) => unknown;
  InfoWindow: new (options: Record<string, unknown>) => { open(options: { map: unknown }): void };
};

type WindowWithGoogle = Window & { google?: { maps?: MapsApi } };

let loading: Promise<MapsApi> | null = null;

export function loadGoogleMaps(key: string): Promise<MapsApi> {
  const existing = (window as WindowWithGoogle).google?.maps;
  if (existing) return Promise.resolve(existing);

  loading ??= new Promise<MapsApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.onload = () => {
      const maps = (window as WindowWithGoogle).google?.maps;
      if (maps) {
        resolve(maps);
      } else {
        loading = null;
        reject(new Error("Google Maps did not load."));
      }
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("Google Maps could not be reached."));
    };
    document.head.appendChild(script);
  });
  return loading;
}
