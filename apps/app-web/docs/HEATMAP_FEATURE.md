# 📊 Metrics Heat Map Feature

## Overview

The Metrics Heat Map is a comprehensive analytics tool that allows users to visualize and compare company performance across sectors and industries using percentile-based rankings. This feature transforms raw financial metrics into actionable visual insights with customizable ranking formulas.

---

## ✨ Features

### 📈 Visual Heat Map
- **Color-coded table** showing percentile rankings (0-100%)
- **Red → Yellow → Green** gradient for easy visualization
- **Interactive tooltips** displaying both percentile and raw values
- **Responsive design** with horizontal scrolling for many metrics

### 🎯 Smart Filtering
- **Group by Sector or Industry** - flexible data grouping
- **Multi-sector selection** - compare specific market segments
- **Dynamic industry loading** - industries update based on sector
- **Metric selection** - choose which metrics to analyze

### 🔢 Ranking Algorithms

#### 1. **Average Percentile**
Simple average of all selected metric percentiles.
```
Score = (Metric1% + Metric2% + ... + MetricN%) / N
```

#### 2. **Weighted Average**
Custom weights for each metric with slider controls.
```
Score = Σ(weight × percentile) / Σ(weights)
```
Example: Weight dividend growth 3x more than yield.

#### 3. **Count ≥ Threshold**
Count how many metrics exceed a percentile threshold (default 80%).
```
Score = (# of metrics ≥ threshold) / Total metrics
HighCount = # of metrics ≥ threshold
```

### 🏆 Top Companies Panel
- **Visual cards** showing top 6 ranked companies
- **Score display** with percentage and high metric count
- **Sector/Industry tags** for context
- **Sortable** by score or high count

### 💾 Data Export
- **CSV export** with one click
- Includes both percentile and raw values
- Timestamped filename for record keeping

---

## 🛠️ Technical Architecture

### Backend API

**Base URL:** `/api/v1/metrics/heatmap`

#### Endpoints

##### 1. **GET** `/api/v1/metrics/heatmap`
Fetch companies with their percentile data.

**Query Parameters:**
```javascript
{
  groupBy: 'sector' | 'industry' | 'company',
  groupName?: string,  // e.g., "Technology", "Software - Application"
  metrics: string[],   // e.g., ["DividendYieldCurrent", "DividendGrowth3Y"]
  limit?: number,      // default 50
  offset?: number      // default 0
}
```

