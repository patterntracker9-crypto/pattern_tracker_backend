import mongoose, { Schema } from 'mongoose';

const marketPlaceSchema = new Schema(
  {
    channel: {
      type: String,
      required: true,
      trim: true,
    },
    product_id: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      default: 'active',
    },
  },
  { _id: false }
);

const styleSchema = new Schema(
  {
    styleNumber: {
      type: Number,
      required: true,
    },

    marketPlaceDetails: {
      type: [marketPlaceSchema],
      default: [],
    },
  },
  { timestamps: true }
);

const Style = mongoose.model('Style', styleSchema);
export default Style;
