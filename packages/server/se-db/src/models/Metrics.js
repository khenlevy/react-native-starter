import mongoose from "mongoose";

const valuationMetadataSchema = new mongoose.Schema(
  {
    reason: {
      type: String,
      trim: true,
      maxlength: 256,
    },
    reasonText: {
      type: String,
      trim: true,
      maxlength: 256,
    },
    reasonCode: {
      type: String,
      trim: true,
      maxlength: 64,
    },
    inputs: mongoose.Schema.Types.Mixed,
    currency: {
      type: String,
      trim: true,
      maxlength: 16,
    },
    sourceCurrency: {
      type: String,
      trim: true,
      maxlength: 16,
    },
    priceCurrency: {
      type: String,
      trim: true,
      maxlength: 16,
    },
    priceSource: {
      type: String,
      trim: true,
      maxlength: 128,
    },
    sharesSource: {
      type: String,
      trim: true,
      maxlength: 128,
    },
    fxRate: {
      type: Number,
    },
    fxTimestamp: {
      type: Date,
    },
    timestamp: {
      type: Date,
    },
  },
  { _id: false, strict: false }
);

const valuationSchemaOptions = { _id: false, strict: false };

const valuationBaseFields = {
  fairValue: {
    type: Number,
    min: 0,
    max: 10000,
  },
  upsidePct: {
    type: Number,
    min: -1,
    max: 5,
  },
  range: {
    low: {
      type: Number,
      min: 0,
      max: 10000,
    },
    high: {
      type: Number,
      min: 0,
      max: 10000,
    },
  },
  quality: {
    type: String,
    enum: ["HIGH", "MEDIUM", "LOW", "N/A"],
  },
  metadata: {
    type: valuationMetadataSchema,
    default: {},
  },
};

const valuationDCFSchema = new mongoose.Schema(valuationBaseFields, valuationSchemaOptions);

const valuationLynchSchema = new mongoose.Schema(
  {
    ...valuationBaseFields,
    peFair: {
      type: Number,
      min: 0,
      max: 80,
    },
  },
  valuationSchemaOptions
);

const metricsSchema = new mongoose.Schema(
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
    metrics: {
      type: {
        // Dividend Growth Metrics
        DividendGrowth3Y: {
          type: Number,
          min: -100, // Can be negative (dividend cuts)
          max: 1000, // Reasonable upper bound for growth rates
        },
        DividendGrowth5Y: {
          type: Number,
          min: -100,
          max: 1000,
        },
        DividendGrowth10Y: {
          type: Number,
          min: -100,
          max: 1000,
        },
        DividendYieldCurrent: {
          type: Number,
          min: 0,
          max: 50, // Reasonable upper bound for dividend yield
        },
        // Debt-to-Equity Metrics
        DebtToEquityCurrent: {
          type: Number,
          min: 0,
          max: 100,
        },
        DebtToEquityChange3M: {
          type: Number,
          min: -100,
          max: 1000,
        },
        DebtToEquityChange6M: {
          type: Number,
          min: -100,
          max: 1000,
        },
        DebtToEquityChange1Y: {
          type: Number,
          min: -100,
          max: 1000,
        },
        DebtToEquityChange2Y: {
          type: Number,
          min: -100,
          max: 1000,
        },
        // Net Debt/EBITDA Metrics
        NetDebtToEBITDACurrent: {
          type: Number,
          min: -50,
          max: 50,
        },
        NetDebtToEBITDAChange3M: {
          type: Number,
          min: -100,
          max: 1000,
        },
        NetDebtToEBITDAChange6M: {
          type: Number,
          min: -100,
          max: 1000,
        },
        NetDebtToEBITDAChange1Y: {
          type: Number,
          min: -100,
          max: 1000,
        },
        NetDebtToEBITDAChange2Y: {
          type: Number,
          min: -100,
          max: 1000,
        },
        // EBITDA Metrics
        EBITDACurrent: {
          type: Number,
          min: -1000000000000, // -1 trillion
          max: 1000000000000, // 1 trillion
        },
        EBITDAGrowth3M: {
          type: Number,
          min: -100,
          max: 1000,
        },
        EBITDAGrowth6M: {
          type: Number,
          min: -100,
          max: 1000,
        },
        EBITDAGrowth1Y: {
          type: Number,
          min: -100,
          max: 1000,
        },
        EBITDAGrowth2Y: {
          type: Number,
          min: -100,
          max: 1000,
        },
        // Net Debt Metrics
        NetDebtCurrent: {
          type: Number,
          min: -1000000000000, // -1 trillion
          max: 1000000000000, // 1 trillion
        },
        NetDebtChange3M: {
          type: Number,
          min: -100,
          max: 1000,
        },
        NetDebtChange6M: {
          type: Number,
          min: -100,
          max: 1000,
        },
        NetDebtChange1Y: {
          type: Number,
          min: -100,
          max: 1000,
        },
        NetDebtChange2Y: {
          type: Number,
          min: -100,
          max: 1000,
        },
        // Price Performance Metrics
        PriceChange1W: {
          type: Number,
          min: -100,
          max: 10000,
        },
        PriceChange1M: {
          type: Number,
          min: -100,
          max: 10000,
        },
        PriceChange3M: {
          type: Number,
          min: -100,
          max: 10000,
        },
        PriceChange6M: {
          type: Number,
          min: -100,
          max: 10000,
        },
        PriceChange1Y: {
          type: Number,
          min: -100,
          max: 10000,
        },
        valuationDCF: valuationDCFSchema,
        valuationLynch: valuationLynchSchema,
        // Percentile ranks relative to industry and sector peers
        // Using Mixed type to allow flexible nested structure
        percentiles: mongoose.Schema.Types.Mixed,
        lastCalculated: {
          type: Date,
          required: true,
          default: Date.now,
        },
      },
      default: {},
    },
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
  },
  {
    collection: "metrics",
    timestamps: false,
    autoIndex: true,
  }
);

