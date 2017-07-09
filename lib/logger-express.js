/**
 * Created by dman on 16/06/2017.
 */
'use strict'
const Logger = require('./logger')
const Errors = require('quantal-errors')
const uuidv4 = require('uuid/v4')
const xtraceIdHeaderKey = 'X-TraceId'
const traceIdMdcKey = 'traceId'

const afterResponse = (res, logger, startTime) => {
  const responseTime = Date.now() - startTime
  if (res) {
    res.responseTime = responseTime
    logger.info({res}, 'response sent successfully %s')
  } else {
    logger.info({responseTime}, 'response sent successfully %s')
  }
}

module.exports = (logger) => {
  if (!(logger instanceof Logger)) { throw new Errors.NullReferenceError('Logger instance cannot be null') }
  const mdc = logger.getMdc()
  logger._init()

  return mdc.runAndReturn(() => {
    return (req, res, next) => {
      let traceId = req.headers[xtraceIdHeaderKey] || req.headers[xtraceIdHeaderKey.toLowerCase()]
      const startTime = Date.now()
      mdc.bindEmitter(req)
      mdc.bindEmitter(res)

      if (mdc) {
        mdc.run(() => {
          if (!traceId && !mdc.get(traceIdMdcKey)) {
            traceId = uuidv4()
            mdc.set(traceIdMdcKey, traceId)
            logger.info({req}, 'request received')
          } else {
            mdc.set(traceIdMdcKey, traceId || mdc.get(traceIdMdcKey))
          }

          res.on('close', (req, res) => afterResponse(res, logger, startTime))
          res.on('finish', () => afterResponse(res, logger, startTime))
          res.header(xtraceIdHeaderKey, traceId)
          // the next function must be called after all operations on the continuation local storage have been performed
          next()
        })
      } else {
        next()
      }
    }
  })
}
