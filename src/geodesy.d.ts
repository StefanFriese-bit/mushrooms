// The part of geodesy 2.4.0 (Chris Veness, MIT) the app uses: WGS84 latitude/longitude → an OS grid reference.
declare module 'geodesy/osgridref.js' {
  export class LatLon {
    constructor(lat: number, lon: number);
    /** The OS National Grid position (converted from WGS84 by a Helmert transformation, about 5 m). Throws outside the grid. */
    toOsGrid(): { easting: number; northing: number; toString(digits?: number): string };
  }
}
