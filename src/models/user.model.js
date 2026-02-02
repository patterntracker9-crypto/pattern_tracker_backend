import mongoose from 'mongoose';
const userSchema = mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  refreshToken: {
    type: String,
  },
  role: {
    type: String,
    default: 'user',
  },
});

const User = mongoose.model('User', userSchema);
export { User };
