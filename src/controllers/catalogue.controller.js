import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Catalouge } from '../models/catalogue.model.js';
import mongoose from 'mongoose';
import { ProgressHistory } from '../models/catalogueProgressHistory.model.js';
import { Parser } from 'json2csv';

const buildUpdateQuery = (payload, user) => {
  const setObj = {};
  const history = [];

  Object.entries(payload).forEach(([section, steps]) => {
    Object.entries(steps).forEach(([step, value]) => {
      // designer/catalogue progress
      if (value.hasOwnProperty('completed')) {
        setObj[`${section}.${step}.completed`] = value.completed;
        setObj[`${section}.${step}.createdAt`] = new Date();
        setObj[`${section}.${step}.createdBy`] = user;
      }

      // marketplace upload
      if (value.hasOwnProperty('uploaded')) {
        setObj[`${section}.${step}.uploaded`] = value.uploaded;
        setObj[`${section}.${step}.uploadedAt`] = new Date();
      }

      history.push({
        section,
        step,
        action: 'updated',
        performedBy: user,
        performedAt: new Date(),
      });
    });
  });

  return { setObj, history };
};

const upsertCatalogueProgress = asyncHandler(async (req, res) => {
  let { updates, user } = req.body;

  if (!updates) {
    throw new ApiError(400, 'updates payload required');
  }

  if (!Array.isArray(updates)) {
    updates = [updates];
  }

  const catalogueBulkOps = [];
  const historyDocs = [];

  updates.forEach((item) => {
    const { styleNumber, progress, jobId, collection_name } = item;

    const { setObj, history } = buildUpdateQuery(progress, user);

    //  ADD THIS
    if (jobId !== undefined) setObj.jobId = jobId;
    if (collection_name !== undefined) setObj.collection_name = collection_name;

    catalogueBulkOps.push({
      updateOne: {
        filter: { styleNumber },
        update: { $set: setObj },
        upsert: true,
      },
    });

    history.forEach((h) => {
      historyDocs.push({
        styleNumber,
        section: h.section,
        step: h.step,
        action: h.action,
        performedBy: h.performedBy,
        performedAt: h.performedAt || new Date(),
      });
    });
  });

  //  1. Update catalogue
  const catalogueResult = await Catalouge.bulkWrite(catalogueBulkOps);

  //  2. Fetch catalogue ids
  const catalogues = await Catalouge.find({
    styleNumber: { $in: updates.map((u) => u.styleNumber) },
  }).select('_id styleNumber');

  const idMap = Object.fromEntries(catalogues.map((c) => [c.styleNumber, c._id]));

  // 3. attach catalogueId
  const finalHistoryDocs = historyDocs.map((h) => ({
    catalogueId: idMap[h.styleNumber],
    section: h.section,
    step: h.step,
    action: h.action,
    performedBy: h.performedBy,
    performedAt: h.performedAt,
  }));

  //  4. insert history
  if (finalHistoryDocs.length) {
    await ProgressHistory.insertMany(finalHistoryDocs);
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { catalogueResult, jobId: updates[0].jobId, collection_name: updates[0].collection_name },
        'Progress updated successfully'
      )
    );
});

const getCatalouges = asyncHandler(async (req, res) => {
  let { limit, cursor, styleNumber, completed, jobId } = req.query;

  limit = Number(limit) || 2;
  const query = {};

  // Cursor pagination
  if (cursor) {
    const validCursor = mongoose.Types.ObjectId.isValid(cursor);
    if (!validCursor) {
      throw new ApiError(400, 'Invalid Cursor');
    }

    query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  // Style number filter
  if (styleNumber) {
    query.styleNumber = Number(styleNumber);
  }
  if (jobId) {
    query.jobId = Number(jobId);
  }

  // styleLive completed filter
  if (completed !== undefined) {
    query['catalogueProgress.styleLive.completed'] = completed === 'true';
  }

  const results = await Catalouge.aggregate([
    // ✅ FIRST match (important for performance)
    { $match: query },

    // ✅ sort for cursor pagination
    { $sort: { _id: -1 } },

    // ✅ fetch one extra for next page check
    { $limit: limit + 1 },

    // ✅ join history
    {
      $lookup: {
        from: 'progresshistories',
        localField: '_id',
        foreignField: 'catalogueId',
        as: 'progressHistory',
      },
    },

    // ✅ filter marketplace only
    {
      $addFields: {
        marketplaceHistory: {
          $filter: {
            input: '$progressHistory',
            as: 'history',
            cond: {
              $eq: ['$$history.section', 'marketplaceUpload'],
            },
          },
        },
      },
    },
  ]);

  const hasNextPage = results.length > limit;
  if (hasNextPage) results.pop();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        count: results.length,
        results,
        nextCursor: hasNextPage ? results[results.length - 1]._id : null,
      },
      'Catalouge Fetched Successfully'
    )
  );
});

// controllers/report.controller.js (backend)

// const report = asyncHandler(async (req, res) => {
//   const {
//     // Basic Filters
//     styleNumber,
//     collection_name,
//     jobId,

//     // Status Filters
//     inventory_status,
//     status,

//     // Date Range Filters
//     createdAfter,
//     createdBefore,

//     // Designer Progress Filters
//     stylewise_completed,
//     imageGenerated_completed,
//     imageRenamedUploaded_completed,
//     webpUploaded_completed,

//     // Catalogue Progress Filters
//     skuCreatedOnOms_completed,
//     styleMapped_completed,
//     inventoryUploaded_completed,
//     styleLive_completed,

