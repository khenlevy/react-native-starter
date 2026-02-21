import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchHeatmapData,
  calculateRanking,
  fetchSectors,
  fetchIndustries,
  fetchAvailableMetrics,
  exportToCSV,
} from '../services/heatmapService';
import { applyPriceRangeFilters } from '../services/priceDataService';
import HeatMapSidebar from '../components/HeatMapSidebar';
import HeatMapContent from './HeatMapContent';

function HeatMap() {
  // Format value based on metric type
  const formatMetricValue = (value, metricType) => {
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
    }

    switch (metricType) {
      case 'percentage':
        return `${(value * 100).toFixed(2)}%`;
      case 'currency':
        return `$${value.toLocaleString()}`;
      case 'ratio':
        return value.toFixed(2);
      case 'number':
        return value.toLocaleString();
      default:
        return value.toString();
    }
  };

  // Color utility for percentile gradient
  const getPercentileColor = (percentile) => {
    if (percentile === null || percentile === undefined || isNaN(percentile)) {
      return 'bg-gray-100';
    }

    // Red → Yellow → Green gradient
    if (percentile >= 0.8) return 'bg-green-500';
    if (percentile >= 0.6) return 'bg-green-300';
    if (percentile >= 0.4) return 'bg-yellow-300';
    if (percentile >= 0.2) return 'bg-orange-300';
    return 'bg-red-300';
  };

  const getTextColorForBg = (percentile) => {
    if (percentile >= 0.6) return 'text-white';
    return 'text-gray-900';
  };

  // State
  const [loading, setLoading] = useState(false);
  const [initialDataLoading, setInitialDataLoading] = useState(true); // Track initial data loading
  const [error, setError] = useState(null);

  // Filters
  const [sectors, setSectors] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [availableMetrics, setAvailableMetrics] = useState([]);

  const [selectedGroupBy, setSelectedGroupBy] = useState('sector');
  const [selectedSectors, setSelectedSectors] = useState([]);
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState([
    'DividendYieldCurrent',
    'DividendGrowth5Y',
    'DebtToEquityCurrent',
    'EBITDAGrowth1Y',
  ]);

  // Heatmap data
  const [heatmapData, setHeatmapData] = useState(null);

  // Formula
  const [weights, setWeights] = useState({});
  const [formulaMethod, setFormulaMethod] = useState('weighted'); // 'weighted' | 'geometric'

  // Method name mapping (memoized to keep useCallback deps stable)
  const methodNames = useMemo(
    () => ({
      weighted: 'Weighted Average',
      geometric: 'Geometric Mean',
    }),
    [],
  );

  // Top companies from ranking
  const [topCompanies, setTopCompanies] = useState([]);
  const [optimizationMethodName, setOptimizationMethodName] =
    useState('Weighted Average');

  // Price Range Filters
  const [priceRangeFilters, setPriceRangeFilters] = useState({
    '1W': [-100, 100],
    '1M': [-100, 100],
    '3M': [-100, 100],
    '6M': [-100, 100],
    '1Y': [-100, 100],
  });
  const [priceRangeFiltersEnabled, setPriceRangeFiltersEnabled] =
    useState(false);
  const [displayCompanies, setDisplayCompanies] = useState([]);

  // Debouncing for real-time filtering
  const [filterTimeout, setFilterTimeout] = useState(null);
  const [isFiltering, setIsFiltering] = useState(false);

  // Only Complete Metrics filter
  // Default to false: show all companies even if missing metrics/percentiles
  // When true: only show companies with valid percentiles for all selected metrics
  const [onlyCompleteMetrics, setOnlyCompleteMetrics] = useState(false);

  // Section visibility toggles
  const [showDimensions, setShowDimensions] = useState(true); // Default open
  const [showFilters, setShowFilters] = useState(false);
  const [showOptimum, setShowOptimum] = useState(false);

  // Helper function to fetch all companies with pagination
  const fetchAllCompaniesWithPagination = useCallback(
    async ({ groupBy, groupName, metrics, onlyComplete }) => {
      let allCompanies = [];
      let offset = 0;
      const limit = 1000; // Fetch in larger batches for efficiency
      let hasMore = true;
      let totalCount = null;
      let pageCount = 0;

      console.log(
        `📥 Starting pagination for ${groupName || 'all companies'}...`,
      );

      while (hasMore) {
        pageCount++;
        const data = await fetchHeatmapData({
          groupBy,
          groupName,
          metrics,
          limit,
          offset,
          onlyComplete,
        });

        if (!data || !data.companies) {
          console.error('⚠️ Invalid API response:', data);
          break;
        }

        // Store total count from first page
        if (totalCount === null && data.pagination?.total !== undefined) {
          totalCount = data.pagination.total;
          console.log(`📊 Total companies available: ${totalCount}`);
        }

        const fetchedCount = data.companies.length;
        allCompanies = allCompanies.concat(data.companies);
        hasMore = data.pagination?.hasMore === true;

        console.log(
          `📄 Page ${pageCount}: Fetched ${fetchedCount} companies (Total so far: ${
            allCompanies.length
          }/${totalCount || 'unknown'})`,
        );

        offset += limit;

        // Verify we got the expected number of companies
        if (totalCount !== null && allCompanies.length >= totalCount) {
          console.log(
            `✅ Reached total count (${allCompanies.length}/${totalCount}), stopping pagination`,
          );
          hasMore = false;
        }

        // Safety check to prevent infinite loops
        if (offset > 50000) {
          console.warn('⚠️ Pagination limit reached (50k companies), stopping');
          break;
        }

        // Safety check: if we didn't get any companies, stop
        if (fetchedCount === 0) {
          console.warn(
            '⚠️ No companies returned in this batch, stopping pagination',
          );
          break;
        }
      }

      const finalCount = allCompanies.length;
      console.log(
        `✅ Pagination complete: Fetched ${finalCount} companies${
          totalCount ? ` (expected: ${totalCount})` : ''
        }`,
      );

      if (totalCount !== null && finalCount < totalCount) {
        console.warn(
          `⚠️ Warning: Fetched ${finalCount} companies but expected ${totalCount}. There may be missing data.`,
        );
      }

      return allCompanies;
    },
    [],
  );

  const filterCompaniesForPricing = useCallback(
    (companies) => {
      if (!Array.isArray(companies)) {
        return {
          passed: [],
          blacklisted: [],
          errors: [],
          summary: {
            total: 0,
            passed: 0,
            blacklisted: 0,
            errors: 0,
          },
        };
      }

      if (!priceRangeFiltersEnabled) {
        return {
          passed: companies,
          blacklisted: [],
          errors: [],
          summary: {
            total: companies.length,
            passed: companies.length,
            blacklisted: 0,
            errors: 0,
          },
        };
      }

      return applyPriceRangeFilters(companies, priceRangeFilters);
    },
    [priceRangeFiltersEnabled, priceRangeFilters],
  );

  const runRankingForCompanies = useCallback(
    async (companiesToRank) => {
      if (!companiesToRank || companiesToRank.length === 0) {
        setTopCompanies([]);
        setOptimizationMethodName(
          methodNames[formulaMethod] || 'Weighted Average',
        );
        return;
      }

      const symbols = companiesToRank.map((c) => c.symbol);

      const result = await calculateRanking(
        symbols,
        selectedMetrics,
        selectedGroupBy,
        weights,
        null,
        formulaMethod,
      );

      setTopCompanies(result.topCompanies);
      setOptimizationMethodName(
        methodNames[formulaMethod] || 'Weighted Average',
      );
    },
    [formulaMethod, methodNames, selectedGroupBy, selectedMetrics, weights],
  );

  const loadHeatmap = useCallback(async () => {
    console.log('🚀 [LOAD HEATMAP] Starting loadHeatmap, setting loading=true');
    setLoading(true);
    setError(null);

    try {
      // For multi-select, we need to fetch data for each selected sector/industry
      let allCompanies = [];

      if (selectedGroupBy === 'sector') {
        if (selectedSectors.length === 0) {
          // Load all sectors with pagination
          console.log(
            '📊 Fetching all companies (all sectors) with pagination...',
          );
          allCompanies = await fetchAllCompaniesWithPagination({
            groupBy: 'sector',
            metrics: selectedMetrics,
            onlyComplete: onlyCompleteMetrics,
          });
          console.log(
            `✅ Fetched ${allCompanies.length} companies from all sectors`,
          );
        } else {
          // Load each selected sector with pagination
          for (const sector of selectedSectors) {
            console.log(`📊 Fetching companies for sector: ${sector}...`);
            const sectorCompanies = await fetchAllCompaniesWithPagination({
              groupBy: 'sector',
              groupName: sector,
              metrics: selectedMetrics,
              onlyComplete: onlyCompleteMetrics,
            });
            allCompanies = allCompanies.concat(sectorCompanies);
            console.log(
              `✅ Fetched ${sectorCompanies.length} companies from ${sector}`,
            );
          }
        }
      } else if (selectedGroupBy === 'industry') {
        if (selectedIndustries.length === 0) {
          // Load all industries with pagination
          console.log(
            '📊 Fetching all companies (all industries) with pagination...',
          );
          allCompanies = await fetchAllCompaniesWithPagination({
            groupBy: 'industry',
            metrics: selectedMetrics,
            onlyComplete: onlyCompleteMetrics,
          });
          console.log(
            `✅ Fetched ${allCompanies.length} companies from all industries`,
          );
        } else {
          // Load each selected industry with pagination
          for (const industry of selectedIndustries) {
            console.log(`📊 Fetching companies for industry: ${industry}...`);
            const industryCompanies = await fetchAllCompaniesWithPagination({
              groupBy: 'industry',
              groupName: industry,
              metrics: selectedMetrics,
              onlyComplete: onlyCompleteMetrics,
            });
            allCompanies = allCompanies.concat(industryCompanies);
            console.log(
              `✅ Fetched ${industryCompanies.length} companies from ${industry}`,
            );
          }
        }
      }

      // Deduplicate companies by symbol (in case of duplicates when fetching multiple sectors/industries)
      const uniqueCompaniesMap = new Map();
      allCompanies.forEach((company) => {
        if (!uniqueCompaniesMap.has(company.symbol)) {
          uniqueCompaniesMap.set(company.symbol, company);
        }
      });
      const deduplicatedCompanies = Array.from(uniqueCompaniesMap.values());

      if (deduplicatedCompanies.length !== allCompanies.length) {
        console.log(
          `🔄 Removed ${
            allCompanies.length - deduplicatedCompanies.length
          } duplicate companies`,
        );
      }

      // Filter companies based on selected sectors and industries
      let filteredCompanies = deduplicatedCompanies;

      if (selectedSectors.length > 0) {
        const beforeFilter = filteredCompanies.length;
        filteredCompanies = filteredCompanies.filter((company) =>
          selectedSectors.includes(company.sector),
        );
        if (beforeFilter !== filteredCompanies.length) {
          console.log(
            `🔍 Filtered by sectors: ${beforeFilter} → ${filteredCompanies.length} companies`,
          );
        }
      }

      if (selectedIndustries.length > 0) {
        const beforeFilter = filteredCompanies.length;
        filteredCompanies = filteredCompanies.filter((company) =>
          selectedIndustries.includes(company.industry),
        );
        if (beforeFilter !== filteredCompanies.length) {
          console.log(
            `🔍 Filtered by industries: ${beforeFilter} → ${filteredCompanies.length} companies`,
          );
        }
      }

      // Create heatmap data structure
      const data = {
        group: selectedGroupBy === 'sector' ? 'Sectors' : 'Industries',
        groupBy: selectedGroupBy,
        companies: filteredCompanies,
        totalCompanies: filteredCompanies.length,
      };

      console.log(
        `🎉 Heatmap loaded: ${filteredCompanies.length} unique companies ready for display`,
      );

      setHeatmapData(data);
      const filterResult = filterCompaniesForPricing(filteredCompanies);
      setDisplayCompanies(filterResult.passed);

      // Apply price range filters after loading data
      // NOTE: Don't call applyFormulaWithCurrentFilters here immediately
      // because heatmapData state hasn't been set yet.
      // Instead, let the useEffect that watches heatmapData handle it.
    } catch (err) {
      setError('Failed to load heatmap: ' + err.message);
    } finally {
      console.log(
        '🏁 [LOAD HEATMAP] Finished loadHeatmap, setting loading=false',
      );
      setLoading(false);
    }
  }, [
    selectedGroupBy,
    selectedSectors,
    selectedIndustries,
    selectedMetrics,
    onlyCompleteMetrics,
    filterCompaniesForPricing,
    fetchAllCompaniesWithPagination,
  ]);

  // Load initial data
  useEffect(() => {
    console.log('🚀 HeatMap component mounted, loading initial data...');
    loadInitialData();
  }, []);

  // Re-filter when onlyCompleteMetrics changes (after heatmap is loaded)
  useEffect(() => {
    if (heatmapData) {
      console.log('🔄 Only complete metrics toggle changed, re-filtering...');
      loadHeatmap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- heatmapData/loadHeatmap omitted to avoid loops
  }, [onlyCompleteMetrics]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (filterTimeout) {
        clearTimeout(filterTimeout);
      }
    };
  }, [filterTimeout]);

  // Load industries when sectors change
  useEffect(() => {
    if (selectedSectors.length > 0) {
      loadIndustriesForSectors(selectedSectors);
    } else {
      loadAllIndustries();
    }
  }, [selectedSectors]);

  // Reset filters when groupBy changes
  useEffect(() => {
    // Clear all filters when groupBy changes
    setSelectedSectors([]);
    setSelectedIndustries([]);
    setIndustries([]);

    // Load appropriate data based on groupBy selection
    if (selectedGroupBy === 'industry') {
      loadAllIndustries();
    }
  }, [selectedGroupBy]);

  // Re-apply filters when enabled state changes
  useEffect(() => {
    if (heatmapData && heatmapData.companies) {
      applyFormulaWithCurrentFilters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyFormulaWithCurrentFilters omitted to avoid loops
  }, [heatmapData, priceRangeFiltersEnabled]);

  // Re-apply filters when price range filters change (debounced)
  useEffect(() => {
    if (!heatmapData || !heatmapData.companies) {
      return;
    }

    if (!priceRangeFiltersEnabled) {
      // If filters are disabled, apply without filters
      applyFormulaWithCurrentFilters();
      return;
    }

    // Clear any existing timeout
    if (filterTimeout) {
      clearTimeout(filterTimeout);
    }

    // Debounce the filter application
    const timeout = setTimeout(() => {
      console.log(
        '🔍 [DEBOUNCE] Applying debounced filters:',
        priceRangeFilters,
      );
      applyFormulaWithCurrentFilters();
    }, 500); // 500ms debounce

    setFilterTimeout(timeout);

    // Cleanup function
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps omitted to avoid loops
  }, [priceRangeFilters]);

  async function loadInitialData() {
    console.log('🔄 Loading initial data...');
    setInitialDataLoading(true);
    try {
      const [sectorsData, metricsData] = await Promise.all([
        fetchSectors(),
        fetchAvailableMetrics(),
      ]);

      console.log('✅ Initial data loaded:', {
        sectors: sectorsData.length,
        metrics: metricsData.length,
      });

      setSectors(sectorsData);
      setAvailableMetrics(metricsData);

      // Set default selections to all options
      setSelectedSectors(sectorsData);
      setSelectedIndustries([]); // Will be set when industries load

      // Set default weights
      const defaultWeights = {};
      metricsData.forEach((metric) => {
        defaultWeights[metric.key] = 1;
      });
      setWeights(defaultWeights);
    } catch (err) {
      setError('Failed to load initial data: ' + err.message);
    } finally {
      // Don't set initialDataLoading to false here - wait for industries to load
    }
  }

  async function loadIndustriesForSectors(sectors) {
    try {
      console.log('🔄 Loading industries for sectors:', sectors);
      // Load industries for all selected sectors
      const allIndustries = new Set();
      for (const sector of sectors) {
        const industriesData = await fetchIndustries(sector);
        industriesData.forEach((industry) => allIndustries.add(industry));
      }
      const industriesArray = Array.from(allIndustries);
      setIndustries(industriesArray);

      // Don't auto-select all industries to prevent excessive requests
      // setSelectedIndustries(industriesArray);

      console.log('✅ Industries loaded for sectors:', industriesArray.length);
      setInitialDataLoading(false); // Initial data loading is complete
    } catch (err) {
      console.error('Failed to load industries:', err);
      setInitialDataLoading(false); // Even on error, allow user to proceed
    }
  }

  async function loadAllIndustries() {
    try {
      console.log('🔄 Loading all industries...');
      const industriesData = await fetchIndustries(); // No sector parameter = all industries
      setIndustries(industriesData);

      // Set default selection to all industries
      setSelectedIndustries(industriesData);

      console.log('✅ All industries loaded:', industriesData.length);
      setInitialDataLoading(false); // Initial data loading is complete
    } catch (err) {
      console.error('Failed to load all industries:', err);
      setInitialDataLoading(false); // Even on error, allow user to proceed
    }
  }

  async function applyFormula() {
    if (!heatmapData || !heatmapData.companies) {
      return;
    }

    try {
      // Update method name immediately for user feedback
      setOptimizationMethodName(
        methodNames[formulaMethod] || 'Weighted Average',
      );

      // Apply price range filters locally FIRST if enabled
      let companiesToRank = heatmapData.companies;

      const filterResult = filterCompaniesForPricing(heatmapData.companies);
      companiesToRank = filterResult.passed;
      setDisplayCompanies(filterResult.passed);

      await runRankingForCompanies(companiesToRank);
    } catch (err) {
      setError('Failed to rank companies: ' + err.message);
    }
  }

  // Real-time formula application with local filtering
  async function applyFormulaWithCurrentFilters() {
    if (!heatmapData || !heatmapData.companies) {
      return;
    }

    setIsFiltering(true);

    try {
      // Update method name immediately for user feedback
      setOptimizationMethodName(
        methodNames[formulaMethod] || 'Weighted Average',
      );

      const filterResult = filterCompaniesForPricing(heatmapData.companies);
      const companiesToRank = filterResult.passed;
      setDisplayCompanies(companiesToRank);

      await runRankingForCompanies(companiesToRank);
    } catch (err) {
      console.error('Failed to apply real-time filtering:', err.message);
      setError('Failed to apply real-time filtering: ' + err.message);
    } finally {
      setIsFiltering(false);
    }
  }

  function handleExportCSV() {
    if (heatmapData && heatmapData.companies) {
      exportToCSV(heatmapData.companies, selectedMetrics, availableMetrics);
    }
  }

  function resetPriceRangeFilters() {
    setPriceRangeFilters({
      '1W': [-100, 100],
      '1M': [-100, 100],
      '3M': [-100, 100],
      '6M': [-100, 100],
      '1Y': [-100, 100],
    });

    // Immediate filtering when reset (no debounce for reset action)
    if (heatmapData && heatmapData.companies) {
      // Clear any pending debounced calls
      if (filterTimeout) {
        clearTimeout(filterTimeout);
        setFilterTimeout(null);
      }

      // Apply filters immediately
      applyFormulaWithCurrentFilters();
    }
  }

  return (
    <div className="flex h-full bg-gray-50 dark:bg-background-dark">
      {/* Left Panel - Filters & Formula Builder */}
      <HeatMapSidebar
        // Data
        sectors={sectors}
        industries={industries}
        availableMetrics={availableMetrics}
        selectedMetrics={selectedMetrics}
        selectedSectors={selectedSectors}
        selectedIndustries={selectedIndustries}
        selectedGroupBy={selectedGroupBy}
        // States
        loading={loading}
        initialDataLoading={initialDataLoading}
        isFiltering={isFiltering}
        onlyCompleteMetrics={onlyCompleteMetrics}
        showDimensions={showDimensions}
        showFilters={showFilters}
        showOptimum={showOptimum}
        heatmapLoaded={!!heatmapData}
        // Formula states
        weights={weights}
        // Price range filters
        priceRangeFilters={priceRangeFilters}
        priceRangeFiltersEnabled={priceRangeFiltersEnabled}
        // Callbacks
        onGroupByChange={setSelectedGroupBy}
        onMetricsChange={setSelectedMetrics}
        onSectorsChange={setSelectedSectors}
        onIndustriesChange={setSelectedIndustries}
        onOnlyCompleteMetricsChange={setOnlyCompleteMetrics}
        onShowDimensionsChange={setShowDimensions}
        onShowFiltersChange={setShowFilters}
        onShowOptimumChange={setShowOptimum}
        formulaMethod={formulaMethod}
        onFormulaMethodChange={setFormulaMethod}
        onWeightsChange={setWeights}
        onPriceRangeFiltersChange={setPriceRangeFilters}
        onPriceRangeFiltersEnabledChange={setPriceRangeFiltersEnabled}
        onLoadHeatmap={loadHeatmap}
        onApplyFormula={applyFormula}
        onResetPriceRangeFilters={resetPriceRangeFilters}
      />

      {/* Main Content */}
      <HeatMapContent
        // Data
        heatmapData={heatmapData}
        displayCompanies={displayCompanies}
        topCompanies={topCompanies}
        optimizationMethodName={optimizationMethodName}
        selectedMetrics={selectedMetrics}
        availableMetrics={availableMetrics}
        selectedGroupBy={selectedGroupBy}
        // States
        loading={loading}
        isFiltering={isFiltering}
        error={error}
        // Callbacks
        onExportCSV={handleExportCSV}
        getPercentileColor={getPercentileColor}
        getTextColorForBg={getTextColorForBg}
        formatMetricValue={formatMetricValue}
      />
    </div>
  );
}

export default HeatMap;