**Response:**
```javascript
{
  "group": "Technology",
  "groupBy": "sector",
  "metrics": ["DividendYieldCurrent", "DividendGrowth3Y"],
  "companies": [
    {
      "symbol": "AAPL.US",
      "sector": "Technology",
      "industry": "Consumer Electronics",
      "percentiles": {
        "DividendYieldCurrent": 0.92,
        "DividendGrowth3Y": 0.87
      },
      "raw": {
        "DividendYieldCurrent": 0.013,
        "DividendGrowth3Y": 0.06
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

##### 2. **POST** `/api/v1/metrics/heatmap/rank`
Rank companies based on a custom formula.

**Request Body:**
```javascript
{
  "companies": [ /* array of company objects */ ],
  "formula": {
    "method": "avg" | "weighted" | "count",
    "metrics": ["DividendYieldCurrent", "DividendGrowth3Y"],
    "weights": {  // for weighted method
      "DividendYieldCurrent": 1.0,
      "DividendGrowth3Y": 2.0
    },
    "threshold": 0.8  // for count method
  }
}
```

**Response:**
```javascript
{
  "topCompanies": [
    {
      "symbol": "MSFT.US",
      "sector": "Technology",
      "industry": "Software - Infrastructure",
      "score": 0.88,
      "highCount": 3,
      "percentiles": { ... },
      "raw": { ... }
    }
  ],
  "formula": { /* echo of formula used */ }
}
```

##### 3. **GET** `/api/v1/metrics/heatmap/sectors`
Get list of all available sectors.

**Response:**
```javascript
{
  "sectors": ["Technology", "Healthcare", "Financial Services", ...]
}
```

##### 4. **GET** `/api/v1/metrics/heatmap/industries`
Get list of industries (optionally filtered by sector).

**Query Parameters:**
```javascript
{
  sector?: string  // optional filter
}
```

**Response:**
```javascript
{
  "industries": ["Software - Application", "Software - Infrastructure", ...]
}
```

##### 5. **GET** `/api/v1/metrics/heatmap/available`
Get list of available metrics with metadata.

**Response:**
```javascript
{
  "metrics": [
    {
      "key": "DividendYieldCurrent",
      "label": "Dividend Yield",
      "description": "Current dividend yield percentage",
      "format": "percentage"
    }
  ]
}
```

---

### Frontend Components

#### 1. **HeatMap.jsx** (Main Page)
Full-screen dashboard with three panels:
- **Left Panel:** Filters and formula builder
- **Main Content:** Heat map table and top companies
- **State Management:** React hooks for all interactions

#### 2. **HeatMapTable** (Integrated Component)
- Dynamic column generation based on selected metrics
- Color-coded cells with gradient backgrounds
- Sticky symbol column for horizontal scrolling
- Tooltip support for detailed values

#### 3. **FormulaBuilder** (Integrated Panel)
- Method toggle (Average/Weighted/Count)
- Weight sliders for each metric
- Threshold slider for percentile cutoff
- Apply button to trigger ranking

#### 4. **TopCompanies** (Display Component)
- Grid layout of top-ranked companies
- Score visualization with percentage
- High metric count display
- Sector/Industry labeling

---

## 🎨 UI/UX Design

### Color Scheme

**Percentile Colors:**
- 🟢 **≥80%:** Dark Green (`bg-green-500`)
- 🟢 **≥60%:** Light Green (`bg-green-300`)
- 🟡 **≥40%:** Yellow (`bg-yellow-300`)
- 🟠 **≥20%:** Orange (`bg-orange-300`)
- 🔴 **<20%:** Red (`bg-red-300`)
- ⚪ **Null/N/A:** Gray (`bg-gray-100`)

### Layout
- **Left sidebar:** Fixed 320px width with scroll
- **Main content:** Flex-grow with overflow auto
- **Top companies:** Grid with responsive columns (1-3)
- **Table:** Full width with horizontal scroll

---

## 📊 Usage Examples

### Example 1: Find Top Dividend Growers in Technology

1. **Select Filters:**
   - Group By: `Sector`
   - Sector: `Technology`
   - Metrics: `DividendGrowth3Y`, `DividendGrowth5Y`, `DividendGrowth10Y`

2. **Load Heat Map**

3. **Apply Formula:**
   - Method: `Average Percentile`
   - Threshold: `80%`

4. **View Top Companies** sorted by average growth percentile

### Example 2: Custom Weighted Ranking

1. **Select Metrics:**
   - `DividendYieldCurrent`
   - `DividendGrowth5Y`

2. **Choose Weighted Method:**
   - DividendYieldCurrent: `1.0`
   - DividendGrowth5Y: `3.0` (3x weight)

3. **Apply to prioritize growth over current yield**

### Example 3: Find "Well-Rounded" Companies

1. **Select Multiple Metrics** (4-5 metrics)

2. **Use Count Method:**
   - Threshold: `75%`
   - This finds companies strong across ALL metrics

---

## 🔍 Data Verification

### Percentile Accuracy Checks

The percentile data comes from the **percentile jobs** that run daily. To verify accuracy:

1. **Spot Check:**
   ```javascript
   // Pick a company (e.g., AAPL)
   // Verify its percentile matches manual calculation
   // Compare with sector peers
   ```

2. **Distribution Test:**
   - For large sectors (100+ companies)
   - Each decile should have ~10% of companies
   - Check for uniform distribution

3. **Boundary Values:**
   - Minimum value → 0% percentile
   - Maximum value → 100% percentile
   - Median value → ~50% percentile

4. **Tie Handling:**
   - Companies with identical values should have identical percentiles

---

## 🚀 Deployment Notes

### Backend Requirements
- MongoDB with `fundamentals` and `metrics` collections
- Percentile jobs must have run at least once
- Express server with CORS enabled

### Frontend Requirements
- React 18+
- Tailwind CSS configured
- Lucide React icons
- React Router v6

### Environment Variables
```bash
# Backend (.env)
MONGO_URL=mongodb+srv://...
API_PORT=3001
FRONTEND_URL=http://localhost:3000

