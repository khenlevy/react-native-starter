import logger from '@buydy/se-logger';
export async function bulkLoadPriceRangeData(req, res) {
  logger.business(
    'priceRangeBulkController deprecated endpoint accessed; relying on metrics-backed price filters instead',
  );
  return res.status(410).json({
    error:
      'The bulk price range endpoint has been deprecated. Use /metrics/heatmap/price-range/filter, which relies on stored price change metrics.',
  });
}
