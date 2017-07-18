/**
 * Created by dman on 18/06/2017.
 */
const Code = require('code')
const expect = Code.expect
const middleware = require('./../lib/logger-express')
const sinon = require('sinon')
const EventEmitter = require('events').EventEmitter
const httpMocks = require('node-mocks-http')
const controller = require('./controller')
const Logger = require('./../lib/logger')
const Errors = require('quantal-errors')

const buildResponse = () => httpMocks.createResponse({eventEmitter: require('events').EventEmitter})

describe('Logger Middeware Tests', () => {
  it('hello', function (done) {
    const response = buildResponse()
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/hello',
      protocol: 'http',
      connection: {
        remoteAddress: '127.0.0.1'
      }
    })

    response.on('finish', function (res) {
      expect(response.header('X-TraceId')).to.be.a.string()
      done()
    })
    controller.handle(request, response)
  })

  it('UPPER CASE', function (done) {
    const response = buildResponse()
    const request = httpMocks.createRequest({
      method: 'GET',
      url: '/upper/hello',
      protocol: 'http',
      connection: {
        remoteAddress: '127.0.0.1'
      }
    })

    response.on('finish', function (res) {
      expect(response.header('X-TraceId')).to.be.a.string()
      expect(response.header('X-B3-TraceId')).to.be.a.string()
      done()
    })
    controller.handle(request, response)
  })

  it('should  throw NullReferenceError given null in middleware', () => {
    expect(middleware(new Logger())).to.be.a.function()
  })

  it('should return middleware function', () => {
    const thrown = () => middleware(null)
    expect(thrown).to.throw(Errors.NullReferenceError, 'Logger instance cannot be null')
  })

  it('should invoke the callback', function () {
    const spy = sinon.spy()
    const emitter = new EventEmitter()

    emitter.on('finish', spy)
    emitter.emit('finish')
    sinon.assert.calledOnce(spy)
  })
})
