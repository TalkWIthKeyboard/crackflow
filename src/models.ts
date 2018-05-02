import * as _ from 'lodash'
import db from './modules/mongo'
import { Schema, Model } from 'mongoose'

const schemas = {
  NoUserInfoPassword: new Schema({
    password: { type: String, required: true },
    number: { type: Number, required: true },
    source: { type: String, enum: ['phpbb', 'rock'], required: true },
  }, { collection: 'NoUserInfoPassword' }),

  UserInfoPassword: new Schema({
    source: { type: String, required: true },
    password: { type: String, required: true },
    username: { type: String, default: '' },
    email: { type: String, default: '' },
    name: { type: String, default: '' },
    birthday: { type: String, default: '' },
    mobile: { type: String, default: '' },
    namePinyin: [String],
    nameFirstLetter: { type: String, default: '' }
  }, { collection: 'UserInfoPassword' }),

  Statistic: new Schema({
    source: { type: String, required: true },
    count: { type: Number, required: true },
    type: { type: String, required: true },
  }, { collection: 'Statistic' }),

  Unit: new Schema({
    source: { type: String, require: true },
    password: { type: String, required: true },
    namePinyin: String,
    nameFirstLetter: String,
    mobile: String,
    mobileLastSix: String,
    mobileLastFour: String,
    birthday: String,
    birthdayLastSix: String,
    birthdayLastFour: String,
    qq: String,
    usernameNumberFragment: [String],
    usernameStringFragment: [String],
    emailNumberFragment: [String],
    emailStringFragment: [String],
  }, { collection: 'Unit' })
}

schemas.NoUserInfoPassword.index({ source: 1 })
schemas.UserInfoPassword.index({ source: 1 })
schemas.Unit.index({ source: 1 })

export default {
  NoUserInfoPassword: db.model('NoUserInfoPassword', schemas.NoUserInfoPassword),
  UserInfoPassword: db.model('UserInfoPassword', schemas.UserInfoPassword),
  Statistic: db.model('Statistic', schemas.Statistic),
  Unit: db.model('Unit', schemas.Unit),
}