//     // Marketplace Filters
//     myntra_uploaded,
//     nykaa_uploaded,
//     shopify_uploaded,
//     tatacliq_uploaded,
//     ajio_uploaded,
//     shoppersstop_uploaded,

//     // Performer Filters
//     progressPerformedBy,

//     // Pagination
//     limit = 50,
//     page = 1,
//     sortBy = 'createdAt',
//     sortOrder = 'desc',
//     format = 'json',
//   } = req.query;

//   // Build match stage
//   let matchStage = {};

//   // Basic Filters
//   if (styleNumber) matchStage.styleNumber = Number(styleNumber);
//   if (collection_name) matchStage.collection_name = collection_name;
//   if (jobId) matchStage.jobId = Number(jobId);
//   if (inventory_status) matchStage.inventory_status = inventory_status;
//   if (status) matchStage.status = status;

//   // Date Filters
//   if (createdAfter || createdBefore) {
//     matchStage.createdAt = {};
//     if (createdAfter) matchStage.createdAt.$gte = new Date(createdAfter);
//     if (createdBefore) matchStage.createdAt.$lte = new Date(createdBefore);
//   }

//   // Designer Progress Filters
//   if (stylewise_completed !== undefined) {
//     matchStage['designerProgress.stylewise.completed'] = stylewise_completed === 'true';
//   }
//   if (imageGenerated_completed !== undefined) {
//     matchStage['designerProgress.imageGenerated.completed'] = imageGenerated_completed === 'true';
//   }
//   if (imageRenamedUploaded_completed !== undefined) {
//     matchStage['designerProgress.imageRenamedUploaded.completed'] =
//       imageRenamedUploaded_completed === 'true';
//   }
//   if (webpUploaded_completed !== undefined) {
//     matchStage['designerProgress.webpUploaded.completed'] = webpUploaded_completed === 'true';
//   }

//   // Catalogue Progress Filters
//   if (skuCreatedOnOms_completed !== undefined) {
//     matchStage['catalogueProgress.skuCreatedOnOms.completed'] =
//       skuCreatedOnOms_completed === 'true';
//   }
//   if (styleMapped_completed !== undefined) {
//     matchStage['catalogueProgress.styleMapped.completed'] = styleMapped_completed === 'true';
//   }
//   if (inventoryUploaded_completed !== undefined) {
//     matchStage['catalogueProgress.inventoryUploaded.completed'] =
//       inventoryUploaded_completed === 'true';
//   }
//   if (styleLive_completed !== undefined) {
//     matchStage['catalogueProgress.styleLive.completed'] = styleLive_completed === 'true';
//   }

//   // Marketplace Filters - Handle false values properly
//   const handleMarketplaceFilter = (field, value) => {
//     if (value === 'true') {
//       return { [`marketplaceUpload.${field}.uploaded`]: true };
//     } else if (value === 'false') {
//       return {
//         $or: [
//           { [`marketplaceUpload.${field}.uploaded`]: { $ne: true } },
//           { [`marketplaceUpload.${field}`]: { $exists: false } },
//         ],
//       };
//     }
//     return {};
//   };

//   // Apply marketplace filters
//   const marketplaceFilters = [];

//   if (myntra_uploaded) {
//     marketplaceFilters.push(handleMarketplaceFilter('myntra', myntra_uploaded));
//   }
//   if (nykaa_uploaded) {
//     marketplaceFilters.push(handleMarketplaceFilter('nykaa', nykaa_uploaded));
//   }
//   if (shopify_uploaded) {
//     marketplaceFilters.push(handleMarketplaceFilter('shopify', shopify_uploaded));
//   }
//   if (tatacliq_uploaded) {
//     marketplaceFilters.push(handleMarketplaceFilter('tatacliq', tatacliq_uploaded));
//   }
//   if (ajio_uploaded) {
//     marketplaceFilters.push(handleMarketplaceFilter('ajio', ajio_uploaded));
//   }
//   if (shoppersstop_uploaded) {
//     marketplaceFilters.push(handleMarketplaceFilter('shoppersstop', shoppersstop_uploaded));
//   }

//   if (marketplaceFilters.length > 0) {
//     matchStage.$and = marketplaceFilters;
//   }

//   // Performer Filter
//   if (progressPerformedBy) {
//     const performerFilter = {
//       $or: [
//         { 'designerProgress.stylewise.createdBy': progressPerformedBy },
//         { 'designerProgress.imageGenerated.createdBy': progressPerformedBy },
//         { 'designerProgress.imageRenamedUploaded.createdBy': progressPerformedBy },
//         { 'designerProgress.webpUploaded.createdBy': progressPerformedBy },
//         { 'catalogueProgress.skuCreatedOnOms.createdBy': progressPerformedBy },
//         { 'catalogueProgress.styleMapped.createdBy': progressPerformedBy },
//         { 'catalogueProgress.inventoryUploaded.createdBy': progressPerformedBy },
//         { 'catalogueProgress.styleLive.createdBy': progressPerformedBy },
//         { 'marketplaceUpload.myntra.uploadedBy': progressPerformedBy },
//         { 'marketplaceUpload.nykaa.uploadedBy': progressPerformedBy },
//         { 'marketplaceUpload.shopify.uploadedBy': progressPerformedBy },
//         { 'marketplaceUpload.tatacliq.uploadedBy': progressPerformedBy },
//         { 'marketplaceUpload.ajio.uploadedBy': progressPerformedBy },
//         { 'marketplaceUpload.shoppersstop.uploadedBy': progressPerformedBy },
//       ],
//     };

