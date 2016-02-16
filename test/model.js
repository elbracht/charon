var mongoose       = require('mongoose');
var mongooseUnique = require('mongoose-unique-validator');
 
var userSchema = mongoose.Schema({
    username:    { type: String, required: true, unique: true },
    email:       { type: String, required: true, unique: true },
    password:    { type: String, required: true },
    resetToken:  { type: String },
    resetExpire: { type: Date }
});
 
userSchema.plugin(mongooseUnique);
 
module.exports = mongoose.model('User', userSchema);