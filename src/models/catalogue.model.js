import mongoose from 'mongoose';

const progressSchema = new mongoose.Schema(
  {
    completed: { type: Boolean, default: false },
    createdAt: Date,
    createdBy: String,
  },
  { _id: false }
);

const catalogueSchema = new mongoose.Schema(
  {
    styleNumber: { type: Number, required: true, unique: true },

    designerProgress: {
      stylewise: progressSchema,
      imageGenerated: progressSchema,
      imageRenamedUploaded: progressSchema,
      webpUploaded: progressSchema,
    },

    catalogueProgress: {
      skuCreatedOnOms: progressSchema,
      styleMapped: progressSchema,
      inventoryUploaded: progressSchema,
      styleLive: progressSchema,
    },

    marketplaceUpload: {
      myntra: { uploaded: Boolean, uploadedAt: Date },
      nykaa: { uploaded: Boolean, uploadedAt: Date },
      shopify: { uploaded: Boolean, uploadedAt: Date },
      tatacliq: { uploaded: Boolean, uploadedAt: Date },
      ajio: { uploaded: Boolean, uploadedAt: Date },
      shoppersstop: { uploaded: Boolean, uploadedAt: Date },
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'inactive',
    },
    inventory_status: {
      type: String,
      enum: ['zero', 'live'],
      default: 'live',
    },
    jobId: {
      type: Number,
      // default: 12345,
      required: true,
    },
    collection_name: {
      type: String,
      // default: 'Casual',
      required: true,
    },
  },
  { timestamps: true }
);

const Catalouge = mongoose.model('Catalouge', catalogueSchema);
export { Catalouge };