//     if (matchStage.$and) {
//       matchStage.$and.push(performerFilter);
//     } else {
//       matchStage.$and = [performerFilter];
//     }
//   }

//   // Pagination
//   const skip = (parseInt(page) - 1) * parseInt(limit);
//   const sortStage = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

//   try {
//     // Build aggregation pipeline
//     const pipeline = [
//       { $match: matchStage },
//       { $sort: sortStage },
//       { $skip: skip },
//       { $limit: parseInt(limit) },

//       // Lookup progress history
//       {
//         $lookup: {
//           from: 'progresshistories',
//           localField: '_id',
//           foreignField: 'catalogueId',
//           as: 'progressHistory',
//         },
//       },

//       // Add computed fields - FIXED: Handle null/undefined values
//       {
//         $addFields: {
//           // Convert objects to arrays safely
//           designerProgressArray: {
//             $cond: {
//               if: { $isArray: { $objectToArray: '$designerProgress' } },
//               then: { $objectToArray: '$designerProgress' },
//               else: [],
//             },
//           },
//           catalogueProgressArray: {
//             $cond: {
//               if: { $isArray: { $objectToArray: '$catalogueProgress' } },
//               then: { $objectToArray: '$catalogueProgress' },
//               else: [],
//             },
//           },
//           marketplaceUploadArray: {
//             $cond: {
//               if: { $isArray: { $objectToArray: '$marketplaceUpload' } },
//               then: { $objectToArray: '$marketplaceUpload' },
//               else: [],
//             },
//           },
//         },
//       },

//       // Add computed fields using safe arrays
//       {
//         $addFields: {
//           // Designer Progress Percentage
//           designerProgressPercentage: {
//             $cond: {
//               if: { $gt: [{ $size: '$designerProgressArray' }, 0] },
//               then: {
//                 $multiply: [
//                   {
//                     $divide: [
//                       {
//                         $size: {
//                           $filter: {
//                             input: '$designerProgressArray',
//                             as: 'item',
//                             cond: '$$item.v.completed',
//                           },
//                         },
//                       },
//                       { $size: '$designerProgressArray' },
//                     ],
//                   },
//                   100,
//                 ],
//               },
//               else: 0,
//             },
//           },

//           // Catalogue Progress Percentage
//           catalogueProgressPercentage: {
//             $cond: {
//               if: { $gt: [{ $size: '$catalogueProgressArray' }, 0] },
//               then: {
//                 $multiply: [
//                   {
//                     $divide: [
//                       {
//                         $size: {
//                           $filter: {
//                             input: '$catalogueProgressArray',
//                             as: 'item',
//                             cond: '$$item.v.completed',
//                           },
//                         },
//                       },
//                       { $size: '$catalogueProgressArray' },
//                     ],
//                   },
//                   100,
//                 ],
//               },
//               else: 0,
//             },
//           },

//           // Marketplace Progress Percentage
//           marketplaceProgressPercentage: {
//             $cond: {
//               if: { $gt: [{ $size: '$marketplaceUploadArray' }, 0] },
//               then: {
//                 $multiply: [
//                   {
//                     $divide: [
//                       {
//                         $size: {
//                           $filter: {
//                             input: '$marketplaceUploadArray',
//                             as: 'item',
//                             cond: '$$item.v.uploaded',
//                           },
//                         },
//                       },
//                       { $size: '$marketplaceUploadArray' },
//                     ],
//                   },
//                   100,
//                 ],
//               },
//               else: 0,
//             },
//           },

//           // Overall Progress
//           overallProgress: {
//             $let: {
//               vars: {
//                 totalDesigner: { $size: '$designerProgressArray' },
//                 completedDesigner: {
//                   $size: {
//                     $filter: {
//                       input: '$designerProgressArray',
//                       as: 'item',
//                       cond: '$$item.v.completed',
//                     },
//                   },
//                 },
//                 totalCatalogue: { $size: '$catalogueProgressArray' },
//                 completedCatalogue: {
//                   $size: {
//                     $filter: {
//                       input: '$catalogueProgressArray',
//                       as: 'item',
//                       cond: '$$item.v.completed',
//                     },
//                   },
//                 },
//                 totalMarketplace: { $size: '$marketplaceUploadArray' },
//                 completedMarketplace: {
//                   $size: {
//                     $filter: {
//                       input: '$marketplaceUploadArray',
//                       as: 'item',
//                       cond: '$$item.v.uploaded',
//                     },
//                   },
//                 },
//               },
//               in: {
//                 $cond: {
//                   if: {
//                     $gt: [
//                       { $add: ['$$totalDesigner', '$$totalCatalogue', '$$totalMarketplace'] },
//                       0,
//                     ],
//                   },
//                   then: {
//                     $multiply: [
//                       {
//                         $divide: [
//                           {
//                             $add: [
//                               '$$completedDesigner',
//                               '$$completedCatalogue',
//                               '$$completedMarketplace',
//                             ],
//                           },
//                           {
//                             $add: ['$$totalDesigner', '$$totalCatalogue', '$$totalMarketplace'],
//                           },
//                         ],
//                       },
//                       100,
//                     ],
//                   },
//                   else: 0,
//                 },
//               },
//             },
//           },