# Frontend (.env)
VITE_API_URL=http://localhost:3001/api/v1
```

---

## 🧪 Testing Checklist

- [ ] **API Endpoints**
  - [ ] GET /heatmap returns data for sector
  - [ ] GET /heatmap returns data for industry
  - [ ] POST /rank works with avg method
  - [ ] POST /rank works with weighted method
  - [ ] POST /rank works with count method
  - [ ] GET /sectors returns all sectors
  - [ ] GET /industries filters by sector
  - [ ] GET /available returns metrics list

- [ ] **Frontend Functionality**
  - [ ] Sidebar navigation opens heat map page
  - [ ] Sector dropdown loads sectors
  - [ ] Industry dropdown updates on sector change
  - [ ] Metrics checkboxes toggle correctly
  - [ ] Load heatmap button fetches data
  - [ ] Table displays color-coded percentiles
  - [ ] Tooltips show raw values
  - [ ] Formula builder toggles methods
  - [ ] Weight sliders update values
  - [ ] Apply formula ranks companies
  - [ ] Top companies panel displays results
  - [ ] CSV export downloads file

- [ ] **Edge Cases**
  - [ ] No data available (empty sector)
  - [ ] Single company in group
  - [ ] Null/missing metric values
  - [ ] All companies have same value (ties)
  - [ ] Very large result sets (100+ companies)

---

## 📈 Future Enhancements

### Potential Features
1. **Saved Formulas** - Save/load custom ranking formulas
2. **Comparison Mode** - Side-by-side sector comparison
3. **Historical Trends** - Show percentile changes over time
4. **Custom Thresholds** - User-defined percentile ranges for colors
5. **PDF Export** - Generate printable reports
6. **Favorites** - Mark and track favorite companies
7. **Alerts** - Notify when companies cross percentile thresholds
8. **Mobile Optimization** - Improved touch interactions

### Performance Optimizations
1. **Redis Caching** - Cache heatmap results for 1 hour
2. **Lazy Loading** - Load companies in batches
3. **Virtual Scrolling** - Handle 1000+ companies efficiently
4. **Web Workers** - Offload ranking calculations
5. **Query Optimization** - Add database indexes for speed

---

## 🐛 Troubleshooting

### Issue: "No data available"
**Solution:** Ensure percentile jobs have run successfully. Check `metrics` collection for `percentiles.sector` and `percentiles.industry` fields.

### Issue: Colors not showing
**Solution:** Check that percentile values are numbers between 0-1, not null.

### Issue: Rankings seem wrong
**Solution:** Verify formula method and weights. Check that all companies have valid percentile data.

### Issue: CSV export fails
**Solution:** Check browser console for errors. Ensure popup blockers aren't preventing download.

---

## 📝 API Integration Example

```javascript
// Fetch heat map data
const response = await fetch('/api/v1/metrics/heatmap?groupBy=sector&groupName=Technology&metrics=DividendGrowth3Y,DividendGrowth5Y');
const data = await response.json();

// Rank companies
const rankResponse = await fetch('/api/v1/metrics/heatmap/rank', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    companies: data.companies,
    formula: {
      method: 'weighted',
      metrics: ['DividendGrowth3Y', 'DividendGrowth5Y'],
      weights: { DividendGrowth3Y: 1, DividendGrowth5Y: 2 }
    }
  })
});
const ranked = await rankResponse.json();
console.log('Top companies:', ranked.topCompanies);
```

---

## 📞 Support

For issues or feature requests, please:
1. Check this documentation first
2. Review the percentile jobs documentation
3. Check the API endpoint responses
4. Verify data in MongoDB collections
5. Open a GitHub issue with reproduction steps

---

**Last Updated:** 2025-10-07
**Version:** 1.0.0
**Author:** Buydy Team

