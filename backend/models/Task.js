import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  text: { type: String, required: true, maxlength: 120 },
  done: { type: Boolean, default: false },
  doneAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

taskSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model("Task", taskSchema);