//           // Individual step statuses - FIXED: Always include with default false
//           marketplaceStatus: {
//             myntra: { $ifNull: ['$marketplaceUpload.myntra.uploaded', false] },
//             nykaa: { $ifNull: ['$marketplaceUpload.nykaa.uploaded', false] },
//             shopify: { $ifNull: ['$marketplaceUpload.shopify.uploaded', false] },
//             tatacliq: { $ifNull: ['$marketplaceUpload.tatacliq.uploaded', false] },
//             ajio: { $ifNull: ['$marketplaceUpload.ajio.uploaded', false] },
//             shoppersstop: { $ifNull: ['$marketplaceUpload.shoppersstop.uploaded', false] },
//           },

//           // Designer step statuses
//           designerStatus: {
//             stylewise: { $ifNull: ['$designerProgress.stylewise.completed', false] },
//             imageGenerated: { $ifNull: ['$designerProgress.imageGenerated.completed', false] },
//             imageRenamedUploaded: {
//               $ifNull: ['$designerProgress.imageRenamedUploaded.completed', false],
//             },
//             webpUploaded: { $ifNull: ['$designerProgress.webpUploaded.completed', false] },
//           },

//           // Catalogue step statuses
//           catalogueStatus: {
//             skuCreatedOnOms: { $ifNull: ['$catalogueProgress.skuCreatedOnOms.completed', false] },
//             styleMapped: { $ifNull: ['$catalogueProgress.styleMapped.completed', false] },
//             inventoryUploaded: {
//               $ifNull: ['$catalogueProgress.inventoryUploaded.completed', false],
//             },
//             styleLive: { $ifNull: ['$catalogueProgress.styleLive.completed', false] },
//           },

//           // Active marketplaces
//           activeMarketplaces: {
//             $map: {
//               input: {
//                 $filter: {
//                   input: '$marketplaceUploadArray',
//                   as: 'item',
//                   cond: '$$item.v.uploaded',
//                 },
//               },
//               as: 'item',
//               in: '$$item.k',
//             },
//           },

//           // Last activity
//           lastActivity: {
//             $cond: {
//               if: { $gt: [{ $size: '$progressHistory' }, 0] },
//               then: { $arrayElemAt: ['$progressHistory.performedAt', -1] },
//               else: '$updatedAt',
//             },
//           },
//           lastActivityBy: {
//             $cond: {
//               if: { $gt: [{ $size: '$progressHistory' }, 0] },
//               then: { $arrayElemAt: ['$progressHistory.performedBy', -1] },
//               else: null,
//             },
//           },
//           lastActivityStep: {
//             $cond: {
//               if: { $gt: [{ $size: '$progressHistory' }, 0] },
//               then: { $arrayElemAt: ['$progressHistory.step', -1] },
//               else: null,
//             },
//           },
//         },
//       },

//       // Remove temporary arrays
//       {
//         $project: {
//           designerProgressArray: 0,
//           catalogueProgressArray: 0,
//           marketplaceUploadArray: 0,
//         },
//       },
//     ];

//     // Get total count
//     const totalCount = await Catalouge.countDocuments(matchStage);

//     // Execute pipeline
//     let catalogues = await Catalouge.aggregate(pipeline);

//     // Format for response
//     catalogues = catalogues.map((cat) => ({
//       ...cat,
//       // Flatten marketplace status for easy access
//       ...cat.marketplaceStatus,
//       // Flatten designer status
//       ...cat.designerStatus,
//       // Flatten catalogue status
//       ...cat.catalogueStatus,
//     }));

//     // Handle CSV export
//     if (format === 'csv') {
//       const csvData = catalogues.map((cat) => ({
//         styleNumber: cat.styleNumber || '',
//         collection_name: cat.collection_name || '',
//         inventory_status: cat.inventory_status || '',
//         status: cat.status || '',
//         createdAt: cat.createdAt || '',
//         updatedAt: cat.updatedAt || '',
//         designerProgressPercentage: cat.designerProgressPercentage || 0,
//         catalogueProgressPercentage: cat.catalogueProgressPercentage || 0,
//         marketplaceProgressPercentage: cat.marketplaceProgressPercentage || 0,
//         overallProgress: cat.overallProgress || 0,

//         // Designer steps
//         stylewise_completed: cat.stylewise ? 'TRUE' : 'FALSE',
//         imageGenerated_completed: cat.imageGenerated ? 'TRUE' : 'FALSE',
//         imageRenamedUploaded_completed: cat.imageRenamedUploaded ? 'TRUE' : 'FALSE',
//         webpUploaded_completed: cat.webpUploaded ? 'TRUE' : 'FALSE',

//         // Catalogue steps
//         skuCreatedOnOms_completed: cat.skuCreatedOnOms ? 'TRUE' : 'FALSE',
//         styleMapped_completed: cat.styleMapped ? 'TRUE' : 'FALSE',
//         inventoryUploaded_completed: cat.inventoryUploaded ? 'TRUE' : 'FALSE',
//         styleLive_completed: cat.styleLive ? 'TRUE' : 'FALSE',

//         // Marketplace steps - ALWAYS include with default FALSE
//         myntra_uploaded: cat.myntra ? 'TRUE' : 'FALSE',
//         nykaa_uploaded: cat.nykaa ? 'TRUE' : 'FALSE',
//         shopify_uploaded: cat.shopify ? 'TRUE' : 'FALSE',
//         tatacliq_uploaded: cat.tatacliq ? 'TRUE' : 'FALSE',
//         ajio_uploaded: cat.ajio ? 'TRUE' : 'FALSE',
//         shoppersstop_uploaded: cat.shoppersstop ? 'TRUE' : 'FALSE',

