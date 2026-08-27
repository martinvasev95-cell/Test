import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
// Low-resolution (110m) world boundaries — small enough to bundle, plenty
// accurate for "which country was this photo taken in".
import rawTopology from 'world-atlas/countries-110m.json';

interface CountryProperties {
  name: string;
}

export type CountryFeature = Feature<Geometry, CountryProperties>;

const topology = rawTopology as unknown as Topology<{
  countries: GeometryCollection<CountryProperties>;
  land: GeometryCollection;
}>;

export const countriesGeoJSON = feature(
  topology,
  topology.objects.countries,
) as unknown as FeatureCollection<Geometry, CountryProperties>;

export const countryFeatures: CountryFeature[] = countriesGeoJSON.features;

const countryById = new Map<string, CountryFeature>(
  countryFeatures.map((f) => [String(f.id), f]),
);

export function getCountryName(id: string): string {
  return countryById.get(id)?.properties?.name ?? 'Unknown';
}

/** Reverse-geocode a GPS point to a country using point-in-polygon, entirely offline. */
export function findCountryForPoint(lng: number, lat: number): CountryFeature | null {
  for (const country of countryFeatures) {
    if (geoContains(country, [lng, lat])) return country;
  }
  return null;
}
