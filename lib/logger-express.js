/**
 * Created by dman on 16/06/2017.
 */
'use strict'
const Logger = require('./logger')
const Errors = require('quantal-errors')
const Events = require('quantal-nodejs-shared').events

const xtraceIdHeaderKey = 'X-TraceId'
const traceIdMdcKey = 'traceId'
const springCloudSleuthTraceIdHeaderKey = 'X-B3-TraceId'

const afterResponse = (res, logger, startTime) => {
  const responseTime = Date.now() - startTime
  if (res) {
    res.responseTime = responseTime
    logger.info({res, event: Events.RESPONSE_SENT}, 'response sent successfully %s')
  } else {
    logger.info({responseTime, event: Events.RESPONSE_SENT}, 'response sent successfully %s')
  }
}

/**
 *
 * @param logger
 * @param {object} options
 * @param {boolean} options.setSpringCloudSleuthHeaders - set to true if the spring cloud sleuth headers are to be set
 */
module.exports = (logger, options) => {
  if (!(logger instanceof Logger)) { throw new Errors.NullReferenceError('Logger instance cannot be null') }
  const mdc = logger.getMdc()
  logger._init()

  return mdc.runAndReturn(() => {
    return (req, res, next) => {
      let traceId = req.headers[xtraceIdHeaderKey] || req.headers[xtraceIdHeaderKey.toLowerCase()]
      let springCloudSleuthTraceId = req.headers[springCloudSleuthTraceIdHeaderKey] || req.headers[springCloudSleuthTraceIdHeaderKey.toLowerCase()]
      const bSetSpringCloudSleuthHeaders = !!((options && options.setSpringCloudSleuthHeaders))

      const startTime = Date.now()
      mdc.bindEmitter(req)
      mdc.bindEmitter(res)

      if (mdc) {
        mdc.run(() => {
          if (!traceId && !mdc.get(traceIdMdcKey)) {
            traceId = logger.generateTraceId()
            mdc.set(traceIdMdcKey, traceId)
            logger.info({req, event: Events.REQUEST_RECEIVED}, 'request received')
          } else {
            mdc.set(traceIdMdcKey, traceId || mdc.get(traceIdMdcKey))
          }

          res.on('close', (req, res) => afterResponse(res, logger, startTime))
          res.on('finish', () => afterResponse(res, logger, startTime))
          res.header(xtraceIdHeaderKey, traceId)
          if (bSetSpringCloudSleuthHeaders) {
            if (springCloudSleuthTraceId) {
              res.header(springCloudSleuthTraceIdHeaderKey, springCloudSleuthTraceId)
            } else {
              res.header(springCloudSleuthTraceIdHeaderKey, traceId)
            }
          }
          // the next function must be called after all operations on the continuation local storage have been performed
          next()
        })
      } else {
        next()
      }
    }
  })
}
