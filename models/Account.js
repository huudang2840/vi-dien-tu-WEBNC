const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const Account = new Schema({
  phone: { type: "string", unique: true },
  email: { type: "string", unique: true },
  name: { type: "string" },
  birthday: { type: "date" },
  address: { type: "string" },
  front_IDcard: { type: "string" },
  back_IDcard: { type: "string" },
  username: { type: "string" },
  password: { type: "string" },
  firstLogin: { type: "boolean", default: true },
  verifyAccount: { type: "String", default: "waiting" },
  countLogin: { type: Number, default: 0 },
  lockAccount: { type: Boolean, default: false },
  safeAccount: { type: Boolean, default: true },
  token: { type: "string" },
  update_at: { type: Date, default: Date.now() },
});

module.exports = mongoose.model("Account", Account);
