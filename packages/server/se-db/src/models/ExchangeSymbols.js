import mongoose from "mongoose";
import { symbolSchema } from "./Symbol.js";

/**
 * Exchange Symbols Schema
 * Represents all symbols for a specific exchange from EODHD API
 */
const exchangeSymbolsSchema = new mongoose.Schema(
  {
    // Exchange code (references Exchange.code)
    exchangeCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      ref: "Exchange",
    },

    // Array of symbol objects
    symbols: {
      type: [symbolSchema],
      required: true,
      default: [],
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
    collection: "exchange_symbols",

    // Disable automatic timestamps (we handle our own)
    timestamps: false,

    // Ensure indexes
    autoIndex: true,
  }
);

// Indexes for better query performance
// Note: 'exchangeCode' index is automatically created due to unique: true
exchangeSymbolsSchema.index({ fetchedAt: 1 });
// Note: Embedded document indexes are handled by the embedded schema

// Pre-save middleware to update updatedAt
exchangeSymbolsSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Pre-update middleware to update updatedAt
exchangeSymbolsSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Virtual for symbol count
exchangeSymbolsSchema.virtual("symbolCount").get(function () {
  return this.symbols ? this.symbols.length : 0;
});

// Virtual for exchange reference
exchangeSymbolsSchema.virtual("exchange", {
  ref: "Exchange",
  localField: "exchangeCode",
  foreignField: "code",
  justOne: true,
});

// Instance methods
exchangeSymbolsSchema.methods.findSymbolByCode = function (code) {
  return this.symbols.find((symbol) => symbol.Code === code.toUpperCase());
};

exchangeSymbolsSchema.methods.findSymbolsByType = function (type) {
  return this.symbols.filter((symbol) => symbol.Type === type.toUpperCase());
};

exchangeSymbolsSchema.methods.findSymbolsByCountry = function (country) {
  return this.symbols.filter((symbol) => symbol.Country === country);
};

exchangeSymbolsSchema.methods.getSymbolsByType = function () {
  const typeCounts = {};
  this.symbols.forEach((symbol) => {
    typeCounts[symbol.Type] = (typeCounts[symbol.Type] || 0) + 1;
  });
  return typeCounts;
};

exchangeSymbolsSchema.methods.getSymbolsByCountry = function () {
  const countryCounts = {};
  this.symbols.forEach((symbol) => {
    countryCounts[symbol.Country] = (countryCounts[symbol.Country] || 0) + 1;
  });
  return countryCounts;
};

exchangeSymbolsSchema.methods.addSymbol = function (symbolData) {
  this.symbols.push(symbolData);
  return this;
};

exchangeSymbolsSchema.methods.removeSymbol = function (code) {
  this.symbols = this.symbols.filter((symbol) => symbol.Code !== code.toUpperCase());
  return this;
};

exchangeSymbolsSchema.methods.updateSymbol = function (code, updateData) {
  const symbol = this.findSymbolByCode(code);
  if (symbol) {
    Object.assign(symbol, updateData);
  }
  return this;
};

// Static methods
exchangeSymbolsSchema.statics.findByExchangeCode = function (exchangeCode) {
  return this.findOne({ exchangeCode: exchangeCode.toUpperCase() });
};

exchangeSymbolsSchema.statics.findSymbolsByCode = function (code) {
  return this.find({ "symbols.Code": code.toUpperCase() });
};

exchangeSymbolsSchema.statics.findSymbolsByType = function (type) {
  return this.find({ "symbols.Type": type.toUpperCase() });
};

exchangeSymbolsSchema.statics.findSymbolsByCountry = function (country) {
  return this.find({ "symbols.Country": country });
};

exchangeSymbolsSchema.statics.getExchangeStats = function () {
  return this.aggregate([
    {
      $project: {
        exchangeCode: 1,
        symbolCount: { $size: "$symbols" },
        types: "$symbols.Type",
        countries: "$symbols.Country",
      },
    },
    {
      $group: {
        _id: "$exchangeCode",
        totalSymbols: { $sum: "$symbolCount" },
        uniqueTypes: { $addToSet: "$types" },
        uniqueCountries: { $addToSet: "$countries" },
      },
    },
  ]);
};

// Export the model
export const ExchangeSymbols = mongoose.model("ExchangeSymbols", exchangeSymbolsSchema);
export default ExchangeSymbols;