// Indexes for efficient querying
metricsSchema.index({ exchange: 1, lastUpdated: -1 });
metricsSchema.index({ symbol: 1, lastUpdated: -1 });
metricsSchema.index({ "metrics.lastCalculated": -1 });
metricsSchema.index({ exchange: 1, "metrics.lastCalculated": -1 });
metricsSchema.index({ "metrics.valuationDCF.quality": 1 });
metricsSchema.index({ "metrics.valuationLynch.quality": 1 });

// Instance methods
metricsSchema.methods.updateMetricsData = async function (metricsData) {
  this.metrics = {
    ...this.metrics,
    ...metricsData,
  };
  this.lastUpdated = new Date();
  this.fetchedAt = new Date();
  return this.save();
};

metricsSchema.methods.isDataFresh = function (maxAgeDays = 7) {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  return this.lastUpdated > cutoff;
};

// Static methods
metricsSchema.statics.findBySymbol = function (symbol) {
  return this.findOne({ symbol });
};

metricsSchema.statics.findByExchange = function (exchange) {
  return this.find({ exchange }).sort({ lastUpdated: -1 });
};

metricsSchema.statics.findStaleData = function (maxAgeDays = 7) {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  return this.find({ lastUpdated: { $lt: cutoff } });
};

metricsSchema.statics.getMetricsStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalSymbols: { $sum: 1 },
        symbolsWith3YGrowth: {
          $sum: { $cond: [{ $ne: ["$metrics.DividendGrowth3Y", null] }, 1, 0] },
        },
        symbolsWith5YGrowth: {
          $sum: { $cond: [{ $ne: ["$metrics.DividendGrowth5Y", null] }, 1, 0] },
        },
        symbolsWith10YGrowth: {
          $sum: { $cond: [{ $ne: ["$metrics.DividendGrowth10Y", null] }, 1, 0] },
        },
        symbolsWithCurrentYield: {
          $sum: { $cond: [{ $ne: ["$metrics.DividendYieldCurrent", null] }, 1, 0] },
        },
        avg3YGrowth: { $avg: "$metrics.DividendGrowth3Y" },
        avg5YGrowth: { $avg: "$metrics.DividendGrowth5Y" },
        avg10YGrowth: { $avg: "$metrics.DividendGrowth10Y" },
        avgCurrentYield: { $avg: "$metrics.DividendYieldCurrent" },
      },
    },
  ]);
};

metricsSchema.statics.getTopDividendGrowth = function (period = "3Y", limit = 10) {
  const field = `metrics.DividendGrowth${period}`;
  return this.find({ [field]: { $ne: null } })
    .sort({ [field]: -1 })
    .limit(limit)
    .select(`symbol exchange currency ${field}`);
};

metricsSchema.statics.getTopDividendYield = function (limit = 10) {
  return this.find({ "metrics.DividendYieldCurrent": { $ne: null } })
    .sort({ "metrics.DividendYieldCurrent": -1 })
    .limit(limit)
    .select("symbol exchange currency metrics.DividendYieldCurrent");
};

export const Metrics = mongoose.model("Metrics", metricsSchema);
