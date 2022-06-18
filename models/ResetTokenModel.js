const mongoose = require('mongoose')
const Schema = mongoose.Schema


const resetTokenScheme = new Schema({
    email: { type: String, required: true },
    token: { type: String, required: true },
    create_at: { type: Date, default: Date.now(), expires : 60}
})

module.exports = mongoose.model('resetTokens', resetTokenScheme)