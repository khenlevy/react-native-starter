import mongoose from "mongoose";

const dividendSchema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    exchange: {
      type: String,
      required: true,
      trim: true,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
    },
    dividendYield: {
      type: Number,
      min: 0,
    },
    history: [
      {
        date: { type: Date, required: true },
        value: { type: Number, required: true, min: 0 },
        currency: { type: String, required: true },
        declarationDate: { type: Date },
        recordDate: { type: Date },
        paymentDate: { type: Date },
        period: { type: String },
        unadjustedValue: { type: Number },
        adjustedValue: { type: Number },
      },
    ],
    upcoming: [
      {
        date: { type: Date, required: true },
        value: { type: Number, required: true, min: 0 },
        currency: { type: String, required: true },
        declarationDate: { type: Date },
        recordDate: { type: Date },
        paymentDate: { type: Date },
        period: { type: String },
        unadjustedValue: { type: Number },
        adjustedValue: { type: Number },
      },
    ],
    lastUpdated: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    fetchedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    collection: "dividends",
    timestamps: false,
    autoIndex: true,
  }
);

// Indexes for efficient querying
dividendSchema.index({ exchange: 1, lastUpdated: -1 });
dividendSchema.index({ symbol: 1, lastUpdated: -1 });
dividendSchema.index({ "history.date": -1 });
dividendSchema.index({ "upcoming.date": 1 });

// Instance methods
dividendSchema.methods.updateDividendData = async function (dividendData) {
  this.dividendYield = dividendData.dividendYield;
  this.currency = dividendData.currency;
  this.history = dividendData.history || [];
  this.upcoming = dividendData.upcoming || [];
  this.metadata = dividendData.metadata || {};
  this.lastUpdated = new Date();
  this.fetchedAt = new Date();
  return this.save();
};

dividendSchema.methods.isDataFresh = function (maxAgeDays = 7) {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  return this.lastUpdated > cutoff;
};

// Static methods
dividendSchema.statics.findBySymbol = function (symbol) {
  return this.findOne({ symbol });
};

dividendSchema.statics.findByExchange = function (exchange) {
  return this.find({ exchange }).sort({ lastUpdated: -1 });
};

dividendSchema.statics.findStaleData = function (maxAgeDays = 7) {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  return this.find({ lastUpdated: { $lt: cutoff } });
};

dividendSchema.statics.getDividendStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalSymbols: { $sum: 1 },
        symbolsWithYield: {
          $sum: { $cond: [{ $ne: ["$dividendYield", null] }, 1, 0] },
        },
        totalHistoryRecords: { $sum: { $size: "$history" } },
        totalUpcomingRecords: { $sum: { $size: "$upcoming" } },
        avgHistoryRecords: { $avg: { $size: "$history" } },
        avgUpcomingRecords: { $avg: { $size: "$upcoming" } },
      },
    },
  ]);
};

export const Dividends = mongoose.model("Dividends", dividendSchema);
