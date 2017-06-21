/**
 * Created by dman on 18/06/2017.
 */
'use strict'
const express = require('express')
const router = express()
const middleware = require('./../index').loggerExpress
const Logger = require('../index').logger
const logger = new Logger()

router.use(middleware(logger))
router.get('/hello', function (req, res) {
  res.send('world')
})

router.get('/upper/:word', function (req, res) {
  res.send(req.params.word.toUpperCase())
})

module.exports = router
