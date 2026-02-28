import mongoose from 'mongoose';
import { Job } from '../models/jobId.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const createJob = asyncHandler(async (req, res) => {
  const { jobId, collection_name, createdBy } = req.body;
  if (!jobId || !collection_name || !createdBy) {
    throw new ApiError(400, 'All fields are required');
  }

  const isJobIdExist = await Job.findOne({ jobId });
  if (isJobIdExist) {
    throw new ApiError(400, 'This job already created');
  }
  const createdJob = await Job.create({
    jobId,
    collection_name,
    createdBy,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, createdJob, `Jobid created for ${jobId} successfully. `));
});

const getJobIds = asyncHandler(async (req, res) => {
  let { jobId, cursor, limit, collection_name } = req.query;
  limit = Number(limit) || 10;
  const query = {};

  // Exact match for jobId
  if (jobId) {
    query.jobId = isNaN(jobId) ? jobId : Number(jobId);
  }

  // Partial search for collection_name
  if (collection_name) {
    query.collection_name = {
      $regex: collection_name,
      $options: 'i',
    };
  }

  // Handle cursor for pagination
  if (cursor) {
    try {
      // Check if cursor is a valid ObjectId
      const isValid = mongoose.Types.ObjectId.isValid(cursor);
      if (!isValid) {
        console.log('Invalid cursor format:', cursor);
        return res.status(400).json(new ApiResponse(400, null, 'Invalid cursor format'));
      }

      // Convert cursor string to ObjectId
      const cursorObj = new mongoose.Types.ObjectId(cursor);
      query._id = { $lt: cursorObj };
      console.log('Cursor query:', query._id); // Debug log
    } catch (error) {
      console.log('Cursor processing error:', error);
      return res.status(400).json(new ApiResponse(400, null, 'Error processing cursor'));
    }
  }

  try {
    const results = await Job.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1);

    console.log(`Found ${results.length} results`); // Debug log

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
        'Job ids fetched successfully'
      )
    );
  } catch (error) {
    console.log('Database error:', error);
    return res.status(500).json(new ApiResponse(500, null, 'Error fetching jobs'));
  }
});

export { createJob, getJobIds };
