import { Pattern } from '../models/pattern.model.js';

const bulkSyncPatterns = async (patternsData) => {
  if (!Array.isArray(patternsData)) {
    throw new Error('Invalid data');
  }

  if (patternsData.length === 0) return [];

  // Prepare bulk operations
  const bulkOps = patternsData.map(({ style_number, pattern_number }) => {
    const sizesArray = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'].map((s) => ({
      name: s,
    }));

    return {
      updateOne: {
        filter: { style_number, pattern_number },
        update: { $setOnInsert: { sizes: sizesArray } },
        upsert: true, // Only insert if not exists
      },
    };
  });

  const result = await Pattern.bulkWrite(bulkOps);

  return result;
};

// const getPatterns = async (query) => {
//   let { page = 1, limit = 10, style_number, pattern_number } = query;
//   page = parseInt(page);
//   limit = parseInt(limit);

//   const filter = {};
//   if (style_number) filter.style_number = style_number;
//   if (pattern_number) filter.pattern_number = { $regex: pattern_number, $options: 'i' };

//   const total = await Pattern.countDocuments(filter);

//   const patterns = await Pattern.find(filter)
//     .skip((page - 1) * limit)
//     .limit(limit)
//     .sort({ style_number: 1, pattern_number: 1 });

//   return {
//     patterns,
//     page,
//     limit,
//     total,
//     totalPages: Math.ceil(total / limit),
//   };
// };

const getPatterns = async (query) => {
  let { page = 1, limit = 10, style_number, pattern_number } = query;
  page = parseInt(page);
  limit = parseInt(limit);

  const filter = {};

  if (style_number) {
    filter.style_number = { $regex: style_number, $options: 'i' };
  }

  if (pattern_number) {
    filter.pattern_number = pattern_number;
  }

  const total = await Pattern.countDocuments(filter);

  const patterns = await Pattern.find(filter)
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ style_number: 1, pattern_number: 1 });

  return {
    patterns,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

const updatePatternByNumber = async (pattern_number, sizesToUpdate) => {
  // Find ALL patterns with the same pattern_number
  const patterns = await Pattern.find({ pattern_number });

  if (!patterns || patterns.length === 0) {
    throw new ApiError('Pattern not found', 404);
  }

  if (!Array.isArray(sizesToUpdate) || !sizesToUpdate.length) {
    throw new ApiError('No sizes provided to update', 400);
  }

  // Create bulk update operations
  const bulkOps = patterns.map((pattern) => {
    const updatedSizes = pattern.sizes.map((size) => {
      const sizeUpdate = sizesToUpdate.find((s) => s.name === size.name);
      if (sizeUpdate) {
        return { ...size.toObject(), completed: sizeUpdate.completed };
      }
      return size;
    });

    return {
      updateOne: {
        filter: { _id: pattern._id },
        update: { $set: { sizes: updatedSizes } },
      },
    };
  });

  // Execute bulk update
  await Pattern.bulkWrite(bulkOps);

  // Fetch updated patterns
  const updatedPatterns = await Pattern.find({ pattern_number });

  return updatedPatterns.length === 1 ? updatedPatterns[0] : updatedPatterns;
};

export { bulkSyncPatterns, getPatterns, updatePatternByNumber };
