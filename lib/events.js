/**
 * Created by dman on 05/10/2017.
 */
'use strict'

const CommonEvents = require('quantal-nodejs-shared').events

const events = Object.assign({}, CommonEvents)
events.LOGGER_INITIALISED = 'LOGGER_INITIALISED'

module.exports = Object.freeze(events)

