import Style from '../models/product.model.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const upsertStyles = asyncHandler(async (req, res) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records)) {
    throw new ApiError(400, 'records array is required');
  }

  // -------- 1️⃣ Validate all records first --------
  for (const record of records) {
    const { styleNumber, channel, product_id, price } = record;
    if (!styleNumber || !channel || !product_id || price == null) {
      throw new ApiError(400, 'styleNumber, channel, product_id & price are required');
    }
  }

  // -------- 2️⃣ Extract unique styleNumbers --------
  const styleNumbers = [...new Set(records.map((r) => r.styleNumber))];

  // -------- 3️⃣ Find all existing styles with their channels --------
  const existingStyles = await Style.find({ styleNumber: { $in: styleNumbers } }).lean(); // Use lean() for better performance

  const existingMap = {};
  existingStyles.forEach((s) => {
    existingMap[s.styleNumber] = {
      styleNumber: s.styleNumber,
      marketPlaceDetails: s.marketPlaceDetails || [],
    };
  });

  const newStyleDocs = [];
  const bulkUpdates = [];
  const processedStyleChannelPairs = new Set(); // Track processed pairs

  // -------- 4️⃣ Process each record --------
  for (const record of records) {
    const { styleNumber, channel, product_id, price, status = 'active' } = record;

    // Create unique key for style+channel combination
    const styleChannelKey = `${styleNumber}_${channel}`;

    // Skip if we've already processed this style+channel in current request
    if (processedStyleChannelPairs.has(styleChannelKey)) {
      continue;
    }
    processedStyleChannelPairs.add(styleChannelKey);

    const exists = existingMap[styleNumber];

    if (!exists) {
      // New style - add to insert batch
      newStyleDocs.push({
        styleNumber,
        marketPlaceDetails: [{ channel, product_id, price, status }],
      });
      // Update existingMap to prevent duplicate processing in same batch
      existingMap[styleNumber] = {
        styleNumber,
        marketPlaceDetails: [{ channel, product_id, price, status }],
      };
    } else {
      // Check if channel already exists
      const channelExists = exists.marketPlaceDetails.find((item) => item.channel === channel);

      if (channelExists) {
        // Update existing channel
        bulkUpdates.push({
          updateOne: {
            filter: {
              styleNumber,
              'marketPlaceDetails.channel': channel,
            },
            update: {
              $set: {
                'marketPlaceDetails.$.price': price,
                'marketPlaceDetails.$.product_id': product_id,
                'marketPlaceDetails.$.status': status,
              },
            },
          },
        });
      } else {
        // Add new channel
        bulkUpdates.push({
          updateOne: {
            filter: { styleNumber },
            update: {
              $push: {
                marketPlaceDetails: {
                  channel,
                  product_id,
                  price,
                  status,
                },
              },
            },
          },
        });
        // Update local map to reflect the new channel
        exists.marketPlaceDetails.push({
          channel,
          product_id,
          price,
          status,
        });
      }
    }
  }

  // -------- 5️⃣ Execute database operations --------
  const operations = [];

  if (newStyleDocs.length > 0) {
    operations.push(Style.insertMany(newStyleDocs));
  }

  if (bulkUpdates.length > 0) {
    operations.push(Style.bulkWrite(bulkUpdates));
  }

  // Run all operations in parallel for better performance
  await Promise.all(operations);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        inserted: newStyleDocs.length,
        updated: bulkUpdates.length,
      },
      'Bulk upsert completed successfully'
    )
  );
});
// ==========================================================
// 📌 GET /products
// Fetch all products with filters + pagination
// ==========================================================
export const getAllProducts = asyncHandler(async (req, res) => {
  let { styleNumber, channel, page = 1, limit = 20 } = req.query;

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 20;

  const query = {};

  // Filter by style number
  if (styleNumber) {
    query.styleNumber = Number(styleNumber);
  }

  // Filter by channel inside marketplace array
  if (channel) {
    query['marketPlaceDetails.channel'] = channel;
  }

  const skip = (page - 1) * limit;

  // Fetch records
  const [products, total] = await Promise.all([
    Style.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),

    Style.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: totalPages,
        },
      },
      'Products fetched successfully'
    )
  );
});

