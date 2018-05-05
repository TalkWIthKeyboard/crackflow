import * as mongoose from 'mongoose'
import * as config from 'config'

// single database
export default mongoose.createConnection(config.get('mongoUri'), {
  config: { autoIndex: false },
})
