/**
 * Keenable search provider plugin for DSH.
 *
 * Registers a WebSearchProvider that uses Keenable's free public API
 * (https://keenable.ai) to perform web searches without requiring an API key.
 *
 * Usage: add to cordis.patch.yml:
 *   - insert:
 *       - id: web-search-keenable
 *         name: ./keenable-search.js
 */

const KEENABLE_SEARCH_URL = "https://api.keenable.ai/v1/search/public";
const KEENABLE_TITLE = "dsh-web-search";
const PROVIDER_ID = "keenable";

/**
 * Simple in-memory cache for recent search results.
 * Avoids hitting the API for identical queries within a short window.
 */
class SearchCache {
	constructor() {
		this.store = new Map();
		this.ttlMs = 30000; // 30 seconds
	}

	get(key) {
		const entry = this.store.get(key);
		if (!entry) return undefined;
		if (Date.now() - entry.timestamp > this.ttlMs) {
			this.store.delete(key);
			return undefined;
		}
		return entry.result;
	}

	set(key, result) {
		this.store.set(key, { result, timestamp: Date.now() });
	}
}

const cache = new SearchCache();

/**
 * Keenable search provider.
 * Implements the WebSearchProvider interface for DSH's ctx.web seam.
 */
class KeenableSearchProvider {
	constructor() {
		this.id = PROVIDER_ID;
	}

	/** Cheap local check: always available since we use the public endpoint. */
	available() {
		return true;
	}

	/**
	 * Run one search through Keenable's public API.
	 * @param {import('@deepseek-ai/dsh-web').WebSearchRequest} request
	 * @param {AbortSignal} [signal]
	 * @returns {Promise<import('@deepseek-ai/dsh-web').WebSearchResult>}
	 */
	async search(request, signal) {
		const query = request.query.trim();
		const maxResults = request.maxResults ?? 8;

		if (!query) {
			return { sources: [], truncated: false };
		}

		// Check cache
		const cacheKey = `${query}:${maxResults}`;
		const cached = cache.get(cacheKey);
		if (cached) return cached;

		// Build request
		const body = JSON.stringify({ query });
		const headers = {
			"Content-Type": "application/json",
			"X-Keenable-Title": KEENABLE_TITLE,
		};

		let response;
		try {
			response = await fetch(KEENABLE_SEARCH_URL, {
				method: "POST",
				headers,
				body,
				signal,
			});
		} catch (error) {
			if (error.name === "AbortError") {
				throw error;
			}
			throw new Error(`Keenable search request failed: ${error.message}`);
		}

		if (!response.ok) {
			let detail = "";
			try {
				const err = await response.json();
				detail = err.error || err.message || "";
			} catch {}
			throw new Error(
				`Keenable API error (HTTP ${response.status}): ${detail || response.statusText}`
			);
		}

		let data;
		try {
			data = await response.json();
		} catch (error) {
			throw new Error(`Keenable returned invalid JSON: ${error.message}`);
		}

		// Parse results
		const rawResults = data.results ?? [];
		const sources = rawResults.slice(0, maxResults).map((item) => {
			const source = { url: item.url || "" };
			if (item.title) source.title = item.title;
			if (item.snippet || item.description) {
				source.snippet = item.snippet || item.description || "";
			}
			if (item.published_at) source.publishedAt = item.published_at;
			return source;
		});

		const result = {
			sources,
			truncated: rawResults.length > maxResults,
		};

		// Cache the result
		cache.set(cacheKey, result);

		return result;
	}
}

/**
 * Cordis plugin entry point.
 * Registers the Keenable search provider with the web seam.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {object} config
 */
const name = "web-search-keenable";
const inject = ["web"];

function apply(ctx, config) {
	const provider = new KeenableSearchProvider();
	ctx.web.registerSearchProvider(provider);
}

export { PROVIDER_ID, KeenableSearchProvider, apply, inject, name };