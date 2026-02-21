import mongoose from "mongoose";
import { LARGE_CAP_THRESHOLD } from "../utils/largeCapFilter.js";

/**
 * Fundamentals Schema
 * Represents fundamental data for a specific symbol from EODHD API
 */
const fundamentalsSchema = new mongoose.Schema(
  {
    // Symbol identifier (e.g., 'AAPL.US')
    symbol: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    // Market information
    market: {
      type: String,
      required: true,
      trim: true,
    },

    // Raw fundamental data from EODHD API
    fundamentals: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },

    // When this data was fetched from API
    fetchedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // When this record was last updated
    updatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    // Collection name
    collection: "fundamentals",

    // Disable automatic timestamps (we handle our own)
    timestamps: false,

    // Ensure indexes
    autoIndex: true,
  }
);

// Indexes for better query performance
// Note: 'symbol' index is automatically created due to unique: true
fundamentalsSchema.index({ market: 1 });
fundamentalsSchema.index({ fetchedAt: 1 });
fundamentalsSchema.index({ "fundamentals.General.Code": 1 });
fundamentalsSchema.index({ "fundamentals.General.Name": 1 });

// Pre-save middleware to update updatedAt
fundamentalsSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Pre-update middleware to update updatedAt
fundamentalsSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Virtual for symbol code (without exchange)
fundamentalsSchema.virtual("symbolCode").get(function () {
  return this.symbol ? this.symbol.split(".")[0] : null;
});

// Virtual for exchange code
fundamentalsSchema.virtual("exchangeCode").get(function () {
  return this.symbol ? this.symbol.split(".")[1] : null;
});

// Virtual for company name
fundamentalsSchema.virtual("companyName").get(function () {
  return this.fundamentals?.General?.Name || null;
});

// Virtual for market cap
fundamentalsSchema.virtual("marketCap").get(function () {
  return this.fundamentals?.Highlights?.MarketCapitalization || null;
});

// Virtual for sector
fundamentalsSchema.virtual("sector").get(function () {
  return this.fundamentals?.General?.Sector || null;
});

// Virtual for industry
fundamentalsSchema.virtual("industry").get(function () {
  return this.fundamentals?.General?.Industry || null;
});

// Instance methods
fundamentalsSchema.methods.isLargeCap = function () {
  const marketCap = this.marketCap;
  return marketCap && marketCap >= LARGE_CAP_THRESHOLD;
};

fundamentalsSchema.methods.isMidCap = function () {
  const marketCap = this.marketCap;
  return marketCap && marketCap >= 200000000 && marketCap < 1000000000; // $200M - $1B
};

fundamentalsSchema.methods.isSmallCap = function () {
  const marketCap = this.marketCap;
  return marketCap && marketCap < 200000000; // < $200M
};

fundamentalsSchema.methods.getMarketCapCategory = function () {
  if (this.isLargeCap()) return "Large Cap";
  if (this.isMidCap()) return "Mid Cap";
  if (this.isSmallCap()) return "Small Cap";
  return "Unknown";
};

fundamentalsSchema.methods.getPE = function () {
  return this.fundamentals?.Highlights?.PERatio || null;
};

fundamentalsSchema.methods.getPB = function () {
  return this.fundamentals?.Highlights?.PriceBookMRQ || null;
};

fundamentalsSchema.methods.getDividendYield = function () {
  return this.fundamentals?.Highlights?.DividendYield || null;
};

fundamentalsSchema.methods.getROE = function () {
  return this.fundamentals?.Highlights?.ReturnOnEquityTTM || null;
};

fundamentalsSchema.methods.getDebtToEquity = function () {
  return this.fundamentals?.Highlights?.DebtToEquity || null;
};

fundamentalsSchema.methods.getRevenue = function () {
  return this.fundamentals?.Highlights?.RevenueTTM || null;
};

fundamentalsSchema.methods.getProfitMargin = function () {
  return this.fundamentals?.Highlights?.ProfitMargin || null;
};

// Static methods
fundamentalsSchema.statics.findBySymbol = function (symbol) {
  return this.findOne({ symbol: symbol.toUpperCase() });
};

fundamentalsSchema.statics.findByMarket = function (market) {
  return this.find({ market: market });
};

fundamentalsSchema.statics.findLargeCap = function () {
  return this.find({
    "fundamentals.Highlights.MarketCapitalization": { $gte: LARGE_CAP_THRESHOLD },
  });
};

fundamentalsSchema.statics.findBySector = function (sector) {
  return this.find({ "fundamentals.General.Sector": sector });
};

fundamentalsSchema.statics.findByIndustry = function (industry) {
  return this.find({ "fundamentals.General.Industry": industry });
};

fundamentalsSchema.statics.findByMarketCapRange = function (min, max) {
  return this.find({
    "fundamentals.Highlights.MarketCapitalization": {
      $gte: min,
      $lte: max,
    },
  });
};

fundamentalsSchema.statics.getSectorStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: "$fundamentals.General.Sector",
        count: { $sum: 1 },
        avgMarketCap: { $avg: "$fundamentals.Highlights.MarketCapitalization" },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

fundamentalsSchema.statics.getIndustryStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: "$fundamentals.General.Industry",
        count: { $sum: 1 },
        avgMarketCap: { $avg: "$fundamentals.Highlights.MarketCapitalization" },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

// Export the model
export const Fundamentals = mongoose.model("Fundamentals", fundamentalsSchema);
export default Fundamentals;
