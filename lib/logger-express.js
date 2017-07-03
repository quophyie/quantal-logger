/**
 * Created by dman on 16/06/2017.
 */
'use strict'
const Logger = require('./logger')
const Errors = require('quantal-errors')
const uuidv4 = require('uuid/v4')

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
      const startTime = Date.now()
      mdc.bindEmitter(req)
      mdc.bindEmitter(res)

      if (mdc) {
        mdc.run(() => {
          if (!mdc.get('traceId')) {
            const traceId = uuidv4()
            mdc.set('traceId', traceId)

            logger.info({req}, 'request received')

            res.on('finish', () => afterResponse(res, logger, startTime))
            res.on('close', (req, res) => afterResponse(res, logger, startTime))
            res.header('X-TraceId', traceId)
          // the next function must be called after all operations on the continuation local storage have been performed
            next()
          } else {
            next()
          }
        })
      } else {
        next()
      }
    }
  })
}
