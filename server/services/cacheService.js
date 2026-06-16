"use strict";

/**
 * Cache Service
 * In-memory cache with 24-hour TTL
 * Thread-safe for concurrent reads
 */

class CacheService {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
    this.TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  /**
   * Get value from cache
   * @param {string} key
   * @returns {any} value or null
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in cache with TTL
   * @param {string} key
   * @param {any} value
   * @param {number} [ttl] TTL in milliseconds (default: 24 hours)
   */
  set(key, value, ttl = this.TTL) {
    const expires = Date.now() + ttl;

    // Clear old timer if exists
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Store value
    this.cache.set(key, { value, expires });

    // Auto-delete after TTL
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
      console.log(`[CACHE] Auto-expired: ${key}`);
    }, ttl);

    this.timers.set(key, timer);
    console.log(`[CACHE] SET: ${key} (TTL: ${Math.round(ttl / 1000 / 60)}m)`);
  }

  /**
   * Check if key exists
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Delete key
   * @param {string} key
   */
  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    console.log(`[CACHE] DELETE: ${key}`);
  }

  /**
   * Clear entire cache
   */
  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
    console.log("[CACHE] CLEARED");
  }

  /**
   * Get cache stats
   */
  stats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = new CacheService();