// ==========================================================
// 📌 GET /products/:styleNumber
// Fetch single product by styleNumber
// ==========================================================
export const getSingleProduct = asyncHandler(async (req, res) => {
  const { styleNumber } = req.params;

  if (!styleNumber) {
    throw new ApiError(400, 'styleNumber is required');
  }

  const product = await Style.findOne({ styleNumber: Number(styleNumber) });

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  return res.status(200).json(new ApiResponse(200, product, 'Product details fetched'));
});

// ===================GET MISSING CHANNEL LISTING =======================

export const getMissingChannelListing = asyncHandler(async (req, res) => {
  const REQUIRED_CHANNELS = ['ajio', 'tatacliq', 'shopify', 'nykaa', 'myntra'];

  const channelListing = await Style.aggregate([
    // 1) Normalize to lowercase
    {
      $addFields: {
        existingChannels: {
          $map: {
            input: '$marketPlaceDetails',
            as: 'mp',
            in: { $toLower: '$$mp.channel' },
          },
        },
      },
    },

    // 2) Missing channels
    {
      $addFields: {
        missingChannels: {
          $filter: {
            input: REQUIRED_CHANNELS,
            as: 'required',
            cond: { $not: { $in: ['$$required', '$existingChannels'] } },
          },
        },
      },
    },

    // 3) Skip perfect styles (all channels present)
    {
      $match: {
        $expr: { $ne: [{ $size: '$existingChannels' }, REQUIRED_CHANNELS.length] },
      },
    },

    // 4) Identify PLUS styles (5xxx or 8xxx)
    {
      $addFields: {
        isQurviiPlus: {
          $or: [
            { $regexMatch: { input: { $toString: '$styleNumber' }, regex: /^5/ } },
            { $regexMatch: { input: { $toString: '$styleNumber' }, regex: /^8/ } },
          ],
        },
      },
    },

    // 5) Final output fields
    {
      $project: {
        styleNumber: 1,
        existingChannels: 1,
        missingChannels: 1,
        marketPlaceDetails: 1,
        isQurviiPlus: 1,
        _id: 0,
      },
    },

    { $sort: { styleNumber: -1 } },
  ]);

  // ---------------------------------------------------------
  // CHANNEL-WISE SUMMARY (Normal + Plus)
  // ---------------------------------------------------------

  const channelSummary = {};

  const PLUS_CHANNELS = REQUIRED_CHANNELS.map((c) => c + 'Plus');

  // Prepare empty objects
  REQUIRED_CHANNELS.forEach((channel) => {
    channelSummary[channel] = { styles: [], count: 0, existingCount: 0, missingCount: 0 };
  });

  PLUS_CHANNELS.forEach((channel) => {
    channelSummary[channel] = { styles: [], count: 0, existingCount: 0, missingCount: 0 };
  });

  // Fill summary
  for (const item of channelListing) {
    for (const channel of REQUIRED_CHANNELS) {
      const plusKey = channel + 'Plus';

      // -------- NORMAL channels (exclude 5xxx/8xxx) --------
      if (!item.isQurviiPlus) {
        if (item.missingChannels.includes(channel)) {
          channelSummary[channel].styles.push(item.styleNumber);
          channelSummary[channel].missingCount++;
        }
        if (item.existingChannels.includes(channel)) {
          channelSummary[channel].existingCount++;
        }
      }

      // -------- PLUS channels (only 5xxx/8xxx) --------
      if (item.isQurviiPlus) {
        if (item.missingChannels.includes(channel)) {
          channelSummary[plusKey].styles.push(item.styleNumber);
          channelSummary[plusKey].missingCount++;
        }
        if (item.existingChannels.includes(channel)) {
          channelSummary[plusKey].existingCount++;
        }
      }
    }
  }

  // Add count for each channel
  for (const ch of Object.keys(channelSummary)) {
    channelSummary[ch].count = channelSummary[ch].styles.length;
  }

  // ---------------------------------------------------------
  // QurviiPlus Missing Styles (Only 5xxx + 8xxx)
  // ---------------------------------------------------------
  const qurviiPlusMissingStyles = channelListing.filter((item) => item.isQurviiPlus);

  // ---------------------------------------------------------

  res.status(200).json(
    new ApiResponse(
      200,
      {
        count: channelListing.length,
        missingCount: channelSummary,
        qurviiPlusMissingStyles,
        channelListing,
      },
      'Missing channel style fetched successfully'
    )
  );
});
