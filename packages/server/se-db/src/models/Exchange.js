import mongoose from "mongoose";

/**
 * Exchange Schema
 * Represents exchange information from EODHD API
 */
const exchangeSchema = new mongoose.Schema(
  {
    // Exchange code (e.g., 'US', 'LSE', 'TO')
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    // Duplicate field from API (keeping for compatibility)
    Code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // Country name
    Country: {
      type: String,
      required: true,
      trim: true,
    },

    // 2-letter country code (ISO 3166-1 alpha-2)
    CountryISO2: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      length: 2,
    },

    // 3-letter country code (ISO 3166-1 alpha-3)
    CountryISO3: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      length: 3,
    },

    // Primary trading currency
    Currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // Exchange name
    Name: {
      type: String,
      required: true,
      trim: true,
    },

    // Operating MIC codes (comma-separated)
    OperatingMIC: {
      type: String,
      required: true,
      trim: true,
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
    collection: "exchanges",

    // Disable automatic timestamps (we handle our own)
    timestamps: false,

    // Ensure indexes
    autoIndex: true,
  }
);

// Indexes for better query performance
// Note: 'code' index is automatically created due to unique: true
exchangeSchema.index({ Country: 1 });
exchangeSchema.index({ Currency: 1 });
exchangeSchema.index({ fetchedAt: 1 });

// Pre-save middleware to update updatedAt
exchangeSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Pre-update middleware to update updatedAt
exchangeSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Virtual for exchange priority (useful for symbol resolution)
exchangeSchema.virtual("priority").get(function () {
  const priorities = {
    US: 1,
    LSE: 2,
    TO: 3,
    NEO: 4,
    V: 5,
    XETRA: 6,
    F: 7,
    PA: 8,
    SW: 9,
    AU: 10,
  };
  return priorities[this.code] || 999;
});

// Instance methods
exchangeSchema.methods.isUSExchange = function () {
  return this.Country === "USA" || this.code === "US";
};

exchangeSchema.methods.getOperatingMICs = function () {
  return this.OperatingMIC ? this.OperatingMIC.split(",").map((mic) => mic.trim()) : [];
};

// Static methods
exchangeSchema.statics.findByCountry = function (country) {
  return this.find({ Country: country });
};

exchangeSchema.statics.findByCurrency = function (currency) {
  return this.find({ Currency: currency });
};

exchangeSchema.statics.findByPriority = function (limit = 10) {
  return this.find().sort({ priority: 1 }).limit(limit);
};

// Export the model
export const Exchange = mongoose.model("Exchange", exchangeSchema);
export default Exchange;