//         imageGeneratedStatus: cat.designerProgress?.imageGenerated?.completed ? 'TRUE' : 'FALSE',
//         imageGeneratedBy: cat.designerProgress?.imageGenerated?.createdBy || '',
//         imageGeneratedAt: cat.designerProgress?.imageGenerated?.createdAt || '',
//         isImageGeneratedPending:
//           !cat.designerProgress?.imageGenerated?.completed &&
//           cat.designerProgress &&
//           Object.keys(cat.designerProgress).length > 0
//             ? 'TRUE'
//             : 'FALSE',
//         lastActivity: cat.lastActivity || '',
//         lastActivityBy: cat.lastActivityBy || '',
//         lastActivityStep: cat.lastActivityStep || '',
//         activeMarketplaces: cat.activeMarketplaces?.join(',') || '',
//         jobId: cat.jobId || '',
//       }));

//       const json2csvParser = new Parser();
//       const csv = json2csvParser.parse(csvData);

//       res.header('Content-Type', 'text/csv');
//       res.attachment(`catalogue-report-${Date.now()}.csv`);
//       return res.send(csv);
//     }

//     return res.status(200).json(
//       new ApiResponse(
//         200,
//         {
//           count: catalogues.length,
//           totalCount,
//           page: parseInt(page),
//           totalPages: Math.ceil(totalCount / parseInt(limit)),
//           limit: parseInt(limit),
//           results: catalogues,
//         },
//         'Report generated successfully'
//       )
//     );
//   } catch (error) {
//     console.error('Report generation error:', error);
//     return res.status(500).json(new ApiResponse(500, null, 'Failed to generate report'));
//   }
// });

// controllers/report.controller.js (backend)

