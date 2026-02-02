import { bulkSyncPatterns } from '../services/pattern.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPatterns, updatePatternByNumber } from '../services/pattern.service.js';
const syncPatternsFromSheet = asyncHandler(async (req, res) => {
  const { patterns } = req.body;

  if (!patterns || !patterns.length) {
    return res.status(400).json(new ApiResponse('No data provided', null, 400));
  }

  const result = await bulkSyncPatterns(patterns);

  res.status(200).json(
    new ApiResponse(
      'Patterns synced successfully',
      {
        matchedCount: result.matchedCount,
        insertedCount: result.upsertedCount,
      },
      200
    )
  );
});

const fetchPatterns = asyncHandler(async (req, res) => {
  const result = await getPatterns(req.query);
  res.status(200).json(new ApiResponse('Patterns fetched successfully', result, 200));
});

const updatePatternSizes = asyncHandler(async (req, res) => {
  const { pattern_number } = req.params;
  const { sizes } = req.body; // [{ name: "M", completed: true }, { name: "L", completed: true }]

  const updatedPattern = await updatePatternByNumber(pattern_number, sizes);

  res.status(200).json(new ApiResponse('Pattern sizes updated successfully', updatedPattern, 200));
});

export { syncPatternsFromSheet, fetchPatterns, updatePatternSizes };
