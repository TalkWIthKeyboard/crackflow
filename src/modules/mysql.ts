import * as mysql from 'mysql'
import * as config from 'config'

const connect = mysql.createConnection(config.get('mysqlUri'))

connect.connect()

export default function (sql) {
  return new Promise((resolve, reject) => {
    connect.query(sql, (err, result) => {
      err ? reject(err) : resolve(result)
    })
  })
}