const report = asyncHandler(async (req, res) => {
  const {
    // Basic Filters
    styleNumber,
    collection_name,
    jobId,

    // Status Filters
    inventory_status,
    status,

    // Date Range Filters
    createdAfter,
    createdBefore,

    // Designer Progress Filters
    stylewise_completed,
    imageGenerated_completed,
    imageRenamedUploaded_completed,
    webpUploaded_completed,

    // Catalogue Progress Filters
    skuCreatedOnOms_completed,
    styleMapped_completed,
    inventoryUploaded_completed,
    styleLive_completed,

    // Marketplace Filters
    myntra_uploaded,
    nykaa_uploaded,
    shopify_uploaded,
    tatacliq_uploaded,
    ajio_uploaded,
    shoppersstop_uploaded,

    // Performer Filters
    progressPerformedBy,

    // Pagination
    limit = 5000,
    page = 1,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    format = 'json',
  } = req.query;

  // Build match stage
  let matchStage = {};

  // Basic Filters
  if (styleNumber) matchStage.styleNumber = Number(styleNumber);
  if (collection_name) matchStage.collection_name = collection_name;
  if (jobId) matchStage.jobId = Number(jobId);
  if (inventory_status) matchStage.inventory_status = inventory_status;
  if (status) matchStage.status = status;

  // Date Filters
  if (createdAfter || createdBefore) {
    matchStage.createdAt = {};
    if (createdAfter) matchStage.createdAt.$gte = new Date(createdAfter);
    if (createdBefore) matchStage.createdAt.$lte = new Date(createdBefore);
  }

  // ============= DESIGNER PROGRESS FILTERS FIX =============
  // Handle completed and pending separately
  const designerFilters = [];

  // Stylewise filter
  if (stylewise_completed !== undefined) {
    if (stylewise_completed === 'true') {
      designerFilters.push({ 'designerProgress.stylewise.completed': true });
    } else if (stylewise_completed === 'false') {
      designerFilters.push({
        $or: [
          { 'designerProgress.stylewise.completed': { $ne: true } },
          { 'designerProgress.stylewise': { $exists: false } },
        ],
      });
    }
  }

  // Image Generated filter - FIXED for pending
  if (imageGenerated_completed !== undefined) {
    if (imageGenerated_completed === 'true') {
      designerFilters.push({ 'designerProgress.imageGenerated.completed': true });
    } else if (imageGenerated_completed === 'false') {
      designerFilters.push({
        $or: [
          { 'designerProgress.imageGenerated.completed': { $ne: true } },
          { 'designerProgress.imageGenerated': { $exists: false } },
        ],
      });
    }
  }

  // Image Renamed filter
  if (imageRenamedUploaded_completed !== undefined) {
    if (imageRenamedUploaded_completed === 'true') {
      designerFilters.push({ 'designerProgress.imageRenamedUploaded.completed': true });
    } else if (imageRenamedUploaded_completed === 'false') {
      designerFilters.push({
        $or: [
          { 'designerProgress.imageRenamedUploaded.completed': { $ne: true } },
          { 'designerProgress.imageRenamedUploaded': { $exists: false } },
        ],
      });
    }
  }

  // WEBP Uploaded filter
  if (webpUploaded_completed !== undefined) {
    if (webpUploaded_completed === 'true') {
      designerFilters.push({ 'designerProgress.webpUploaded.completed': true });
    } else if (webpUploaded_completed === 'false') {
      designerFilters.push({
        $or: [
          { 'designerProgress.webpUploaded.completed': { $ne: true } },
          { 'designerProgress.webpUploaded': { $exists: false } },
        ],
      });
    }
  }

  // Add designer filters to match stage
  if (designerFilters.length > 0) {
    if (matchStage.$and) {
      matchStage.$and.push(...designerFilters);
    } else {
      matchStage.$and = designerFilters;
    }
  }

  // ============= CATALOGUE PROGRESS FILTERS FIX =============
  const catalogueFilters = [];

  // SKU Created filter
  if (skuCreatedOnOms_completed !== undefined) {
    if (skuCreatedOnOms_completed === 'true') {
      catalogueFilters.push({ 'catalogueProgress.skuCreatedOnOms.completed': true });
    } else if (skuCreatedOnOms_completed === 'false') {
      catalogueFilters.push({
        $or: [
          { 'catalogueProgress.skuCreatedOnOms.completed': { $ne: true } },
          { 'catalogueProgress.skuCreatedOnOms': { $exists: false } },
        ],
      });
    }
  }

  // Style Mapped filter
  if (styleMapped_completed !== undefined) {
    if (styleMapped_completed === 'true') {
      catalogueFilters.push({ 'catalogueProgress.styleMapped.completed': true });
    } else if (styleMapped_completed === 'false') {
      catalogueFilters.push({
        $or: [
          { 'catalogueProgress.styleMapped.completed': { $ne: true } },
          { 'catalogueProgress.styleMapped': { $exists: false } },
        ],
      });
    }
  }

  // Inventory Uploaded filter
  if (inventoryUploaded_completed !== undefined) {
    if (inventoryUploaded_completed === 'true') {
      catalogueFilters.push({ 'catalogueProgress.inventoryUploaded.completed': true });
    } else if (inventoryUploaded_completed === 'false') {
      catalogueFilters.push({
        $or: [
          { 'catalogueProgress.inventoryUploaded.completed': { $ne: true } },
          { 'catalogueProgress.inventoryUploaded': { $exists: false } },
        ],
      });
    }
  }

  // Style Live filter
  if (styleLive_completed !== undefined) {
    if (styleLive_completed === 'true') {
      catalogueFilters.push({ 'catalogueProgress.styleLive.completed': true });
    } else if (styleLive_completed === 'false') {
      catalogueFilters.push({
        $or: [
          { 'catalogueProgress.styleLive.completed': { $ne: true } },
          { 'catalogueProgress.styleLive': { $exists: false } },
        ],
      });
    }
  }

  // Add catalogue filters to match stage
  if (catalogueFilters.length > 0) {
    if (matchStage.$and) {
      matchStage.$and.push(...catalogueFilters);
    } else {
      matchStage.$and = catalogueFilters;
    }
  }

  // ============= MARKETPLACE FILTERS =============
  const marketplaceFilters = [];

  const handleMarketplaceFilter = (field, value) => {
    if (value === 'true') {
      return { [`marketplaceUpload.${field}.uploaded`]: true };
    } else if (value === 'false') {
      return {
        $or: [
          { [`marketplaceUpload.${field}.uploaded`]: { $ne: true } },
          { [`marketplaceUpload.${field}`]: { $exists: false } },
        ],
      };
    }
    return null;
  };

  if (myntra_uploaded) {
    const filter = handleMarketplaceFilter('myntra', myntra_uploaded);
    if (filter) marketplaceFilters.push(filter);
  }
  if (nykaa_uploaded) {
    const filter = handleMarketplaceFilter('nykaa', nykaa_uploaded);
    if (filter) marketplaceFilters.push(filter);
  }
  if (shopify_uploaded) {
    const filter = handleMarketplaceFilter('shopify', shopify_uploaded);
    if (filter) marketplaceFilters.push(filter);
  }
  if (tatacliq_uploaded) {
    const filter = handleMarketplaceFilter('tatacliq', tatacliq_uploaded);
    if (filter) marketplaceFilters.push(filter);
  }
  if (ajio_uploaded) {
    const filter = handleMarketplaceFilter('ajio', ajio_uploaded);
    if (filter) marketplaceFilters.push(filter);
  }
  if (shoppersstop_uploaded) {
    const filter = handleMarketplaceFilter('shoppersstop', shoppersstop_uploaded);
    if (filter) marketplaceFilters.push(filter);
  }

  if (marketplaceFilters.length > 0) {
    if (matchStage.$and) {
      matchStage.$and.push(...marketplaceFilters);
    } else {
      matchStage.$and = marketplaceFilters;
    }
  }

  // Performer Filter
  if (progressPerformedBy) {
    const performerFilter = {
      $or: [
        { 'designerProgress.stylewise.createdBy': progressPerformedBy },
        { 'designerProgress.imageGenerated.createdBy': progressPerformedBy },
        { 'designerProgress.imageRenamedUploaded.createdBy': progressPerformedBy },
        { 'designerProgress.webpUploaded.createdBy': progressPerformedBy },
        { 'catalogueProgress.skuCreatedOnOms.createdBy': progressPerformedBy },
        { 'catalogueProgress.styleMapped.createdBy': progressPerformedBy },
        { 'catalogueProgress.inventoryUploaded.createdBy': progressPerformedBy },
        { 'catalogueProgress.styleLive.createdBy': progressPerformedBy },
        { 'marketplaceUpload.myntra.uploadedBy': progressPerformedBy },
        { 'marketplaceUpload.nykaa.uploadedBy': progressPerformedBy },
        { 'marketplaceUpload.shopify.uploadedBy': progressPerformedBy },
        { 'marketplaceUpload.tatacliq.uploadedBy': progressPerformedBy },
        { 'marketplaceUpload.ajio.uploadedBy': progressPerformedBy },
        { 'marketplaceUpload.shoppersstop.uploadedBy': progressPerformedBy },
      ],
    };

    if (matchStage.$and) {
      matchStage.$and.push(performerFilter);
    } else {
      matchStage.$and = [performerFilter];
    }
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortStage = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  try {
    // Build aggregation pipeline
    const pipeline = [
      { $match: matchStage },
      { $sort: sortStage },
      { $skip: skip },
      { $limit: parseInt(limit) },

      // Lookup progress history
      {
        $lookup: {
          from: 'progresshistories',
          localField: '_id',
          foreignField: 'catalogueId',
          as: 'progressHistory',
        },
      },

      // Convert objects to arrays safely
      {
        $addFields: {
          designerProgressArray: {
            $cond: {
              if: { $isArray: { $objectToArray: '$designerProgress' } },
              then: { $objectToArray: '$designerProgress' },
              else: [],
            },
          },
          catalogueProgressArray: {
            $cond: {
              if: { $isArray: { $objectToArray: '$catalogueProgress' } },
              then: { $objectToArray: '$catalogueProgress' },
              else: [],
            },
          },
          marketplaceUploadArray: {
            $cond: {
              if: { $isArray: { $objectToArray: '$marketplaceUpload' } },
              then: { $objectToArray: '$marketplaceUpload' },
              else: [],
            },
          },
        },
      },

      // Add computed fields
      {
        $addFields: {
          // Designer Progress Percentage
          designerProgressPercentage: {
            $cond: {
              if: { $gt: [{ $size: '$designerProgressArray' }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: '$designerProgressArray',
                            as: 'item',
                            cond: '$$item.v.completed',
                          },
                        },
                      },
                      { $size: '$designerProgressArray' },
                    ],
                  },
                  100,
                ],
              },
              else: 0,
            },
          },

          // Catalogue Progress Percentage
          catalogueProgressPercentage: {
            $cond: {
              if: { $gt: [{ $size: '$catalogueProgressArray' }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: '$catalogueProgressArray',
                            as: 'item',
                            cond: '$$item.v.completed',
                          },
                        },
                      },
                      { $size: '$catalogueProgressArray' },
                    ],
                  },
                  100,
                ],
              },
              else: 0,
            },
          },

          // Marketplace Progress Percentage
          marketplaceProgressPercentage: {
            $cond: {
              if: { $gt: [{ $size: '$marketplaceUploadArray' }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: '$marketplaceUploadArray',
                            as: 'item',
                            cond: '$$item.v.uploaded',
                          },
                        },
                      },
                      { $size: '$marketplaceUploadArray' },
                    ],
                  },
                  100,
                ],
              },
              else: 0,
            },
          },

          // Overall Progress
          overallProgress: {
            $let: {
              vars: {
                totalDesigner: { $size: '$designerProgressArray' },
                completedDesigner: {
                  $size: {
                    $filter: {
                      input: '$designerProgressArray',
                      as: 'item',
                      cond: '$$item.v.completed',
                    },
                  },
                },
                totalCatalogue: { $size: '$catalogueProgressArray' },
                completedCatalogue: {
                  $size: {
                    $filter: {
                      input: '$catalogueProgressArray',
                      as: 'item',
                      cond: '$$item.v.completed',
                    },
                  },
                },
                totalMarketplace: { $size: '$marketplaceUploadArray' },
                completedMarketplace: {
                  $size: {
                    $filter: {
                      input: '$marketplaceUploadArray',
                      as: 'item',
                      cond: '$$item.v.uploaded',
                    },
                  },
                },
              },
              in: {
                $cond: {
                  if: {
                    $gt: [
                      { $add: ['$$totalDesigner', '$$totalCatalogue', '$$totalMarketplace'] },
                      0,
                    ],
                  },
                  then: {
                    $multiply: [
                      {
                        $divide: [
                          {
                            $add: [
                              '$$completedDesigner',
                              '$$completedCatalogue',
                              '$$completedMarketplace',
                            ],
                          },
                          {
                            $add: ['$$totalDesigner', '$$totalCatalogue', '$$totalMarketplace'],
                          },
                        ],
                      },
                      100,
                    ],
                  },
                  else: 0,
                },
              },
            },
          },

          // Individual step statuses
          marketplaceStatus: {
            myntra: { $ifNull: ['$marketplaceUpload.myntra.uploaded', false] },
            nykaa: { $ifNull: ['$marketplaceUpload.nykaa.uploaded', false] },
            shopify: { $ifNull: ['$marketplaceUpload.shopify.uploaded', false] },
            tatacliq: { $ifNull: ['$marketplaceUpload.tatacliq.uploaded', false] },
            ajio: { $ifNull: ['$marketplaceUpload.ajio.uploaded', false] },
            shoppersstop: { $ifNull: ['$marketplaceUpload.shoppersstop.uploaded', false] },
          },

          // Designer step statuses
          designerStatus: {
            stylewise: { $ifNull: ['$designerProgress.stylewise.completed', false] },
            imageGenerated: { $ifNull: ['$designerProgress.imageGenerated.completed', false] },
            imageRenamedUploaded: {
              $ifNull: ['$designerProgress.imageRenamedUploaded.completed', false],
            },
            webpUploaded: { $ifNull: ['$designerProgress.webpUploaded.completed', false] },
          },

          // Catalogue step statuses
          catalogueStatus: {
            skuCreatedOnOms: { $ifNull: ['$catalogueProgress.skuCreatedOnOms.completed', false] },
            styleMapped: { $ifNull: ['$catalogueProgress.styleMapped.completed', false] },
            inventoryUploaded: {
              $ifNull: ['$catalogueProgress.inventoryUploaded.completed', false],
            },
            styleLive: { $ifNull: ['$catalogueProgress.styleLive.completed', false] },
          },

          // Active marketplaces
          activeMarketplaces: {
            $map: {
              input: {
                $filter: {
                  input: '$marketplaceUploadArray',
                  as: 'item',
                  cond: '$$item.v.uploaded',
                },
              },
              as: 'item',
              in: '$$item.k',
            },
          },

          // Last activity
          lastActivity: {
            $cond: {
              if: { $gt: [{ $size: '$progressHistory' }, 0] },
              then: { $arrayElemAt: ['$progressHistory.performedAt', -1] },
              else: '$updatedAt',
            },
          },
          lastActivityBy: {
            $cond: {
              if: { $gt: [{ $size: '$progressHistory' }, 0] },
              then: { $arrayElemAt: ['$progressHistory.performedBy', -1] },
              else: null,
            },
          },
          lastActivityStep: {
            $cond: {
              if: { $gt: [{ $size: '$progressHistory' }, 0] },
              then: { $arrayElemAt: ['$progressHistory.step', -1] },
              else: null,
            },
          },
        },
      },

      // Remove temporary arrays
      {
        $project: {
          designerProgressArray: 0,
          catalogueProgressArray: 0,
          marketplaceUploadArray: 0,
        },
      },
    ];

    // Get total count
    const totalCount = await Catalouge.countDocuments(matchStage);

    // Execute pipeline
    let catalogues = await Catalouge.aggregate(pipeline);

    // Format for response
    catalogues = catalogues.map((cat) => ({
      ...cat,
      // Flatten marketplace status for easy access
      ...cat.marketplaceStatus,
      // Flatten designer status
      ...cat.designerStatus,
      // Flatten catalogue status
      ...cat.catalogueStatus,
    }));

    // Handle CSV export
    if (format === 'csv') {
      const csvData = catalogues.map((cat) => ({
        styleNumber: cat.styleNumber || '',
        collection_name: cat.collection_name || '',
        inventory_status: cat.inventory_status || '',
        status: cat.status || '',
        createdAt: cat.createdAt || '',
        updatedAt: cat.updatedAt || '',
        designerProgressPercentage: cat.designerProgressPercentage || 0,
        catalogueProgressPercentage: cat.catalogueProgressPercentage || 0,
        marketplaceProgressPercentage: cat.marketplaceProgressPercentage || 0,
        overallProgress: cat.overallProgress || 0,

        // Designer steps
        stylewise_completed: cat.stylewise ? 'TRUE' : 'FALSE',
        imageGenerated_completed: cat.imageGenerated ? 'TRUE' : 'FALSE',
        imageRenamedUploaded_completed: cat.imageRenamedUploaded ? 'TRUE' : 'FALSE',
        webpUploaded_completed: cat.webpUploaded ? 'TRUE' : 'FALSE',

        // Catalogue steps
        skuCreatedOnOms_completed: cat.skuCreatedOnOms ? 'TRUE' : 'FALSE',
        styleMapped_completed: cat.styleMapped ? 'TRUE' : 'FALSE',
        inventoryUploaded_completed: cat.inventoryUploaded ? 'TRUE' : 'FALSE',
        styleLive_completed: cat.styleLive ? 'TRUE' : 'FALSE',

        // Marketplace steps
        myntra_uploaded: cat.myntra ? 'TRUE' : 'FALSE',
        nykaa_uploaded: cat.nykaa ? 'TRUE' : 'FALSE',
        shopify_uploaded: cat.shopify ? 'TRUE' : 'FALSE',
        tatacliq_uploaded: cat.tatacliq ? 'TRUE' : 'FALSE',
        ajio_uploaded: cat.ajio ? 'TRUE' : 'FALSE',
        shoppersstop_uploaded: cat.shoppersstop ? 'TRUE' : 'FALSE',

        imageGeneratedStatus: cat.designerProgress?.imageGenerated?.completed ? 'TRUE' : 'FALSE',
        imageGeneratedBy: cat.designerProgress?.imageGenerated?.createdBy || '',
        imageGeneratedAt: cat.designerProgress?.imageGenerated?.createdAt || '',
        isImageGeneratedPending:
          !cat.designerProgress?.imageGenerated?.completed &&
          cat.designerProgress &&
          Object.keys(cat.designerProgress).length > 0
            ? 'TRUE'
            : 'FALSE',
        lastActivity: cat.lastActivity || '',
        lastActivityBy: cat.lastActivityBy || '',
        lastActivityStep: cat.lastActivityStep || '',
        activeMarketplaces: cat.activeMarketplaces?.join(',') || '',
        jobId: cat.jobId || '',
      }));

      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(csvData);

      res.header('Content-Type', 'text/csv');
      res.attachment(`catalogue-report-${Date.now()}.csv`);
      return res.send(csv);
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          count: catalogues.length,
          totalCount,
          page: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          limit: parseInt(limit),
          results: catalogues,
        },
        'Report generated successfully'
      )
    );
  } catch (error) {
    console.error('Report generation error:', error);
    return res.status(500).json(new ApiResponse(500, null, 'Failed to generate report'));
  }
});

export { upsertCatalogueProgress, getCatalouges, report };
