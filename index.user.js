// ==UserScript==
// @name         REA Search Scraper + Cache
// @namespace    https://github.com/nicholasnelson/realestate-monkey
// @version      0.1
// @match        https://www.realestate.com.au/*
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const LOG_PREFIX = "[REAMONKEY] "

    function log(message) {
        console.log(`${LOG_PREFIX} ${message}`);
    }

    function listingIdFromUrl(u = location.href) {
        const m = new URL(u, location.origin).pathname.match(/-(\d+)$/);
        const id = m ? m[1] : null;
        if (!id) {
            throw new Error("Couldn't get listing ID")
        }
        return id;
    }

    function pickRangeWithLowestMax(a, b) {
        if (!a && !b) return null;
        if (!a) return b || null;
        if (!b) return a || null;
        const A = Number.isFinite(+a.max) ? +a.max : Infinity;
        const B = Number.isFinite(+b.max) ? +b.max : Infinity;
        return A <= B ? a : b;
    }

    // Return the range with the higher min. Treat missing/invalid min as -∞.
    function pickRangeWithHighestMin(a, b) {
        if (!a && !b) return null;
        if (!a) return b || null;
        if (!b) return a || null;
        const A = Number.isFinite(+a.min) ? +a.min : -Infinity;
        const B = Number.isFinite(+b.min) ? +b.min : -Infinity;
        return A >= B ? a : b;
    }


    // Inject UP/DOWN + editable range (min/max) with fixed granularity G.
    function injectRangeNav(granularityDefault = 10000) {
        if (document.getElementById("rea-range-nav")) return;

        const LS_KEY = "rea-range-granularity";
        const loadG = () => {
            const v = Number(localStorage.getItem(LS_KEY));
            return Number.isFinite(v) && v > 0 ? v : granularityDefault;
        };
        const saveG = (v) => {
            const n = Number(v);
            if (Number.isFinite(n) && n > 0) localStorage.setItem(LS_KEY, String(n));
        };

        function getBetweenRange(url = location.href) {
            const seg = new URL(url).pathname.split("/").find(s => s.startsWith("between-"));
            if (!seg) return null;
            const m = /^between-(\d+)-(\d+)$/.exec(seg);
            return m ? { min: Number(m[1]), max: Number(m[2]) } : null;
        }
        function setBetweenRange(url, min, max) {
            const u = new URL(url);
            const parts = u.pathname.split("/");
            const i = parts.findIndex(s => s.startsWith("between-"));
            if (i >= 0) {
                parts[i] = `between-${min}-${max}`;
                u.pathname = parts.join("/");
                return u.toString();
            }
            return null;
        }

        function snapGo(minVal, maxVal) {
            const G = loadG();
            let nMin = Math.max(0, Math.floor(minVal / G) * G);
            // Fixed-width bracket = G. Ignore provided max except for fallback when min missing.
            const nMax = nMin + G;
            const next = setBetweenRange(location.href, nMin, nMax);
            if (next) location.assign(next);
        }

        function shiftRange(dir) {
            const r = getBetweenRange();
            if (!r) return;
            const G = loadG();
            const base = Math.floor(r.min / G) * G;
            let nMin = base + dir * G;
            if (nMin < 0) nMin = 0;
            const nMax = nMin + G;
            const next = setBetweenRange(location.href, nMin, nMax);
            if (next) location.assign(next);
        }

        function parseMoney(s) {
            if (typeof s !== "string") return NaN;
            return Number(s.replace(/[^\d.-]/g, ""));
        }

        // UI
        const bar = document.createElement("div");
        bar.id = "rea-range-nav";
        bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#111;color:#fff;padding:6px 10px;font:14px/1.2 sans-serif;display:flex;gap:8px;align-items:center;opacity:.95";

        const down = document.createElement("button");
        const up = document.createElement("button");
        for (const [el, txt] of [[down, "DOWN"], [up, "UP"]]) {
            el.textContent = txt;
            el.style.cssText = "padding:4px 8px;cursor:pointer;border:1px solid #444;background:#222;color:#fff;border-radius:4px";
        }

        const gInput = document.createElement("input");
        gInput.type = "number";
        gInput.min = "1";
        gInput.step = "1000";
        gInput.value = String(loadG());
        gInput.title = "Granularity";
        gInput.style.cssText = "width:9ch;padding:3px;border-radius:4px;border:1px solid #444;background:#222;color:#fff";

        const minInput = document.createElement("input");
        const maxInput = document.createElement("input");
        for (const el of [minInput, maxInput]) {
            el.type = "text";
            el.inputMode = "numeric";
            el.placeholder = "min/max";
            el.style.cssText = "width:12ch;padding:3px;border-radius:4px;border:1px solid #444;background:#222;color:#fff";
        }
        const goBtn = document.createElement("button");
        goBtn.textContent = "Go";
        goBtn.style.cssText = "padding:4px 8px;cursor:pointer;border:1px solid #444;background:#2a2;color:#fff;border-radius:4px";

        function seedInputs() {
            const r = getBetweenRange();
            if (r) {
                minInput.value = r.min.toLocaleString();
                maxInput.value = r.max.toLocaleString();
            } else {
                minInput.value = "";
                maxInput.value = "";
            }
        }

        function onGo() {
            const r = getBetweenRange();
            const fallbackMin = r?.min ?? 0;
            const fallbackMax = r?.max ?? (fallbackMin + loadG());
            const minVal = Number.isFinite(parseMoney(minInput.value)) ? parseMoney(minInput.value) : fallbackMin;
            const maxVal = Number.isFinite(parseMoney(maxInput.value)) ? parseMoney(maxInput.value) : fallbackMax;
            snapGo(minVal, maxVal);
        }

        down.addEventListener("click", () => shiftRange(-1));
        up.addEventListener("click", () => shiftRange(+1));
        gInput.addEventListener("change", () => saveG(gInput.value));
        goBtn.addEventListener("click", onGo);
        minInput.addEventListener("keydown", e => { if (e.key === "Enter") onGo(); });
        maxInput.addEventListener("keydown", e => { if (e.key === "Enter") onGo(); });

        seedInputs();
        bar.append(down, up, document.createTextNode(" G:"), gInput,
            document.createTextNode("  Min:"), minInput,
            document.createTextNode("  Max:"), maxInput,
            goBtn);
        document.body.prepend(bar);
    }


    // Injects the known range data into a property view page
    function injectKnownRange() {
        const id = listingIdFromUrl();

        // Uses your Map-backed cache from createListingCache()
        const cache = createListingCache();
        const item = cache.get(id) || null;
        log(id);
        log(JSON.stringify(item));
        const range = item?.range;

        const host = document.querySelector(".property-info__middle-content");
        if (!host) {
            throw new Error("Couldn't find host element for price range data")
        };

        const lowRangeSpan = document.createElement("span");
        lowRangeSpan.className = "property-price property-info__price";
        lowRangeSpan.textContent =
            range && Number.isFinite(+range.min) && Number.isFinite(+range.max)
                ? `Lowest Seen Search Range: $${(+item.lowRange.min).toLocaleString()} - $${(+item.lowRange.max).toLocaleString()}`
                : "No search range data found";

        host.appendChild(lowRangeSpan);

        const highRangeSpan = document.createElement("span");
        highRangeSpan.className = "property-price property-info__price";
        highRangeSpan.textContent =
            range && Number.isFinite(+range.min) && Number.isFinite(+range.max)
                ? `Highest Seen Search Range: $${(+item.highRange.min).toLocaleString()} - $${(+item.highRange.max).toLocaleString()}`
                : "No search range data found";

        host.appendChild(highRangeSpan);


    }

    function createListingCache(prefix = "realestatemonkey-cache") {
        const key = `${prefix}:map`;

        function load() {
            const s = localStorage.getItem(key);
            if (!s) return new Map();
            try {
                return new Map(JSON.parse(s));
            } catch {
                return new Map();
            }
        }

        function save(map) {
            localStorage.setItem(key, JSON.stringify(Array.from(map.entries())));
        }

        return {
            set(listingId, value) {
                const map = load();
                map.set(String(listingId), value);
                save(map);
            },

            get(listingId) {
                const map = load();
                return map.get(String(listingId)) || null;
            },

            remove(listingId) {
                const map = load();
                map.delete(String(listingId));
                save(map);
            },

            keys() {
                return Array.from(load().keys());
            },

            all() {
                return Array.from(load().values());
            },

            raw() {
                return load();
            }
        };
    }

    // ---- parsing core ----
    function parseHiddenData() {
        const text = Array.from(document.scripts)
            .map(s => s.textContent || "")
            .find(t => t.includes("window.ArgonautExchange"));
        if (!text) return null;
        const m = text.match(/window\.ArgonautExchange\s*=\s*(\{[\s\S]+?\});/);
        if (!m) return null;

        try {
            let data = JSON.parse(m[1]);
            data = JSON.parse(
                data["resi-property_map-results-web"]["fetchMapSearchData"]
            );
            data = JSON.parse(Object.values(data)[0]["data"]);
            return data;
        } catch {
            return m[1];
        }
    }

    function getListingsFromMap(hiddenData) {
        return JSON.parse(JSON.parse(hiddenData)["resi-property_map-results-web"].fetchMapSearchData).data.buyMapSearch.results.items
    }

    function cleanMapListing(raw) {
        const val = (x) => (typeof x?.value === "number" ? x.value : null);

        const listingId = raw?.id ?? null;
        if (!listingId) return null;

        const price = raw?.price?.display ?? null;
        const type = raw?.propertyType?.display ?? null;

        const shortAddress = raw?.address?.display?.shortAddress ?? null;
        const suburb = raw?.address?.suburb ?? null;
        const state = raw?.address?.state ?? null;
        const postcode = raw?.address?.postcode ?? null;

        const imageTemplate = raw?.media?.mainImage?.templatedUrl ?? null;
        // keep template and also provide a simple expanded URL variant
        const image = imageTemplate ? imageTemplate.replace("{size}", "800x600") : null;

        const url = `https://www.realestate.com.au/${listingId}`;
        const features = {
            bedrooms: val(raw?.generalFeatures?.bedrooms),
            bathrooms: val(raw?.generalFeatures?.bathrooms),
            parking: val(raw?.generalFeatures?.parkingSpaces),
            studies: val(raw?.generalFeatures?.studies),
        };

        const agency = {
            id: raw?.listingCompany?.id ?? null,
            name: raw?.listingCompany?.name ?? null,
            logo: raw?.listingCompany?.media?.logo?.templatedUrl ?? null,
            primaryColour: raw?.listingCompany?.branding?.primaryColour ?? null,
        };

        return {
            listingId,
            price,
            type,
            address: { shortAddress, suburb, state, postcode },
            image,
            url,
            features,
            agency,
            productDepth: raw?.productDepth ?? null,
        };
    }

    function extractMapListings(mapListings) {
        return mapListings.flatMap(item => {
            if (item.__typename === "BuyMapIndividual") {
                return item.listing;
            } else if (item.__typename === "BuyMapCluster") {
                return item.results;
            } else {
                throw new Error("Unexpected maplisting entry type " + item__typename);
            }
        })
    }

    function cacheMapPriceBrackets(hiddenData, cache) {
        // Get the listings from the map
        const rawListingResults = getListingsFromMap(hiddenData);
        const rawListingItems = extractMapListings(rawListingResults);
        const listings = rawListingItems.map(listingResult => cleanMapListing(listingResult));

        log(`Got ${listings.length} listings.`);


        // Range calculation
        function intersectRanges(a, b) {
            if (!a || !b) {
                return a ?? b ?? null;
            }
            const min = Math.max(a.min, b.min);
            const max = Math.min(a.max, b.max);

            return { min, max };
        }

        const rangeMatches = /between-(\d+)-(\d+)/.exec(location.href);
        const range = rangeMatches ? { min: Number(rangeMatches[1]), max: Number(rangeMatches[2]) } : null;
        if (!range) {
            throw new Error("Failed to get range from URL: " + location.href);
        }
        log(`Got price range for list: ${JSON.stringify(range)}`);

        // Update the listing cache
        listings.forEach(listing => {
            // Get existing listing from the cache, if any
            const cacheItem = cache.get(listing.listingId) || {};
            // Add the new listing data to the container
            cacheItem.mapData = listing;
            log(`Old range: ${JSON.stringify(cacheItem.range)}, Page range: ${JSON.stringify(range)}, New range: ${JSON.stringify(intersectRanges(range, cacheItem.range))}`);
            cacheItem.range = intersectRanges(range, cacheItem.range);

            cacheItem.highRange = pickRangeWithHighestMin(range, cacheItem.highRange);
            cacheItem.lowRange = pickRangeWithLowestMax(range, cacheItem.lowRange);


            // Store all the ranges we've ever seen for this property for analysis
            cacheItem.rangeSearchHistory = cacheItem.rangeSearchHistory || [];
            cacheItem.rangeSearchHistory.push(range);

            // Set the last updated time
            cacheItem.lastUpdated = Date.now();
            // Save
            cache.set(listing.listingId, cacheItem);
            log(`Saved listing: ${listing.listingId} with range $${cacheItem.range.min}-$${cacheItem.range.max}`);
        })
    }


    // https://www.realestate.com.au/buy/between-1000000-1050000/map-1?boundingBox=-34.805087969163814%2C138.37569495183584%2C-35.02664581941544%2C138.78115912419912&source=refinement&sourcePage=map&sourceElement=location-tile-search
    function isPriceBracketMapPage(u = location.href) {
        const url = new URL(u, location.origin);
        const hostOK = url.hostname === "www.realestate.com.au";
        const pathOK = /^\/buy\/between-\d+-\d+\/map-1$/.test(url.pathname);
        const qsOK = url.searchParams.has("boundingBox");
        return hostOK && pathOK && qsOK;
    }

    function isPropertyPage(u = location.href) {
        const url = new URL(u, location.origin);
        if (url.hostname !== "www.realestate.com.au") return false;
        return /^\/property-[^/]+-\d+$/.test(url.pathname);
    }



    // Run after DOM is ready; script tags are present by then.
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run);
    } else {
        try {
            run();
        } catch (e) {
            log(e);
        }
    }

    function run() {
        log("Running RealestateMonkey")
        log("Setup listing cache...")
        const listingCache = createListingCache();

        log("Extracting hidden data...");
        const hiddenData = parseHiddenData();


        if (isPriceBracketMapPage()) {
            log("Injecting range navigation");
            injectRangeNav();

            log("Caching search range data");
            cacheMapPriceBrackets(hiddenData, listingCache)
        }

        if (isPropertyPage()) {
            log("Injecting known range data into property page");
            injectKnownRange();
        }

    }
})();
