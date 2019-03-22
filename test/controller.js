/**
 * Created by dman on 18/06/2017.
 */
'use strict'
const express = require('express')
const router = express()
const middleware = require('./../index').loggerExpress
const Logger = require('../index').logger
const logger = new Logger({useUuid4AsTraceId: true, logzioOpts: {token: 'testLogzioToken'}})

router.use(middleware(logger, { setSpringCloudSleuthHeaders: true }))
router.get('/hello', function (req, res) {
  logger.info('received hello request')
  res.send('world')
})

router.get('/upper/:word', function (req, res) {
  logger.warn('received upper case request')
  res.send(req.params.word.toUpperCase())
})

router.get('/event/new_event', function (req, res) {
  const newEvent = 'NEW_EVENT'
  logger.warn({event: newEvent}, 'should set event to %s', newEvent)
  res.send('changed the event to a new event')
})

router.get('/event/original', function (req, res) {
  logger.warn('The event should be the same as the original that was sent i the X-Event header')
  res.send('should return original event')
})

module.exports = router
