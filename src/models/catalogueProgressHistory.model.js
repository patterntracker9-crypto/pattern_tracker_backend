import mongoose from 'mongoose';

const progressHistorySchema = new mongoose.Schema(
  {
    catalogueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Catalouge',
      required: true,
      index: true,
    },

    section: String, // designerProgress | catalogueProgress
    step: String, // imageGenerated | styleLive
    action: String, // updated | reverted
    performedBy: String,

    performedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false }
);

export const ProgressHistory = mongoose.model('ProgressHistory', progressHistorySchema);
