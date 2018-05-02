import * as mongoose from 'mongoose'

// single database
export default mongoose.createConnection('mongodb://passworddataOnwer:hell0w0rld@localhost:27017/passworddata', {
  config: { autoIndex: false }
})

