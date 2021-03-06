'use strict'
/**
 * Created by dman on 16/06/2017.
 */

var _dec, _class

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
const bformat = require('bunyan-format')
const LogzioBunyanStream = require('logzio-bunyan')

const Events = require('events')

const _keyTraceId = 'traceId'
const _keyEvent = 'event'

let NamespaceType = null
let _restoredMdc = null

// Private methods
const createLogData = (mdc, customData) => {
  const traceId = mdc.get(_keyTraceId)
  let data = {}
  if (traceId) {
    data = { traceId }
  }
  let stringCnt = 0,
    numCnt = 0,
    arrCnt = 0

  for (const item of customData) {
    if (item instanceof Array) {
      data[`array${++arrCnt}`] = item
    } else if (item instanceof Object) {
      _.assign(data, item)
    } else if (typeof item === 'number') {
      data[`number${++numCnt}`] = item
    } else if (typeof item === 'string') {
      data[`string${++stringCnt}`] = item
    }
  }

  return data
}

/**
 * Checks and sets the traceId and event in the continuation local storage
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
 * Checks and updates event in the continuation local storage
 * @param {continuation-local-storage} mdc - An instance of the continuation logger class
 * @param {QuantBeat} logger - instance of quant beat class i.e. quant logger
 */
const checkAndUpdateEvent = (logger, event) => {
  const mdc = logger.getMdc()
  let oldEvent
  if (logger._mainMethodCalled === true && mdc) {
    oldEvent = mdc.get(_keyEvent)
    mdc.set(_keyEvent, event === null || event === undefined ? oldEvent : event)
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
  } else {
    [result.msg] = args
  }

  let traceId = null
  let event = null

  if (mdc) {
    traceId = mdc.get(_keyTraceId)
    event = mdc.get(_keyEvent)
  }

  if (traceId) {
    result.data.traceId = traceId
  }

  if (event && !result.data.event) {
    result.data.event = event
  }
  return result
}

/**
 * A request serializer for bunyan
 * @param req - the request object
 * @returns {{method, url, headers, remoteAddress, remotePort}}
 */
