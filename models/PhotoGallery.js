import mongoose from 'mongoose';

const photoGallerySchema = new mongoose.Schema({
  villaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Villa', required: true },
  images: [{ type: String, required: true }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('PhotoGallery', photoGallerySchema);
