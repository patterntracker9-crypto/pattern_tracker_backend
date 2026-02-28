import mongoose from 'mongoose';
const jobIdSchema = new mongoose.Schema(
  {
    jobId: {
      type: Number,
      required: true,
      unique: true,
    },
    collection_name: {
      type: String,
      required: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Job = mongoose.model('Job', jobIdSchema);
export { Job };