const requestSerializer = req => {
  let serializedReq = bunyanStdSerializers.req(req)
  if (!serializedReq) {
    serializedReq = {}
  }
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
 * Adds the traceId and event to the object to be serialized by bunyan
 * @param {object} data - the object that will contain the traceId prop
 * @param mdc
 * @returns {*}
 */
const addTraceIdAndEventToSerializerObject = (data, mdc) => {
  let traceId = null
  let event = null

  if (mdc) {
    traceId = mdc.get(_keyTraceId)
    event = mdc.get(_keyEvent)
  }

  if (data) {
    if (traceId) {
      data.traceId = traceId
    }
    if (!data.event) {
      data.event = event
    }
  } else {
    data = { traceId, event }
  }

  return data
}

/**
 * The bunyan serializer for respose
 * @param {Response} res - The response object objecr
 * @returns {{statusCode, header}}
 */
const responseSerializer = res => {
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

/**
 * Creates a logger that wraps lugg which is in itself a wrapper around bunyan
 *
 * @param {Object} options - the options that are used to configure the Logger. This supports all the options supported by bunyan
 * @param {Object} options.mainMethod - The  method that is used as main entry method of the application i.e the main.
 * If you are using the express the DO NOT SET this options
 * @param {Object} options.serializers - The serializers that are used to serialize output.
 * @param {string} [options.name=Application / Module name] - The name of the application. If not provided the name of the application / module will be used
 * @param {string} [options.mdcNamespace=Application / Module name] - The name of the namespace used to register the mdc. If not provided the name of the application / module will be used
 * @param {boolean} options.useBunyanFormat - if true, uses 'bunyan-format' module to format the output
 * @param {Object} options.bunyanFormatOpts - The options that are passed to 'bunyan-format' module
 * @param {boolean} options.useUuid4AsTraceId - if true UUIDV4 will be used as the traceId else otherweise a hexadecimal of length 19 will be generated and used if using the mdc
 * @param {Object} options.logzioOpts - if supplied, the logz.io stream will be configured
 * @param {Object} options.logzioOpts.token  - The logz.io. This is required if options.logzioOpts is supplied
 */
const Wove = require('aspect.js').Wove
let Logger = (_dec = Wove({ bar: 42 }), _dec(_class = class Logger extends EventEmitter {
  constructor (options) {
    super()
    let curatedOpts = Object.assign({}, options)
    curatedOpts.streams = []
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

        // bunyan-format
    if (curatedOpts.useBunyanFormat === undefined || curatedOpts.useBunyanFormat === null || curatedOpts.useBunyanFormat === true) {
      curatedOpts.useBunyanFormat = true
    } else {
      curatedOpts.useBunyanFormat = false
    }

    if (curatedOpts.useBunyanFormat) {
      const formatOut = curatedOpts.bunyanFormatOpts ? bformat(curatedOpts.bunyanFormatOpts) : bformat({ outputMode: 'bunyan', levelInString: true })
      const formatOutStream = {
        stream: formatOut,
        level: 'debug'
      }
      curatedOpts.streams.push(formatOutStream)
    }

    if (curatedOpts.logzioOpts) {
      if (!curatedOpts.logzioOpts.token) {
        throw new Errors.IllegalArgumentError('logzioOpts.token is required')
      }
      const logzioStream = new LogzioBunyanStream(curatedOpts.logzioOpts)
      const logzioStreamConfig = {
        type: 'raw',
        level: 'debug',
        stream: logzioStream
      }
      curatedOpts.streams.push(logzioStreamConfig)
    }

    curatedOpts.name = curatedOpts.name || packageJson.name
    require('lugg').init(_.omit(curatedOpts, ['useBunyanFormat', 'useUuid4AsTraceId', 'logzioOpts']))

    let opts = _.omit(options, ['mdcNamespace', 'logzioOpts'])
    const appName = options && options.name ? options.name : packageJson.name
    const _logger = require('lugg')(appName, opts)
    const mdcNamespace = options && options.mdcNamespace ? options.mdcNamespace : packageJson.name
    this._useUuid4AsTraceId = !!(options !== undefined && options !== null && options.useUuid4AsTraceId)

    if (!mdcNamespace) {
      const illegalArgError = new Errors.IllegalArgumentError('options.mdcNamespace is required')
      _logger.error(illegalArgError)
      throw illegalArgError
    }

    this._logger = _logger
    const _mdc = cls.createNamespace(mdcNamespace)
    this.mdc = _mdc

    NamespaceType = this.mdc.constructor
    clsBluebird(this.mdc)
    this._mainMethod = options ? options.mainMethod : null

    this.on(Events.LOGGER_INITIALISED, () => {
      process.nextTick(() => {
        return _mdc.runAndReturn(() => {
          if (this._mainMethodCalled !== true) {
                        // initialised = true
                        // _mainMethodCalled = true
            if (this._mainMethod instanceof Function) {
              this._mainMethodCalled = true

              return this._mainMethod()
            } else {
              _logger.warn('The \'main\' method (entry point) of the application using this logger has not been specified in the logger configuration via the `options.mainMethod` constructor options object.' +
                  ' If you are using the express middleware, you can ignore this warning, otherwise, please supply ' +
                  'your application\'s main method (entry point) via the `options.mainMethod` constructor options object ' +
                  'if you want to use the continuation local storage i.e. MDC')
            }
          }
        })
      })
    })

    this.emit(Events.LOGGER_INITIALISED)
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
    let { msg, data, msgTokens } = result
    data = addTraceIdAndEventToSerializerObject(data, this.getMdc())
    checkAndUpdateEvent(this, data.event)
    this._logger.trace(data, msg, msgTokens)
  }

    /**
     * The debug level method - takes the same args as the bunyan debug args for now
     */
  debug (...args) {
    checkAndSetTraceId(this.getMdc(), this)
    let result = extractArgs(args, this.getMdc())
    let { msg, data, msgTokens } = result
    data = addTraceIdAndEventToSerializerObject(data, this.getMdc())
    checkAndUpdateEvent(this, data.event)
    this._logger.debug(data, msg, msgTokens)
  }

    /**
     * The info level method - takes the same args as the bunyan info args for now
     */

  info (...args) {
    checkAndSetTraceId(this.getMdc(), this)
    let result = extractArgs(args, this.getMdc())
    let { msg, data, msgTokens } = result
    data = addTraceIdAndEventToSerializerObject(data, this.getMdc())
    checkAndUpdateEvent(this, data.event)
    this._logger.info(data, msg, msgTokens)
  }
    /**
     * The info level method - takes the same args as the bunyan info args for now
     */
  warn (...args) {
    checkAndSetTraceId(this.getMdc(), this)
    let result = extractArgs(args, this.getMdc())
    let { msg, data, msgTokens } = result
    data = addTraceIdAndEventToSerializerObject(data, this.getMdc())
    checkAndUpdateEvent(this, data.event)
    this._logger.warn(data, msg, msgTokens)
  }

    /**
     * The info level method - takes the same args as the bunyan info args for now
     */
  error (...args) {
    checkAndSetTraceId(this.getMdc(), this)
    let result = extractArgs(args, this.getMdc())
    let { msg, data, msgTokens } = result
    data = addTraceIdAndEventToSerializerObject(data, this.getMdc())
    checkAndUpdateEvent(this, data.event)
    this._logger.error(data, msg, msgTokens)
  }

    /**
     * The info level method - takes the same args as the bunyan info args for now
     */
  fatal (...args) {
    checkAndSetTraceId(this.getMdc(), this)
    let result = extractArgs(args, this.getMdc())
    let { msg, data, msgTokens } = result
    data = addTraceIdAndEventToSerializerObject(data, this.getMdc())
    checkAndUpdateEvent(this, data.event)
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
   * Sets the continuation local storage i.e MDC to the provided mdc
   * @returns {*}
   */
  setMdc (newMdc) {
    if (newMdc && NamespaceType && newMdc instanceof NamespaceType) {
      this.mdc = newMdc
    } else {
      this.throwing(new Errors.IllegalArgumentError('new must be an instance of continuation local storage Namespace'))
    }
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

  getUseUuid4AsId () {
    return this._useUuid4AsTraceId
  }

  generateTraceId () {
    return this.getUseUuid4AsId() ? randomstring.generate({
      charset: 'hex',
      length: 19
    }) : uuidv4()
  }

  /**
   * disables the mdc
   */
  disableMdc () {
    _restoredMdc = _.cloneDeep(this.getMdc())
    this.mdc = null
  }

  /**
   * enables the mdc
   */
  enableMdc () {
    this.mdc = _restoredMdc
  }

  /**
   * Returns true if mdc is enabled and false otherwise
   * @returns {boolean}
   */
  isMdcEnabled () {
    return this.mdc !== null && this.mdc !== undefined
  }
}) || _class)

module.exports = Logger
