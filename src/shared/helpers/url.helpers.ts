export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

export function buildUrl({
    protocol = "https",
    host = "about:blank",
    path = "",
    search = {},
    hash = ""
  }: {
    protocol?: string,
    host?: string,
    path?: string,
    search?: Record<string, string | string[]>,
    hash?: string
  }): URL {
    const url = new URL(`${protocol}://${host}${path}`);
    url.hash = hash;
  
    for (const [key, value] of Object.entries(search)) {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
      } else {
        url.searchParams.append(key, value);
      }
    }
  
    return url;
  }
