/**
 * Created by dman on 16/06/2017.
 */
'use strict'
const Logger = require('./logger')
const Errors = require('quantal-errors')
const Events = require('./events')

const xtraceIdHeaderKey = 'X-TraceId'
const traceIdMdcKey = 'traceId'
const eventMdcKey = 'event'
const springCloudSleuthTraceIdHeaderKey = 'X-B3-TraceId'
const EVENT_HEADER_KEY = 'X-Event'
const interceptor = require('express-interceptor')
const compose = require('compose-middleware').compose
let _logger = null
const eventHeaderInterceptor = interceptor((req, res, next) => {
  const mdc = _logger.getMdc()
  if (mdc) {
    mdc.bindEmitter(req)
    mdc.bindEmitter(res)
    return mdc.runAndReturn(() => {
      return {

        // Only HTML responses will be intercepted
        isInterceptable: () => true,
        intercept: (body, send) => {
          const _currMdc = res._logger.getMdc()
          const event = _currMdc.get(eventMdcKey)
          res.setHeader(EVENT_HEADER_KEY, event)
          send(body)
        }
      }
    })
  } else {
    return {

      // Only HTML responses will be intercepted
      isInterceptable: () => false,
      intercept: (body, send) => {
        next()
      }
    }
  }
})

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
const loggerMiddleware = (logger, options) => {
  _logger = logger
  if (!(logger instanceof Logger)) {
    throw new Errors.NullReferenceError('Logger instance cannot be null')
  }
  const mdc = logger.getMdc()
  logger._init()

  if (mdc) {
    return mdc.runAndReturn(() => {
      return (req, res, next) => {
        let traceId = req.headers[xtraceIdHeaderKey] || req.headers[xtraceIdHeaderKey.toLowerCase()]
        let event = req.headers[EVENT_HEADER_KEY] || req.headers[EVENT_HEADER_KEY.toLowerCase()]
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
            } else {
              mdc.set(traceIdMdcKey, traceId || mdc.get(traceIdMdcKey))
            }

            if (event) {
              mdc.set(eventMdcKey, event)
              logger.info({req, event: Events.REQUEST_RECEIVED}, 'request received')
              logger.info({req, event: event}, 'progressing %s', event)
            } else {
              mdc.set(eventMdcKey, event || mdc.get(eventMdcKey))
              logger.info({req, event: Events.REQUEST_RECEIVED}, 'request received')
            }

            res.on('close', (req, res) => afterResponse(res, logger, startTime))
            res.on('finish', () => afterResponse(res, logger, startTime))
            res.header(xtraceIdHeaderKey, traceId)
            res._logger = logger
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
  } else {
    return (req, res, next) => next()
  }
}

module.exports = (logger, options) => compose([
  loggerMiddleware(logger, options),
  eventHeaderInterceptor
])
