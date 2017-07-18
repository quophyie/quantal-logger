'use strict'
/**
 * Created by dman on 16/06/2017.
 */

const cls = require('continuation-local-storage')
const Errors = require('quantal-errors')
const _ = require('lodash')
const appModuleRoot = require('app-root-path')
const packageJson = appModuleRoot.require('/package.json')
const uuidv4 = require('uuid/v4')
const Bluebird = require('bluebird')
const clsBluebird = require('cls-bluebird')
const EventEmitter = require('events').EventEmitter
const bunyanStdSerializers = require('bunyan').stdSerializers
const randomstring = require('randomstring')

const _keyTraceId = 'traceId'

// Private methods
const createLogData = (mdc, customData) => {
  const traceId = mdc.get(_keyTraceId)
  let data = {}
  if (traceId) { data = {traceId} }
  let stringCnt = 0, numCnt = 0, arrCnt = 0

  for (const item of customData) {
    if (item instanceof Array) {
      data[`array${++arrCnt}`] = item
    } else if (item instanceof Object) {
      _.assign(data, item)
    } else if (typeof (item) === 'number') {
      data[`number${++numCnt}`] = item
    } else if (typeof (item) === 'string') {
      data[`string${++stringCnt}`] = item
    }
  }

  return data
}

/**
 * Checks and sets the traceId in rhe continuation local storage
 * @param {continuation-local-storage} mdc - An instance of the continuation logger class
 * @param {QuantBeat} logger - instance of quant beat class i.e. quant logger
 */
const checkAndSetTraceId = (mdc, logger) => {
  if (logger._mainMethodCalled === true && mdc && !mdc.get(_keyTraceId)) {
    const traceId = logger.generateTraceId()
    mdc.set('traceId', traceId)
  }
}

/**
 * Extract message, data and message tokens from args argument
 * @param args
 * @param mdc
 * @returns {{msg: null, data: {}, msgTokens: string}}
 */
const extractArgs = (args, mdc) => {
  let result = {
    msg: null,
    data: {},
    msgTokens: ''
  }

  if (args.length === 2) {
    [result.data, result.msg] = args
  } else if (args.length > 2) {
    [result.data, result.msg, ...result.msgTokens] = args
  } else { [result.msg] = args }

  const traceId = mdc.get(_keyTraceId)
  if (traceId) { result.data.traceId = traceId }
  return result
}

/**
 * A request serializer for bunyan
 * @param req - the request object
 * @returns {{method, url, headers, remoteAddress, remotePort}}
 */
const requestSerializer = (req) => {
  let serializedReq = bunyanStdSerializers.req(req)
  if (!serializedReq) { serializedReq = {} }
  const mergeData = {
    url: req.url,
    method: req.method,
    protocol: req.protocol,
      // In case there's a proxy server
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    headers: req.headers
  }
  serializedReq = _.merge(serializedReq, mergeData)
  return serializedReq
}

/**
 * Adds the traceId to the object to be serialized by bunyan
 * @param {object} data - the object that will contain the traceId prop
 * @param mdc
 * @returns {*}
 */
const addTraceIdToSerializerObject = (data, mdc) => {
  const traceId = mdc.get(_keyTraceId)
  if (traceId) {
    if (data) {
      data.traceId = traceId
    } else {
      data = {traceId}
    }
  }

  return data
}

/**
 * The bunyan serializer for respose
 * @param {Response} res - The response object objecr
 * @returns {{statusCode, header}}
 */
const responseSerializer = (res) => {
  let serializedRes = bunyanStdSerializers.res(res)
  const mergeData = {
    header: res.header,
    headers: res._header,
    responseTime: res.responseTime,
    statusCode: res.statusCode,
    statusMessage: res.statusMessage

  }
  serializedRes = _.merge(serializedRes, mergeData)

  return serializedRes
}

