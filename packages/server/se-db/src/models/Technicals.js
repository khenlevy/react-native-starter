import mongoose from "mongoose";

/**
 * Technicals Schema
 * Represents technical indicator data for a specific symbol from EODHD API
 */
const technicalsSchema = new mongoose.Schema(
  {
    // Symbol identifier (e.g., 'AAPL.US')
    symbol: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },

    // Exchange information
    exchange: {
      type: String,
      required: true,
      trim: true,
    },

    // Currency for the technical data
    currency: {
      type: String,
      required: true,
      trim: true,
    },

    // Technical indicators data
    indicators: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },

    // When this data was last updated
    lastUpdated: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // When this data was fetched from API
    fetchedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    // Collection name
    collection: "technicals",

    // Disable automatic timestamps (we handle our own)
    timestamps: false,

    // Ensure indexes
    autoIndex: true,
  }
);

// Indexes for better query performance
// Note: 'symbol' index is automatically created due to unique: true
technicalsSchema.index({ exchange: 1 });
technicalsSchema.index({ lastUpdated: 1 });
technicalsSchema.index({ fetchedAt: 1 });
technicalsSchema.index({ exchange: 1, lastUpdated: 1 });
technicalsSchema.index({ symbol: 1, lastUpdated: 1 });

// Instance methods
technicalsSchema.methods.isDataFresh = function (maxAgeDays = 7) {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  return this.lastUpdated > cutoff;
};

technicalsSchema.methods.updateTechnicalData = async function (technicalData) {
  this.indicators = technicalData.indicators || {};
  this.currency = technicalData.currency;
  this.lastUpdated = new Date();
  this.fetchedAt = new Date();
  return this.save();
};

// Static methods
technicalsSchema.statics.findBySymbol = function (symbol) {
  return this.findOne({ symbol });
};

technicalsSchema.statics.findByExchange = function (exchange) {
  return this.find({ exchange }).sort({ lastUpdated: -1 });
};

technicalsSchema.statics.findStaleData = function (maxAgeDays = 7) {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  return this.find({ lastUpdated: { $lt: cutoff } });
};

technicalsSchema.statics.getTechnicalStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalSymbols: { $sum: 1 },
        exchanges: { $addToSet: "$exchange" },
        oldestData: { $min: "$lastUpdated" },
        newestData: { $max: "$lastUpdated" },
      },
    },
  ]);
};

// Pre-save middleware to update fetchedAt
technicalsSchema.pre("save", function (next) {
  if (this.isNew) {
    this.fetchedAt = new Date();
  }
  next();
});

// Create and export the model
export const Technicals = mongoose.model("Technicals", technicalsSchema);
export default Technicals;
