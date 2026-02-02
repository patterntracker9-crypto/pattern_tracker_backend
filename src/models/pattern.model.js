import mongoose from 'mongoose';

const patternSchema = mongoose.Schema({
  style_number: {
    type: Number,
    required: true,
  },
  pattern_number: {
    type: String,
    required: true,
  },
  sizes: [
    {
      name: String,
      completed: { type: Boolean, default: false },
    },
  ],
});

const Pattern = mongoose.model('Pattern', patternSchema);
export { Pattern };
