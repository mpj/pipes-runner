var Q = require('q')
var find = require('mout/array/find')
var filter = require('mout/array/filter')
var reject = require('mout/array/reject')
var pluck = require('mout/array/pluck')
var partial = require('mout/function/partial')
var deepEquals = require('mout/object/deepEquals')

function findTransformByName(module, transformName) {
  return find(module.transforms, function(t) {
    return t.name === transformName
  })
}

function sendUntilDone(module, expectations, channel, message, events) {
  var deferred = Q.defer()

  var events = events || []

  // 1. Expectations always have first dibs on messages sent
  // to channels, and will subvert any other routes
  // TODO: multiple
  var expectationsOnChannel = filter(expectations, { channel: channel })
  if (expectationsOnChannel.length > 0) {
    var match = find(expectationsOnChannel, function(expectation) {
      return deepEquals(expectation.message, message)
    })
    if (match) {
      events.push({
        received: {
          channel: channel,
          message: message
        },
        expectation: match
      })
    }

    deferred.resolve(events)
  } else {

    var receivers = [];

    // 2. Try implicit routing if the channel name
    // exactly matches transform name
    var implicitTransform = findTransformByName(module, channel)
    if (implicitTransform)
      receivers.push(implicitTransform)

    // 3. See if this channel is routed to a transform
    // explicitly by routes
    var routesOnChannel = filter(module.routes, { channel: channel })
    routesOnChannel.forEach(function(route) {
      receivers.push(findTransformByName(module, route.transform))
    })

    var sendPromises = []
    receivers.forEach(function(transform) {

      var deferredSend = Q.defer()
      sendPromises.push(deferredSend.promise)
      var timeoutHandle;
      var timedOut = false
      var work = {
        message: message,
        done: function(sendChannel, sendMessage) {
          if(timedOut) return;
          clearTimeout(timeoutHandle)
          events.push({
            received: {
              channel: channel,
              message: message
            },
            transform: transform.name,
            sent: {
              channel: sendChannel,
              message: sendMessage
            }
          })
          sendUntilDone(module, expectations, sendChannel, sendMessage, events)
            .then(deferredSend.resolve)
        }
      }
      timeoutHandle = setTimeout(function() {
        timedOut = true
        events.push({
          received: {
            channel: channel,
            message: message
          },
          transform: transform.name,
          timedOut: true
        })
      }, 2000)
      transform(work)
    })
    return Q.all(sendPromises).then(function() { return events })
  }

  return deferred.promise
}

function runWorld(module, world) {
  return sendUntilDone(module, world.expectations, 'start', true).then(function(events) {

    var metExpectations = []
    pluck(events, 'expectation').forEach(function(expectation) {
      if (expectation) metExpectations.push(expectation)
    })
    var unmetExpectations =
      reject(world.expectations, function(expectation) {
        return !!find(metExpectations, function(met){
          return deepEquals(met, expectation)
        })
      })

    return {
      world: { name: world.name },
      events: events,
      unmet: unmetExpectations
    }
  })
}

function runModule(module) {
  var runWorldInModule = partial(runWorld, module)
  var whenTimelines = Q.all(module.worlds.map(runWorldInModule))
  return whenTimelines.then(function(timelines) {
    return {
      timelines: timelines
    }
  })
}


function pushOnPropertyArray(propertyName, obj) {
  this[propertyName] = this[propertyName] || []
  this[propertyName].push(obj)
  return this
}

var World = {
  expectation: partial(pushOnPropertyArray, 'expectations'),
}

var Module = {
  world:     partial(pushOnPropertyArray, 'worlds'),
  transform: partial(pushOnPropertyArray, 'transforms'),
  route:     partial(pushOnPropertyArray, 'routes')
}

module.exports = {
  run: runModule,
  module: function() { return Object.create(Module) },
  world: function(name) {
    return Object.create(World, { name: { value: name }}) }
}