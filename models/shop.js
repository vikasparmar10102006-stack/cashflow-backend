import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
});

const shopSchema = new mongoose.Schema({
  shopName: {
    type: String,
    required: true,
    trim: true,
  },
  shopDescription: {
    type: String,
    required: false,
    trim: true,
  },
  location: {
    type: locationSchema,
    required: true,
  },
  // We can add a reference to the user who created the shop later
  // owner: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'User',
  //   required: true,
  // },
}, { timestamps: true });

// Check if the model already exists before defining it
const Shop = mongoose.models.Shop || mongoose.model('Shop', shopSchema);

export default Shop;
