/**
 * Geocode an address to latitude/longitude using OpenStreetMap Nominatim.
 * Free, no API key required. Rate limited to 1 request/second.
 * https://nominatim.org/release-docs/develop/api/Search/
 */
export async function geocodeAddress(address: {
  street?: string | null;
  housenumber?: string | null;
  city?: string | null;
  country?: string | null;
}): Promise<{ latitude: number; longitude: number } | null> {
  const parts = [
    address.street && address.housenumber
      ? `${address.street} ${address.housenumber}`
      : address.street,
    address.city,
    address.country,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  const query = parts.join(", ");

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
        q: query,
        format: "json",
        limit: "1",
      })}`,
      {
        headers: {
          "User-Agent": "AssetTracker/1.0",
        },
      },
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);

    if (isNaN(lat) || isNaN(lon)) return null;

    return { latitude: lat, longitude: lon };
  } catch {
    return null;
  }
}
