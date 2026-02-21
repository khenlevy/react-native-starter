import mongoose from "mongoose";
import {
  // LARGE_CAP_THRESHOLD,
  CAP_DATA_FRESHNESS_DAYS,
  formatMarketCap,
  getMarketCapCategory,
} from "../utils/largeCapFilter.js";

/**
 * Symbol Schema
 * Represents individual symbol information from EODHD API
 */
const symbolSchema = new mongoose.Schema(
  {
    // Symbol code (e.g., 'AAPL', '0P00000M7O')
    Code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // Company/fund name
    Name: {
      type: String,
      required: true,
      trim: true,
    },

    // Country where the symbol is traded
    Country: {
      type: String,
      required: true,
      trim: true,
    },

    // Specific exchange within the country
    Exchange: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // Trading currency
    Currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // Asset type (FUND, ETF, STOCK, etc.)
    Type: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      enum: [
        "FUND",
        "ETF",
        "STOCK",
        "BOND",
        "OPTION",
        "FUTURE",
        "INDEX",
        "CURRENCY",
        "COMMODITY",
        "CRYPTO",
      ],
    },

    // ISIN code (International Securities Identification Number)
    Isin: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator: function (v) {
          // ISIN format: 2 letters + 9 alphanumeric + 1 check digit
          return !v || /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(v);
        },
        message: "ISIN must be in format: 2 letters + 9 alphanumeric + 1 check digit",
      },
    },

    // Market capitalization (added manually from fundamentals)
    cap: {
      type: Number,
      min: 0,
    },

    // When cap data was last synced from fundamentals
    capLastSync: {
      type: Date,
    },

    // Dividend data (added manually from dividends API)
    dividends: {
      type: Object,
      default: null,
    },

    // When dividend data was last synced
    dividendLastSync: {
      type: Date,
    },
  },
  {
    // No collection name (this is embedded in ExchangeSymbols)
    _id: false,
  }
);

// Note: Embedded document indexes are not needed as they're handled by the parent schema
// The embedded schema fields are indexed through the parent ExchangeSymbols collection

// Virtual for full symbol identifier
symbolSchema.virtual("fullSymbol").get(function () {
  return `${this.Code}.${this.Exchange}`;
});

// Instance methods
symbolSchema.methods.isStock = function () {
  return this.Type === "STOCK";
};

symbolSchema.methods.isFund = function () {
  return this.Type === "FUND";
};

symbolSchema.methods.isETF = function () {
  return this.Type === "ETF";
};

symbolSchema.methods.isUSSymbol = function () {
  return this.Country === "USA";
};

symbolSchema.methods.getDisplayName = function () {
  return `${this.Name} (${this.Code})`;
};

symbolSchema.methods.isLargeCap = function () {
  return this.cap && this.cap >= 1000000000; // $1B threshold
};

symbolSchema.methods.isMidCap = function () {
  return this.cap && this.cap >= 200000000 && this.cap < 1000000000; // $200M - $1B
};

symbolSchema.methods.isSmallCap = function () {
  return this.cap && this.cap < 200000000; // < $200M
};

symbolSchema.methods.getCapCategory = function () {
  return getMarketCapCategory(this.cap);
};

symbolSchema.methods.getFormattedCap = function () {
  return formatMarketCap(this.cap);
};

symbolSchema.methods.isCapDataFresh = function () {
  if (!this.capLastSync) return false;
  const cutoffDate = new Date(Date.now() - CAP_DATA_FRESHNESS_DAYS * 24 * 60 * 60 * 1000);
  return this.capLastSync > cutoffDate;
};

symbolSchema.methods.getDividendYield = function () {
  return this.dividends?.dividendYield || null;
};

symbolSchema.methods.getLastDividend = function () {
  if (!this.dividends?.history || !Array.isArray(this.dividends.history)) return null;
  return this.dividends.history[0] || null;
};

symbolSchema.methods.getUpcomingDividends = function () {
  return this.dividends?.upcoming || [];
};

symbolSchema.methods.hasDividends = function () {
  return (
    this.dividends && (this.dividends.history?.length > 0 || this.dividends.upcoming?.length > 0)
  );
};

symbolSchema.methods.isDividendDataFresh = function () {
  if (!this.dividendLastSync) return false;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return this.dividendLastSync > oneWeekAgo;
};

// Static methods
symbolSchema.statics.findByType = function (type) {
  return this.find({ Type: type.toUpperCase() });
};

symbolSchema.statics.findByCountry = function (country) {
  return this.find({ Country: country });
};

symbolSchema.statics.findByExchange = function (exchange) {
  return this.find({ Exchange: exchange });
};

// Export the schema (not model, since it's embedded)
export { symbolSchema };
export default symbolSchema;