class Logger extends EventEmitter {
  constructor (options) {
    super()
    let curatedOpts = Object.assign({}, options)
    if (!curatedOpts.serializers) {
      curatedOpts.serializers = {}
      curatedOpts.serializers.err = bunyanStdSerializers.err
      curatedOpts.serializers.res = responseSerializer
      curatedOpts.serializers.req = requestSerializer
    } else {
      if (!curatedOpts.serializers.err) {
        curatedOpts.serializers.err = bunyanStdSerializers.err
      } else if (!curatedOpts.serializers.res) {
        curatedOpts.serializers.res = bunyanStdSerializers.res
      } else if (!curatedOpts.serializers.req) {
        curatedOpts.serializers.req = bunyanStdSerializers.req
      }
    }

    curatedOpts.name = curatedOpts.name || packageJson.name
    require('lugg').init(curatedOpts)

    let opts = _.omit(options, ['mdcNamespace'])
    const appName = (options && options.name) ? options.name : packageJson.name
    const _logger = require('lugg')(appName, opts)
    const mdcNamespace = (options && options.mdcNamespace) ? options.mdcNamespace : packageJson.name
    this.useUuidAsTraceId = !!((options !== undefined && options !== null && options.useUuidAsTraceId))

    if (!mdcNamespace) {
      const illegalArgError = new Errors.IllegalArgumentError('options.mdcNamespace is required')
      _logger.error(illegalArgError)
      throw illegalArgError
    }

    this._logger = _logger
    const _mdc = cls.createNamespace(mdcNamespace)
    this.mdc = _mdc

    clsBluebird(this.mdc)
    this._mainMethod = options ? options.mainMethod : null

    this.on('LOGGER_INITIALISED', () => {
      process.nextTick(() => {
        return _mdc.runAndReturn(() => {
          if (this._mainMethodCalled !== true) {
                      // initialised = true
                      // _mainMethodCalled = true
            if (this._mainMethod instanceof Function) {
              this._mainMethodCalled = true

              return this._mainMethod()
            } else {
              _logger.warn('The \'main\' method (entry point) of the application using this logger has not been specified in the logger configuration. ' +
                  'If you are using the express middleware, you can ignore this warning, otherwise, please supply ' +
                  'your application\'s main method (entry point) if you want to use the continuation local storage i.e. MDC')
            }
          }
        })
      })
    })

    this.emit('LOGGER_INITIALISED')
  }

    /**
     *  Logs and throws the supplied error
     * @param {Error} err - The error object
     */
  throwing (err) {
    if (err instanceof Error) {
      this._logger.error(err)
      throw err
    }
  }

    /**
     * The trace level method - takes the same args as the bunyan trace args for now
     * @param {Array} args - the args object passed to
     */
  trace (...args) {
    checkAndSetTraceId(this.getMdc(), this)
    let result = extractArgs(args, this.getMdc())
    let {msg, data, msgTokens} = result
    data = addTraceIdToSerializerObject(data, this.getMdc())
    this._logger.trace(data, msg, msgTokens)
  }

    /**
     * The debug level method - takes the same args as the bunyan debug args for now
     */
  debug (...args) {
    checkAndSetTraceId(this.getMdc(), this)
    let result = extractArgs(args, this.getMdc())
    let {msg, data, msgTokens} = result
    data = addTraceIdToSerializerObject(data, this.getMdc())
    this._logger.debug(data, msg, msgTokens)
  }

    /**
     * The info level method - takes the same args as the bunyan info args for now
     */

  info (...args) {
    checkAndSetTraceId(this.getMdc(), this)
    let result = extractArgs(args, this.getMdc())
    let {msg, data, msgTokens} = result
    data = addTraceIdToSerializerObject(data, this.getMdc())
    this._logger.info(data, msg, msgTokens)
  }
    /**
     * The info level method - takes the same args as the bunyan info args for now
     */
  warn (...args) {
    checkAndSetTraceId(this.getMdc(), this)
    let result = extractArgs(args, this.getMdc())
    let {msg, data, msgTokens} = result
    data = addTraceIdToSerializerObject(data, this.getMdc())
    this._logger.warn(data, msg, msgTokens)
  }

    /**
     * The info level method - takes the same args as the bunyan info args for now
     */
  error (...args) {
    checkAndSetTraceId(this.getMdc(), this)
    let result = extractArgs(args, this.getMdc())
    let {msg, data, msgTokens} = result
    data = addTraceIdToSerializerObject(data, this.getMdc())
    this._logger.error(data, msg, msgTokens)
  }

    /**
     * The info level method - takes the same args as the bunyan info args for now
     */
  fatal (...args) {
    checkAndSetTraceId(this.getMdc(), this)
    let result = extractArgs(args, this.getMdc())
    let {msg, data, msgTokens} = result
    this._logger.fatal(data, msg, msgTokens)
  }

    /**
     * Returns the continuation local storage i.e MDC
     * @returns {*}
     */
  getMdc () {
    return this.mdc
  }

    /**
     * Returns the instance of the underlying log framework
     * @returns {*}
     */
  getLoggingFramework () {
    return this._logger
  }

    /**
     * This is private method intended to be called by the express middleware when the middleware initialized
     * @private
     */
  _init () {
    this._mainMethodCalled = true
  }

  getUseUuidAsId () {
    return this.useUuidAsTraceId
  }

  generateTraceId () {
    return this.getUseUuidAsId() ? randomstring.generate({
      charset: 'hex',
      length: 19
    }) : uuidv4()
  }
}
module.exports = Logger
