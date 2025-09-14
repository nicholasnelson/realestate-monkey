# realestate-monkey

Userscript for realestate.com.au. Caches search-page data and shows a derived price **range** on property pages when no price is listed.

Hacked together in an hour or so after getting frustrated about price withheld listings.

## How it works

* On map search pages like `/buy/between-500000-600000/map-1…` the script records that bracket for each visible listing and stores it in `localStorage` keyed by `listingId`.
* When the same listing appears in other brackets, the script intersects all observed ranges to narrow the estimate. Conflicts resolve to **highest min** and **lowest max**.
* On a property page (`/property-…-<id>`), the script injects discovered price range info beneath the normal price area.
* A small toolbar on map view lets you step brackets up/down with a configurable **granularity (G)** and set an explicit min/max, so you can quickly probe ranges.

No external requests / fetch / etc. Only pages you visit are used.

## Usage

1. Open the **map** view and set your filters.
2. Position/zoom so the target area is fully visible. Only listings that render on the map are captured.
3. Set **G** (granularity) in the toolbar (e.g. `50,000`).
4. Enter a starting **Min** and click **Go**. You’ll land on a `/between-Min-(Min+G)/map-1` page. The site may show the price filter as “undefined” if values aren’t from its preset list; this is expected.
5. Click **UP** to move the bracket up by **G**. Wait for dots to render, then continue stepping until you’ve covered your range of interest.
6. Open any property page seen during collection. The derived range appears under the price section.

## Limitations

* Pagination on map results is not handled. Map view caps at \~200 visible results. If a single bracket yields more than that, data will be incomplete. Work around by increasing **G** resolution, narrowing the area, or adding filters. `/map-2` may work like list pagination if you wanted to implement pagination but is untested.
* Site structure may change and break selectors or embedded data formats.

## Privacy and storage

* Data stays in your browser’s `localStorage`.
* To clear, remove keys with the `realestatemonkey-cache` prefix in DevTools or your userscript’s UI.

## Status

Experimental. Built quickly to aid pricing for price-withheld listings.
