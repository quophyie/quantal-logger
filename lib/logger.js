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

const checkAndSetTraceId = (mdc) => {
  if (mdc && !mdc.get('traceId')) {
    mdc.run(() => {
      const traceId = uuidv4()
      mdc.set('traceId', traceId)
    })
  }
}
class Logger {
  constructor (options) {
    require('lugg').init(options)
    let opts = _.omit(options, ['name', 'mdcNamespace'])

    const appName = (options && options.name) ? options.name : packageJson.name

    const _logger = require('lugg')(appName, opts)
    const mdcNamespace = (options && options.mdcNamespace) ? options.mdcNamespace : packageJson.name
    if (!mdcNamespace) {
      const illegalArgError = new Errors.IllegalArgumentError('options.mdcNamespace is required')
      _logger.error(illegalArgError)
      throw illegalArgError
    }

    this._logger = _logger
    this.mdc = cls.createNamespace(mdcNamespace)
  }

  throwing (err) {
    if (err instanceof Error) {
      this._logger.error(err)
      throw err
    }
  }

  trace (...args) {
    checkAndSetTraceId(this.getMdc())
    return this._logger.trace(...args)
  }

  debug (...args) {
    checkAndSetTraceId(this.getMdc())
    return this._logger.debug(...args)
  }

  info (...args) {
    checkAndSetTraceId(this.getMdc())
    return this._logger.info(...args)
  }

  warn (...args) {
    checkAndSetTraceId(this.getMdc())
    return this._logger.warn(...args)
  }

  error (...args) {
    checkAndSetTraceId(this.getMdc())
    return this._logger.error(...args)
  }

  fatal (...args) {
    checkAndSetTraceId(this.getMdc())
    return this._logger.fatal(...args)
  }

  getMdc () {
    return this.mdc
  }

    /**
     * Returns the instance of the under;ying log framework
     * @returns {*}
     */
  getLoggingFramework () {
    return this._logger
  }
}

module.exports = Logger
