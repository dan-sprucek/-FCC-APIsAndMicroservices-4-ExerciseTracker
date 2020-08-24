const express = require('express')
const app = express()
const bodyParser = require('body-parser')
require('dotenv').config()
var uniqueValidator = require('mongoose-unique-validator');

const cors = require('cors')

const mongoose = require('mongoose')

const url = process.env.DB_URI

mongoose.connect(url || 'mongodb://localhost/exercise-track', { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true, useFindAndModify: false })

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  count: {
    type: Number,
    default: 0
  },
  log: [{
    description: {
      type: String,
      required: true
    },
    duration: {
      type: Number,
      required: true
    },
    date: String,
    _id: false
  }]

}, { versionKey: false })
userSchema.plugin(uniqueValidator);

const User = mongoose.model('User', userSchema)

app.post('/api/exercise/new-user', (req, res, next) => {
  const body = req.body

  const user = new User({
    username: body.username
  })

  user
    .save()
    .then(user => {
      res.json({
        username: user.username,
        _id: user._id
      })
    })
    .catch(err => next(err))
})

app.get('/api/exercise/users', (req, res, next) => {
  User
    .find({})
    .select('username _id')
    .then(users => {
      res.json(users)
    })
    .catch(err => next(err))
  })

app.post('/api/exercise/add', (req, res, next) => {
  const body = req.body
  let dateOfExercise
  if (body.date) {
    dateOfExercise = new Date(body.date).toDateString()
  } else {
    dateOfExercise = new Date().toDateString()
  }

  User
    .findByIdAndUpdate(body.userId, {
      $inc: {'count': 1},
      $push: {'log': {
        description: body.description,
        duration: body.duration,
        date: dateOfExercise
      }}
    }, {new: true, runValidators: true})
    .then(user => {
      res.json({
        _id: user._id,
        username: user.username,
        date: dateOfExercise,
        duration: parseInt(body.duration),
        description: body.description
      })
    })
    .catch(err => next(err))
})


app.get('/api/exercise/log', (req, res, next) => {
  const query = req.query
  User
    .findById(query.userId)
    .then(user => {
      let logs = user.log
      if (query.from) {
        let dateFrom = new Date(query.from).getTime()
        logs = logs.filter(log => new Date(log.date).getTime() >= dateFrom)
      }
      if (query.to) {
        let dateTo = new Date(query.to).getTime()
        logs = logs.filter(log => new Date(log.date).getTime() <= dateTo)
      }
      if (query.limit) {
        logs = logs.slice(0,query.limit)
      }
      let counts = logs.length
      res.json({
        _id: user._id,
        username: user.username,
        count: counts,
        log: logs
      })
    })
    .catch(err => next(err))
})


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
